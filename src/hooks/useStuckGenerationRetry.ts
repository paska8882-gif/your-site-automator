import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { HistoryItem } from "@/hooks/useGenerationHistory";

/**
 * Auto-retries generations that appear stuck:
 * - Status is "generating" for > STUCK_THRESHOLD_MS
 * - No specific_ai_model set (meaning the background worker never started)
 * - Each generation is retried at most MAX_RETRIES times
 */

const STUCK_THRESHOLD_MS = 4 * 60 * 1000; // 4 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30s
const MAX_RETRIES = 2;

export function useStuckGenerationRetry(history: HistoryItem[]) {
  const { user } = useAuth();
  const retriedMap = useRef<Map<string, number>>(new Map()); // id -> retry count
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkAndRetry = useCallback(async () => {
    if (!user?.id) return;

    const now = Date.now();
    const stuckItems = history.filter((item) => {
      if (item.status !== "generating") return false;
      const age = now - new Date(item.created_at).getTime();
      if (age < STUCK_THRESHOLD_MS) return false;
      // Already retried too many times
      const retryCount = retriedMap.current.get(item.id) || 0;
      if (retryCount >= MAX_RETRIES) return false;
      return true;
    });

    if (stuckItems.length === 0) return;

    // Check DB for specific_ai_model to confirm truly stuck
    const ids = stuckItems.map((i) => i.id);
    const { data: dbRecords } = await supabase
      .from("generation_history")
      .select("id, status, specific_ai_model, created_at, prompt, language, ai_model, website_type, site_name, image_source, geo, color_scheme, layout_style, improved_prompt, vip_prompt")
      .in("id", ids);

    if (!dbRecords) return;

    for (const record of dbRecords) {
      // Only retry if still generating AND no model was assigned (worker never started)
      if (record.status !== "generating") continue;
      if (record.specific_ai_model) continue; // Worker started, just slow

      const age = now - new Date(record.created_at).getTime();
      if (age < STUCK_THRESHOLD_MS) continue;

      const retryCount = retriedMap.current.get(record.id) || 0;
      if (retryCount >= MAX_RETRIES) continue;

      console.log(`[StuckRetry] Generation ${record.id} stuck for ${Math.round(age / 1000)}s, auto-retrying (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      retriedMap.current.set(record.id, retryCount + 1);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) continue;

        // Get user's team
        const { data: teamMember } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", session.user.id)
          .eq("status", "approved")
          .maybeSingle();

        const functionName =
          record.website_type === "react"
            ? "generate-react-website"
            : record.website_type === "php"
              ? "generate-php-website"
              : "generate-website";

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              prompt: record.prompt,
              language: record.language,
              aiModel: record.ai_model || "senior",
              siteName: record.site_name,
              imageSource: record.image_source || "basic",
              teamId: teamMember?.team_id,
              geo: record.geo,
              retryHistoryId: record.id,
              colorScheme: record.color_scheme,
              layoutStyle: record.layout_style,
              improvedPrompt: record.improved_prompt,
              vipPrompt: record.vip_prompt,
            }),
          }
        );

        if (resp.ok) {
          console.log(`[StuckRetry] Successfully re-triggered generation ${record.id}`);
        } else {
          console.warn(`[StuckRetry] Failed to retry ${record.id}: HTTP ${resp.status}`);
          await resp.text(); // consume body
        }
      } catch (err) {
        console.error(`[StuckRetry] Error retrying ${record.id}:`, err);
      }
    }
  }, [user?.id, history]);

  useEffect(() => {
    // Only run if there are active generations
    const hasGenerating = history.some((i) => i.status === "generating");
    if (!hasGenerating) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run check immediately, then on interval
    checkAndRetry();
    intervalRef.current = setInterval(checkAndRetry, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [history, checkAndRetry]);

  // Clean up retried map when items leave generating state
  useEffect(() => {
    const generatingIds = new Set(
      history.filter((i) => i.status === "generating").map((i) => i.id)
    );
    for (const id of retriedMap.current.keys()) {
      if (!generatingIds.has(id)) {
        retriedMap.current.delete(id);
      }
    }
  }, [history]);
}
