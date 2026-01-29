import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, description, currentFiles, websiteType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build file context for the AI
    const filesList = currentFiles?.map((f: { path: string }) => f.path).join(", ") || "index.html";

    const userDescription = description?.trim();
    
    const systemPrompt = userDescription 
      ? `Ти експерт веб-розробки. Користувач надіслав скріншот і описав проблему. 
Проаналізуй СКРІН + ОПИС разом як ОДИН запит. Користувач бачить проблему і пояснює що не так.

Тип: ${websiteType === "react" ? "React" : "HTML"} | Файли: ${filesList}

ВАЖЛИВО: Відповідь 15-20 слів! Без заголовків, без емодзі. Підтверди проблему + дай рішення.`
      : `Ти експерт веб-розробки. Проаналізуй скріншот сайту.

Тип: ${websiteType === "react" ? "React" : "HTML"} | Файли: ${filesList}

ВАЖЛИВО: Відповідь 15-20 слів! Без заголовків, без емодзі. Що не так + як виправити.`;

    const userContent: any[] = [
      {
        type: "image_url",
        image_url: {
          url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`,
        },
      },
      {
        type: "text",
        text: userDescription 
          ? `Проблема: ${userDescription}`
          : "Знайди візуальні проблеми на скріншоті.",
      },
    ];

    console.log("Calling Lovable AI for screenshot analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Забагато запитів. Спробуйте пізніше." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Вичерпано ліміт. Поповніть баланс." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Не вдалося проаналізувати скріншот.";

    console.log("Screenshot analysis completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Screenshot analysis error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
