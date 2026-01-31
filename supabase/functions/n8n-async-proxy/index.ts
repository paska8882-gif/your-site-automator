import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_START_URL = "https://n8n.dragonwhite-n8n.top/webhook/lovable-generate";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { historyId } = body;

    if (!historyId || typeof historyId !== "string") {
      return new Response(JSON.stringify({ error: "Missing historyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing backend credentials");
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read generation record under RLS
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: history, error: historyErr } = await (authed as any)
      .from("generation_history")
      .select("prompt, language, site_name, geo, vip_prompt, vip_images, color_scheme, layout_style")
      .eq("id", historyId)
      .single();

    if (historyErr || !history?.prompt) {
      const msg = historyErr?.message || "Generation not found";
      return new Response(JSON.stringify({ error: msg }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt: string = history.prompt;
    const language: string = history.language || "en";
    const siteName: string = history.site_name || "Website";

    console.log("🚀 Starting n8n async generation for:", siteName, "historyId:", historyId);

    // Build the n8n request payload
    const callbackUrl = `${supabaseUrl}/functions/v1/n8n-callback`;
    
    const n8nPayload = {
      historyId,
      prompt,
      language,
      siteName,
      geo: history.geo,
      vipPrompt: history.vip_prompt,
      vipImages: history.vip_images,
      colorScheme: history.color_scheme,
      layoutStyle: history.layout_style,
      callbackUrl,
      timestamp: new Date().toISOString(),
    };

    console.log("📤 Calling n8n start endpoint with callback:", callbackUrl);

    // Update status to generating and store requestId marker
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Call n8n start endpoint
    const startResponse = await fetch(N8N_START_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("n8n start failed:", startResponse.status, errorText);
      throw new Error(`n8n start endpoint error: ${startResponse.status}`);
    }

    const startData = await startResponse.json();
    console.log("📥 n8n start response:", JSON.stringify(startData));

    const requestId = startData.requestId || startData.id || historyId;
    
    if (!requestId) {
      throw new Error("No requestId returned from n8n");
    }

    console.log(`🎯 Got requestId: ${requestId}, waiting for callback...`);

    // Update generation with requestId marker so callback can find it
    await (supabase as any)
      .from("generation_history")
      .update({ 
        status: "generating", 
        error_message: `n8n:${requestId}` // Temporary marker for callback lookup
      })
      .eq("id", historyId);

    // Return immediately - n8n will callback when done
    return new Response(
      JSON.stringify({
        success: true,
        historyId,
        requestId,
        message: "Generation started, waiting for n8n callback",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("n8n async proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
