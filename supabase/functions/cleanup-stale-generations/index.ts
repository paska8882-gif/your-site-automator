import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry thresholds
const RETRY_AFTER_MINUTES = 10; // Retry if stuck for 10+ minutes
const MAX_RETRIES = 2; // Maximum retry attempts
const FAIL_AFTER_MINUTES = 60; // Mark as failed after 1 hour

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

    const now = Date.now();
    const tenMinutesAgo = new Date(now - RETRY_AFTER_MINUTES * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now - FAIL_AFTER_MINUTES * 60 * 1000).toISOString();

    // ==========================================
    // STEP 1: Auto-retry stuck generations (10-60 min)
    // ==========================================
    const { data: stuckItems, error: stuckError } = await supabase
      .from("generation_history")
      .select("id, user_id, team_id, prompt, language, site_name, ai_model, website_type, geo, image_source, vip_prompt, improved_prompt, sale_price, admin_note")
      .in("status", ["generating"])
      .lt("created_at", tenMinutesAgo)
      .gte("created_at", oneHourAgo);

    let retriedCount = 0;
    
    if (stuckError) {
      console.error("Error fetching stuck items:", stuckError.message);
    } else if (stuckItems && stuckItems.length > 0) {
      console.log(`Found ${stuckItems.length} stuck generations (10-60 min) to retry`);

      for (const item of stuckItems) {
        try {
          // Check retry count from admin_note (format: "retry:N")
          const currentRetries = parseInt(item.admin_note?.match(/retry:(\d+)/)?.[1] || "0", 10);
          
          if (currentRetries >= MAX_RETRIES) {
            console.log(`Skipping ${item.id} - already retried ${currentRetries} times`);
            continue;
          }

          console.log(`🔄 Auto-retrying generation ${item.id} (attempt ${currentRetries + 1}/${MAX_RETRIES})`);

          // Update retry counter in admin_note
          const newAdminNote = item.admin_note 
            ? item.admin_note.replace(/retry:\d+/, `retry:${currentRetries + 1}`)
            : `retry:${currentRetries + 1}`;
          
          // Reset status to pending for retry
          await supabase
            .from("generation_history")
            .update({
              status: "pending",
              error_message: null,
              admin_note: newAdminNote.includes("retry:") ? newAdminNote : `${newAdminNote} retry:${currentRetries + 1}`,
            })
            .eq("id", item.id);

          // Determine which edge function to call based on website_type
          const functionName = item.website_type === "react" 
            ? "generate-react-website" 
            : item.website_type === "php" 
              ? "generate-php-website" 
              : "generate-website";

          // Call the generation function with retry flag
          const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              retryHistoryId: item.id,
              prompt: item.prompt,
              language: item.language,
              siteName: item.site_name,
              aiModel: item.ai_model,
              websiteType: item.website_type,
              geo: item.geo,
              imageSource: item.image_source,
              vipPrompt: item.vip_prompt,
              improvedPrompt: item.improved_prompt,
            }),
          });

          if (response.ok) {
            console.log(`✅ Retry initiated for ${item.id}`);
            retriedCount++;
          } else {
            const errorText = await response.text();
            console.error(`❌ Retry failed for ${item.id}: ${response.status} ${errorText}`);
            
            // Revert status back to generating if retry call failed
            await supabase
              .from("generation_history")
              .update({ status: "generating" })
              .eq("id", item.id);
          }

          // Small delay between retries to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (retryError) {
          console.error(`Error retrying ${item.id}:`, retryError);
        }
      }
    }

    // ==========================================
    // STEP 2: Fail and refund old generations (>1 hour)
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
        JSON.stringify({ success: false, error: errMsg, retryable: isRetryable, retried: retriedCount }),
        { status: isRetryable ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staleItems || staleItems.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, retried: retriedCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${staleItems.length} stale generations (>1h) to cleanup`);

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
            // Include retry info in admin comment
            const retryCount = parseInt(item.admin_note?.match(/retry:(\d+)/)?.[1] || "0", 10);
            const adminCommentParts: string[] = [`Auto-timeout 1h.`];
            if (retryCount > 0) {
              adminCommentParts.push(`Retried ${retryCount}x.`);
            }
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

        // Check retry count for error message
        const retryCount = parseInt(item.admin_note?.match(/retry:(\d+)/)?.[1] || "0", 10);
        const errorMsg = retryCount > 0
          ? `Перевищено час очікування (1 год) після ${retryCount} спроб. Зверніться в підтримку https://t.me/assanatraf`
          : "Перевищено час очікування (1 год). Зверніться в підтримку https://t.me/assanatraf";

        // Mark as failed
        await supabase
          .from("generation_history")
          .update({
            status: "failed",
            error_message: errorMsg,
            sale_price: 0, // Reset since refunded
          })
          .eq("id", item.id);

        processed++;
      } catch (itemError) {
        console.error(`Error processing stale item ${item.id}:`, itemError);
      }
    }

    console.log(`Cleanup complete: ${processed} processed, ${refunded} refunded, ${appealsCreated} appeals, ${retriedCount} retried`);

    return new Response(
      JSON.stringify({ success: true, processed, refunded, appealsCreated, retried: retriedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup error:", errMsg);
    const isRetryable = errMsg.includes("timeout") || errMsg.includes("521") || errMsg.includes("server") || errMsg.includes("connection");
    return new Response(
      JSON.stringify({ success: false, error: errMsg, retryable: isRetryable }),
      { status: isRetryable ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
