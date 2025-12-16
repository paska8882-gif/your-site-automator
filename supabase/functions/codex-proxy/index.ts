import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODEX_WEBHOOK_URL = "https://tryred.app.n8n.cloud/webhook/964e523f-9fd0-4462-99fd-3c94bb6d37af";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const historyId = body.historyId;
    
    console.log("Starting Codex generation (fire-and-forget) for:", body?.siteName, "historyId:", historyId);

    // Відправляємо запит до n8n і НЕ чекаємо відповіді
    // n8n сам запише результат в базу через Supabase REST API
    fetch(CODEX_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        // Передаємо дані для запису в БД
        supabaseUrl: Deno.env.get("SUPABASE_URL"),
        supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      }),
    }).catch((err) => {
      console.error("Failed to call Codex webhook:", err);
    });

    // Одразу повертаємо успіх — генерація йде в фоні
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Generation started in background",
      historyId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Codex proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
