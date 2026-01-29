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
const ZIP_CLEANUP_DAYS = 14; // Delete zip_data after 2 weeks

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
    const twoWeeksAgo = new Date(now - ZIP_CLEANUP_DAYS * 24 * 60 * 60 * 1000).toISOString();

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

          // Determine which edge function to call based on website_type
          const functionName = item.website_type === "react" 
            ? "generate-react-website" 
            : item.website_type === "php" 
              ? "generate-php-website" 
              : "generate-website";

          console.log(`🔄 Auto-retrying generation ${item.id} (attempt ${currentRetries + 1}/${MAX_RETRIES}) via ${functionName}`);

          // Update retry counter in admin_note BEFORE calling generator
          // Keep status as "generating" - the generator will handle the actual work
          const newAdminNote = item.admin_note 
            ? item.admin_note.replace(/retry:\d+/, `retry:${currentRetries + 1}`)
            : `retry:${currentRetries + 1}`;
          
          await supabase
            .from("generation_history")
            .update({
              error_message: null,
              admin_note: newAdminNote.includes("retry:") ? newAdminNote : `${newAdminNote} retry:${currentRetries + 1}`,
            })
            .eq("id", item.id);

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
            // Status remains "generating" so it will be picked up again on next cleanup run
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
    let appealsCreated = 0;

    const autoAppealReason = "Автоповідомлення: генерація перевищила час очікування (>1 год). Потребує розгляду адміністратором.";

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
            // Include retry info in admin comment
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
                status: "pending", // Admin will decide
                amount_to_refund: refundAmount, // Suggest full refund, admin decides
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

        // Check retry count for error message
        const retryCount = parseInt(item.admin_note?.match(/retry:(\d+)/)?.[1] || "0", 10);
        const errorMsg = retryCount > 0
          ? `Перевищено час очікування (1 год) після ${retryCount} спроб. Апеляцію створено автоматично.`
          : "Перевищено час очікування (1 год). Апеляцію створено автоматично.";

        // Mark as failed but keep sale_price for potential refund by admin
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
    // STEP 3: Sync active_generations counter with reality
    // ==========================================
    const { count: actualActiveCount, error: countError } = await supabase
      .from("generation_history")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "generating"]);

    let counterSynced = false;
    let oldCounter = 0;
    let newCounter = 0;

    if (countError) {
      console.error("Error counting active generations:", countError.message);
    } else {
      const actualCount = actualActiveCount ?? 0;
      
      // Get current counter value
      const { data: limitsData } = await supabase
        .from("system_limits")
        .select("active_generations")
        .eq("id", "global")
        .single();
      
      oldCounter = limitsData?.active_generations ?? 0;
      
      // Only update if there's a mismatch
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

    // ==========================================
    // STEP 4: Cleanup old zip_data (>2 weeks)
    // ==========================================
    const { data: oldZipItems, error: zipFetchError } = await supabase
      .from("generation_history")
      .select("id")
      .lt("created_at", twoWeeksAgo)
      .not("zip_data", "is", null);

    const { data: oldFilesItems, error: filesFetchError } = await supabase
      .from("generation_history")
      .select("id")
      .lt("created_at", twoWeeksAgo)
      .not("files_data", "is", null);

    let zipsCleared = 0;
    let filesCleared = 0;
    
    if (zipFetchError) {
      console.error("Error fetching old zip items:", zipFetchError.message);
    } else if (oldZipItems && oldZipItems.length > 0) {
      console.log(`Found ${oldZipItems.length} generations with zip_data older than 2 weeks`);
      
      const oldIds = oldZipItems.map(item => item.id);
      
      const { error: clearZipError } = await supabase
        .from("generation_history")
        .update({ zip_data: null })
        .in("id", oldIds);

      if (clearZipError) {
        console.error("Error clearing old zip data:", clearZipError.message);
      } else {
        zipsCleared = oldZipItems.length;
        console.log(`🗑️ Cleared zip_data from ${zipsCleared} old generations`);
      }
    }

    if (filesFetchError) {
      console.error("Error fetching old files items:", filesFetchError.message);
    } else if (oldFilesItems && oldFilesItems.length > 0) {
      console.log(`Found ${oldFilesItems.length} generations with files_data older than 2 weeks`);
      
      const oldFileIds = oldFilesItems.map(item => item.id);
      
      const { error: clearFilesError } = await supabase
        .from("generation_history")
        .update({ files_data: null })
        .in("id", oldFileIds);

      if (clearFilesError) {
        console.error("Error clearing old files data:", clearFilesError.message);
      } else {
        filesCleared = oldFilesItems.length;
        console.log(`🗑️ Cleared files_data from ${filesCleared} old generations`);
      }
    }

    console.log(`Cleanup complete: ${processed} processed, ${appealsCreated} pending appeals, ${retriedCount} retried, ${zipsCleared} zips cleared, ${filesCleared} files cleared${counterSynced ? `, counter synced ${oldCounter}→${newCounter}` : ""}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        appealsCreated, 
        retried: retriedCount,
        zipsCleared,
        filesCleared,
        counterSynced,
        ...(counterSynced && { counterBefore: oldCounter, counterAfter: newCounter })
      }),
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
