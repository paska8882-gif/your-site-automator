import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FAIL_AFTER_MINUTES = 60; // Mark as failed after 1 hour

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // SMART EXIT: Check if there's any active work to do
    // ==========================================
    const { count: activeCount, error: countError } = await supabase
      .from("generation_history")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "generating"]);

    if (countError) {
      const errMsg = countError.message || String(countError);
      console.error("Error counting active generations:", errMsg);
      const isRetryable = errMsg.includes("timeout") || errMsg.includes("521") || errMsg.includes("server") || errMsg.includes("connection");
      return new Response(
        JSON.stringify({ success: false, error: errMsg, retryable: isRetryable }),
        { status: isRetryable ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no active generations — skip all work immediately
    if ((activeCount ?? 0) === 0) {
      console.log("✅ No active generations — skipping cleanup");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_active_generations" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // RATE-LIMIT GUARD: max 1 real run per 10 minutes
    // ==========================================
    const { data: limitsCheck } = await supabase
      .from("system_limits")
      .select("last_cleanup_at")
      .eq("id", "global")
      .single();

    const TEN_MINUTES = 10 * 60 * 1000;
    if (limitsCheck?.last_cleanup_at) {
      const lastRun = new Date(limitsCheck.last_cleanup_at).getTime();
      const elapsed = Date.now() - lastRun;
      if (elapsed < TEN_MINUTES) {
        const nextRunIn = Math.ceil((TEN_MINUTES - elapsed) / 1000);
        console.log(`⏭️ Rate-limited: last run was ${Math.floor(elapsed / 1000)}s ago, next in ${nextRunIn}s`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "too_recent", nextRunInSeconds: nextRunIn }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Mark start of this run immediately to prevent parallel executions
    await supabase
      .from("system_limits")
      .update({ last_cleanup_at: new Date().toISOString() })
      .eq("id", "global");

    console.log(`Found ${activeCount} active generation(s) — running full cleanup`);

    const now = Date.now();
    const oneHourAgo = new Date(now - FAIL_AFTER_MINUTES * 60 * 1000).toISOString();

    // ==========================================
    // STEP 1: Fail and create appeals for old generations (>1 hour)
    // ==========================================
    const { data: staleItems, error: fetchError } = await supabase
      .from("generation_history")
      .select("id, user_id, team_id, sale_price, admin_note")
      .in("status", ["pending", "generating"])
      .lt("created_at", oneHourAgo);

    if (fetchError) {
      const errMsg = fetchError.message || String(fetchError);
      console.error("Error fetching stale items:", errMsg);
      const isRetryable = errMsg.includes("timeout") || errMsg.includes("521") || errMsg.includes("server") || errMsg.includes("connection");
      return new Response(
        JSON.stringify({ success: false, error: errMsg, retryable: isRetryable }),
        { status: isRetryable ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const staleCount = staleItems?.length ?? 0;
    console.log(`Found ${staleCount} stale generations (>1h) to process`);

    let processed = 0;
    let appealsCreated = 0;

    const autoAppealReason =
      "Автоповідомлення: генерація перевищила час очікування (>1 год). Потребує розгляду адміністратором.";

    for (const item of staleItems || []) {
      try {
        const refundAmount = typeof item.sale_price === "number" ? item.sale_price : 0;
        let effectiveTeamId: string | null = (item as any).team_id ?? null;

        // Fallback for older rows where team_id might be missing
        if (!effectiveTeamId && item.user_id) {
          const { data: membership } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", item.user_id)
            .eq("status", "approved")
            .limit(1)
            .maybeSingle();
          effectiveTeamId = membership?.team_id ?? null;
        }

        // Create pending appeal for admin review (no auto-refund)
        if (item.user_id) {
          const { data: existingAppeal, error: appealLookupErr } = await supabase
            .from("appeals")
            .select("id")
            .eq("generation_id", item.id)
            .limit(1)
            .maybeSingle();

          if (appealLookupErr) {
            console.error(`Failed to lookup appeal for generation ${item.id}:`, appealLookupErr.message);
          } else if (!existingAppeal) {
            const retryCount = parseInt(item.admin_note?.match(/retry:(\d+)/)?.[1] || "0", 10);
            const adminCommentParts: string[] = [`⏱️ Auto-timeout 1h.`];
            if (retryCount > 0) {
              adminCommentParts.push(`Retried ${retryCount}x.`);
            }
            adminCommentParts.push(`Suggested refund: $${refundAmount}`);

            const { error: appealInsertErr } = await supabase
              .from("appeals")
              .insert({
                generation_id: item.id,
                user_id: item.user_id,
                team_id: effectiveTeamId,
                reason: autoAppealReason,
                status: "pending",
                amount_to_refund: refundAmount,
                admin_comment: adminCommentParts.join(" "),
              });

            if (appealInsertErr) {
              console.error(`Failed to create auto-appeal for generation ${item.id}:`, appealInsertErr.message);
            } else {
              appealsCreated++;
              console.log(`Created pending appeal for generation ${item.id} with suggested refund $${refundAmount}`);
            }
          }
        } else {
          console.warn(`Skipping auto-appeal for generation ${item.id} because user_id is null`);
        }

        // Mark as failed
        const retryCount = parseInt(item.admin_note?.match(/retry:(\d+)/)?.[1] || "0", 10);
        const errorMsg = retryCount > 0
          ? `Перевищено час очікування (1 год) після ${retryCount} спроб. Апеляцію створено автоматично.`
          : "Перевищено час очікування (1 год). Апеляцію створено автоматично.";

        await supabase
          .from("generation_history")
          .update({
            status: "failed",
            error_message: errorMsg,
          })
          .eq("id", item.id);

        processed++;
      } catch (itemError) {
        console.error(`Error processing stale item ${item.id}:`, itemError);
      }
    }

    // ==========================================
    // STEP 2: Sync active_generations counter
    // ==========================================
    const { count: actualActiveCount, error: syncCountError } = await supabase
      .from("generation_history")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "generating"]);

    let counterSynced = false;
    let oldCounter = 0;
    let newCounter = 0;

    if (syncCountError) {
      console.error("Error counting active generations for sync:", syncCountError.message);
    } else {
      const actualCount = actualActiveCount ?? 0;

      const { data: limitsData } = await supabase
        .from("system_limits")
        .select("active_generations")
        .eq("id", "global")
        .single();

      oldCounter = limitsData?.active_generations ?? 0;

      if (oldCounter !== actualCount) {
        const { error: updateError } = await supabase
          .from("system_limits")
          .update({
            active_generations: actualCount,
            updated_at: new Date().toISOString()
          })
          .eq("id", "global");

        if (updateError) {
          console.error("Error syncing counter:", updateError.message);
        } else {
          counterSynced = true;
          newCounter = actualCount;
          console.log(`🔄 Counter synced: ${oldCounter} → ${actualCount}`);
        }
      }
    }

    // Only log to cleanup_logs when actual work was done
    if (processed > 0 || appealsCreated > 0) {
      const triggeredBy = req.headers.get("x-triggered-by") || "cron";
      const { error: logError } = await supabase
        .from("cleanup_logs")
        .insert({
          zips_cleared: 0,
          files_cleared: 0,
          processed,
          retried: 0,
          success: true,
          triggered_by: triggeredBy,
        });

      if (logError) {
        console.error("Error logging cleanup result:", logError.message);
      }
    }

    console.log(`Cleanup done: ${processed} processed, ${appealsCreated} appeals${counterSynced ? `, counter ${oldCounter}→${newCounter}` : ""}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        appealsCreated,
        counterSynced,
        ...(counterSynced && { counterBefore: oldCounter, counterAfter: newCounter })
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup error:", errMsg);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("cleanup_logs").insert({
          success: false,
          error_message: errMsg,
          triggered_by: req.headers.get("x-triggered-by") || "cron",
        });
      }
    } catch (logErr) {
      console.error("Failed to log error:", logErr);
    }

    const isRetryable = errMsg.includes("timeout") || errMsg.includes("521") || errMsg.includes("server") || errMsg.includes("connection");
    return new Response(
      JSON.stringify({ success: false, error: errMsg, retryable: isRetryable }),
      { status: isRetryable ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
