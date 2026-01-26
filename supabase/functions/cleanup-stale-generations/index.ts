import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Find stale generations (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: staleItems, error: fetchError } = await supabase
      .from("generation_history")
      .select("id, user_id, team_id, sale_price")
      .in("status", ["pending", "generating"])
      .lt("created_at", oneHourAgo);

    if (fetchError) {
      const errMsg = fetchError.message || String(fetchError);
      console.error("Error fetching stale items:", errMsg);
      // Check if it's a connection/timeout error - return 503 for retryable errors
      const isRetryable = errMsg.includes("timeout") || errMsg.includes("521") || errMsg.includes("server") || errMsg.includes("connection");
      return new Response(
        JSON.stringify({ success: false, error: errMsg, retryable: isRetryable }),
        { status: isRetryable ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staleItems || staleItems.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${staleItems.length} stale generations to cleanup`);

    let processed = 0;
    let refunded = 0;
    let appealsCreated = 0;

    const autoAppealReason = "Автоповідомлення: довга генерація (>1 год). Кошти повернено автоматично.";

    for (const item of staleItems) {
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

        // Refund balance if sale_price > 0 and we can resolve team
        if (refundAmount > 0 && effectiveTeamId) {
          const { data: team, error: teamErr } = await supabase
            .from("teams")
            .select("balance")
            .eq("id", effectiveTeamId)
            .single();

          if (teamErr) {
            console.error(`Failed to load team ${effectiveTeamId} for refund (generation ${item.id}):`, teamErr.message);
          } else {
            const { error: refundErr } = await supabase
              .from("teams")
              .update({ balance: (team.balance || 0) + refundAmount })
              .eq("id", effectiveTeamId);

            if (refundErr) {
              console.error(`Failed to refund team ${effectiveTeamId} for generation ${item.id}:`, refundErr.message);
            } else {
              console.log(`Refunded $${refundAmount} to team ${effectiveTeamId} for stale generation ${item.id}`);
              refunded++;
            }
          }
        }

        // Create auto-approved appeal once per generation (idempotent)
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
            const adminCommentParts: string[] = ["Auto-timeout 1h."];
            adminCommentParts.push(`Refunded: ${refundAmount}`);

            const { error: appealInsertErr } = await supabase
              .from("appeals")
              .insert({
                generation_id: item.id,
                user_id: item.user_id,
                team_id: effectiveTeamId,
                reason: autoAppealReason,
                status: "approved",
                amount_to_refund: 0,
                admin_comment: adminCommentParts.join(" "),
                resolved_at: new Date().toISOString(),
                resolved_by: null,
              });

            if (appealInsertErr) {
              console.error(`Failed to create auto-appeal for generation ${item.id}:`, appealInsertErr.message);
            } else {
              appealsCreated++;
            }
          }
        } else {
          console.warn(`Skipping auto-appeal for generation ${item.id} because user_id is null`);
        }

        // Mark as failed
        await supabase
          .from("generation_history")
          .update({
            status: "failed",
            error_message: "Перевищено час очікування (1 год). Зверніться в підтримку https://t.me/assanatraf",
            sale_price: 0, // Reset since refunded
          })
          .eq("id", item.id);

        processed++;
      } catch (itemError) {
        console.error(`Error processing stale item ${item.id}:`, itemError);
        // Continue with next item even if one fails
      }
    }

    console.log(`Cleanup complete: ${processed} processed, ${refunded} refunded, ${appealsCreated} appeals created`);

    return new Response(
      JSON.stringify({ success: true, processed, refunded, appealsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup error:", errMsg);
    // Check if it's a retryable error
    const isRetryable = errMsg.includes("timeout") || errMsg.includes("521") || errMsg.includes("server") || errMsg.includes("connection");
    return new Response(
      JSON.stringify({ success: false, error: errMsg, retryable: isRetryable }),
      { status: isRetryable ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
