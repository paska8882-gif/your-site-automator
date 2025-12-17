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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find stale generations (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: staleItems, error: fetchError } = await supabase
      .from("generation_history")
      .select("id, user_id, sale_price")
      .in("status", ["pending", "generating"])
      .lt("created_at", thirtyMinutesAgo);

    if (fetchError) {
      console.error("Error fetching stale items:", fetchError);
      return new Response(JSON.stringify({ success: false, error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!staleItems || staleItems.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${staleItems.length} stale generations to cleanup`);

    let processed = 0;
    let refunded = 0;

    for (const item of staleItems) {
      try {
        // Refund balance if sale_price > 0
        if (item.sale_price && item.sale_price > 0 && item.user_id) {
          // Get user's team membership
          const { data: membership } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", item.user_id)
            .eq("status", "approved")
            .limit(1)
            .maybeSingle();

          if (membership) {
            const { data: team } = await supabase
              .from("teams")
              .select("balance")
              .eq("id", membership.team_id)
              .single();

            if (team) {
              await supabase
                .from("teams")
                .update({ balance: (team.balance || 0) + item.sale_price })
                .eq("id", membership.team_id);
              console.log(`Refunded $${item.sale_price} to team ${membership.team_id} for stale generation ${item.id}`);
              refunded++;
            }
          }
        }

        // Mark as failed
        await supabase
          .from("generation_history")
          .update({
            status: "failed",
            error_message: "Перевищено час очікування (30 хв). Зверніться в підтримку https://t.me/assanatraf",
            sale_price: 0, // Reset since refunded
          })
          .eq("id", item.id);

        processed++;
      } catch (itemError) {
        console.error(`Error processing stale item ${item.id}:`, itemError);
      }
    }

    console.log(`Cleanup complete: ${processed} processed, ${refunded} refunded`);

    return new Response(
      JSON.stringify({ success: true, processed, refunded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
