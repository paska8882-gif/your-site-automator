import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODEX_WEBHOOK_URL = "https://tryred.app.n8n.cloud/webhook/964e523f-9fd0-4462-99fd-3c94bb6d37af";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Proxying request to Codex webhook:", body.siteName);

    // Try POST first (preferred)
    let response = await fetch(CODEX_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Some n8n webhooks are configured as GET-only; auto-fallback to GET on that specific 404
    if (!response.ok && response.status === 404) {
      const maybeText = await response.text().catch(() => "");
      const looksLikeMethodMismatch = maybeText.includes("not registered for POST") || maybeText.includes("GET request");

      if (looksLikeMethodMismatch) {
        const url = new URL(CODEX_WEBHOOK_URL);
        url.searchParams.set("prompt", body.prompt || "");
        url.searchParams.set("language", body.language || "");
        url.searchParams.set("websiteType", body.websiteType || "");
        url.searchParams.set("layoutStyle", body.layoutStyle || "");
        url.searchParams.set("siteName", body.siteName || "");
        url.searchParams.set("userId", body.userId || "");

        console.log("Webhook is GET-only, retrying with GET...");
        response = await fetch(url.toString(), { method: "GET" });
      } else {
        // Put text back into error handling flow below
        response = new Response(maybeText, { status: 404, headers: response.headers });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Codex webhook error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: errorText || `HTTP ${response.status}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the response as blob (expecting ZIP file)
    const zipData = await response.arrayBuffer();
    const base64Zip = btoa(String.fromCharCode(...new Uint8Array(zipData)));
    
    console.log("Received ZIP from Codex, size:", zipData.byteLength, "bytes");

    return new Response(base64Zip, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/plain" 
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Codex proxy error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
