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

    // Forward request to n8n webhook
    const response = await fetch(CODEX_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Codex webhook error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: errorText || `HTTP ${response.status}` }),
        { 
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
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
