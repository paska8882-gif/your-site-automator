import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const N8N_URL = "https://n8n.dragonwhite-n8n.top/webhook/lovable-generate";
    const CALLBACK_URL = "https://qqnekbzcgqvpgcyqlbcr.supabase.co/functions/v1/n8n-callback";

    const payload = {
      requestId: "test-001",
      chatId: "lovable-test",
      userId: "lovable-test",
      source: "lovable",
      prompt: `гео: бельгия
языки: французский и английский
domain: danswholesaleplants.com
topic: digital wayfinding & spatial orientation
keywords: orientation spatiale, signalétique numérique, navigation intérieure, cartographie des espaces, parcours utilisateurs, bâtiments publics, environnements complexes, mobilité piétonne, design informationnel, accessibilité, ux spatiale, plans interactifs, guidage visuel, espaces urbains, infrastructure publique, lisibilité, architecture, flux de circulation, environnement bâti
prohibited: crypto, bitcoin, nft, investissement, profit, revenu, argent facile, trading, casino, paris, gain rapide, miracle, thérapie, santé, médical, gratuit, offre limitée, achat immédiat.`,
      callbackUrl: CALLBACK_URL
    };

    console.log("📤 Sending request to n8n:", N8N_URL);
    console.log("📋 Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const statusCode = response.status;
    const responseText = await response.text();
    
    console.log("📥 Response status:", statusCode);
    console.log("📥 Response body:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        statusCode,
        n8nResponse: responseData,
        sentPayload: payload,
        callbackUrl: CALLBACK_URL,
        timestamp: new Date().toISOString()
      }, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
