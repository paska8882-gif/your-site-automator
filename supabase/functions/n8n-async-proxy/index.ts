import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bot webhook configurations
const BOT_WEBHOOKS: Record<string, string> = {
  "2lang_html": "https://n8n.dragonwhite-n8n.top/webhook/lovable-generate",
  "nextjs_bot": "https://n8n.dragonwhite-n8n.top/webhook/d26af941-69aa-4b93-82f8-fd5cd1d1c5ea",
};

const DEFAULT_WEBHOOK_URL = "https://n8n.dragonwhite-n8n.top/webhook/lovable-generate";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { historyId, botId, fullPrompt, domain, keywords, forbiddenWords } = body;

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

    // Update status to generating
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await supabase
      .from("generation_history")
      .update({ status: "generating", error_message: null })
      .eq("id", historyId);

    // Use fullPrompt from request body if available, otherwise fall back to DB
    const prompt: string = fullPrompt || history.prompt;
    const language: string = history.language || "en";
    const siteName: string = history.site_name || "Website";

    // Determine webhook URL based on botId or image_source
    let webhookUrl = DEFAULT_WEBHOOK_URL;
    if (botId && BOT_WEBHOOKS[botId]) {
      webhookUrl = BOT_WEBHOOKS[botId];
    }

    console.log("🚀 Starting n8n generation for:", siteName, "historyId:", historyId, "bot:", botId || "default", "webhook:", webhookUrl);

    // Build callback URL - n8n will POST result here
    const callbackUrl = `${supabaseUrl}/functions/v1/n8n-callback`;

    // Build the n8n request payload with callback URL
    const n8nPayload = {
      // Callback configuration
      callbackUrl,
      callbackSecret: "lovable-n8n-secret-2025", // For x-n8n-signature header
      
      // Generation data
      historyId,
      prompt,
      language,
      siteName,
      geo: history.geo,
      domain: domain || "",
      keywords: keywords || "",
      forbiddenWords: forbiddenWords || "",
      vipPrompt: history.vip_prompt,
      vipImages: history.vip_images,
      colorScheme: history.color_scheme,
      layoutStyle: history.layout_style,
      timestamp: new Date().toISOString(),
      botId: botId || "2lang_html",
    };

    console.log("📤 Sending to n8n with callback URL:", callbackUrl);
    console.log("📤 Payload:", JSON.stringify(n8nPayload).substring(0, 500));

    // Send request to n8n - they will call us back when done
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("n8n webhook failed:", n8nResponse.status, errorText);
      
      // Mark as failed
      await supabase
        .from("generation_history")
        .update({ status: "failed", error_message: `n8n error: ${n8nResponse.status}` })
        .eq("id", historyId);
      
      throw new Error(`n8n webhook error: ${n8nResponse.status}`);
    }

    const n8nData = await n8nResponse.json().catch(() => ({}));
    console.log("📥 n8n response:", JSON.stringify(n8nData));

    const requestId = n8nData.requestId || n8nData.id || historyId;

    // Return immediately - n8n will call back when generation is complete
    return new Response(
      JSON.stringify({
        success: true,
        historyId,
        requestId,
        callbackUrl,
        message: "Generation started, waiting for callback",
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
