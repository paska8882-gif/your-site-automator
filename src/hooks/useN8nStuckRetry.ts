import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Auto-retries n8n bot generations stuck in "generating" for > 10 minutes.
 * - 1 retry attempt after 10 minutes
 * - If still stuck after another 10 minutes (20 total), mark as failed
 */

interface N8nHistoryItem {
  id: string;
  status: string;
  created_at: string;
  image_source: string | null;
}

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const FAIL_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes — fail after 2nd timeout
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30s
const MAX_RETRIES = 1;

const N8N_IMAGE_SOURCES = ["nextjs", "n8n-bot-2lang_html", "n8n-bot-nextjs_bot", "n8n-bot"];

function isN8nGeneration(imageSource: string | null): boolean {
  if (!imageSource) return false;
  return N8N_IMAGE_SOURCES.includes(imageSource) || imageSource.startsWith("n8n-bot");
}

export function useN8nStuckRetry(history: N8nHistoryItem[]) {
  const { user } = useAuth();
  const retriedMap = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkAndRetry = useCallback(async () => {
    if (!user?.id) return;

    const now = Date.now();
    const stuckItems = history.filter((item) => {
      if (item.status !== "generating") return false;
      if (!isN8nGeneration(item.image_source)) return false;
      const age = now - new Date(item.created_at).getTime();
      if (age < STUCK_THRESHOLD_MS) return false;
      return true;
    });

    if (stuckItems.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    for (const item of stuckItems) {
      const age = now - new Date(item.created_at).getTime();
      const retryCount = retriedMap.current.get(item.id) || 0;

      // If past fail threshold and already retried — mark as failed
      if (age >= FAIL_THRESHOLD_MS && retryCount >= MAX_RETRIES) {
        console.log(`[N8nStuckRetry] Generation ${item.id} stuck for ${Math.round(age / 1000)}s after ${retryCount} retries, marking as failed`);
        retriedMap.current.delete(item.id);

        await supabase
          .from("generation_history")
          .update({
            status: "failed",
            error_message: "Generation timed out after retry (no callback received from bot)",
          })
          .eq("id", item.id);
        continue;
      }

      // If past stuck threshold and not yet retried — retry
      if (retryCount < MAX_RETRIES) {
        console.log(`[N8nStuckRetry] Generation ${item.id} stuck for ${Math.round(age / 1000)}s, auto-retrying (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        retriedMap.current.set(item.id, retryCount + 1);

        try {
          // Fetch original data to determine botId
          const { data: record } = await supabase
            .from("generation_history")
            .select("prompt, image_source, site_name")
            .eq("id", item.id)
            .single();

          if (!record) continue;

          const botId = record.image_source === "nextjs" || record.image_source === "n8n-bot-nextjs_bot"
            ? "nextjs_bot"
            : "2lang_html";

          const response = await supabase.functions.invoke("n8n-async-proxy", {
            body: {
              historyId: item.id,
              botId,
            },
          });

          if (response.error) {
            console.warn(`[N8nStuckRetry] Retry failed for ${item.id}:`, response.error.message);
          } else {
            console.log(`[N8nStuckRetry] Successfully re-triggered ${item.id}`);
          }
        } catch (err) {
          console.error(`[N8nStuckRetry] Error retrying ${item.id}:`, err);
        }
      }
    }
  }, [user?.id, history]);

  useEffect(() => {
    const hasN8nGenerating = history.some(
      (i) => i.status === "generating" && isN8nGeneration(i.image_source)
    );

    if (!hasN8nGenerating) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

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
