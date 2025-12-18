import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!prompt || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Improving prompt:", prompt.substring(0, 100) + "...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Ти супер досвідчений веб-розробник корпоративних сайтів. Пишеш грамотно та лаконічно.

ТВОЯ ЗАДАЧА: Переписати опис сайту у професійне технічне завдання.

ОБОВ'ЯЗКОВІ ВИМОГИ ДО ВІДПОВІДІ:
- Мінімум 5 сторінок: Головна, Про нас, Послуги, Контакти + додаткові за темою
- Чітка структура кожної сторінки (секції, блоки)
- Конкретні елементи UI без води
- Responsive дизайн (desktop, tablet, mobile)
- Зберігай мову оригіналу

ФОРМАТ ВІДПОВІДІ:
Назва сайту: [назва]
Тип: [корпоративний/лендінг/портфоліо]

Сторінки:
1. Головна - [секції через кому]
2. Про нас - [секції]
3. Послуги - [секції]
4. Контакти - [секції]
5. [Додаткова] - [секції]

Стиль: [кольори, шрифти, настрій]
Особливості: [ключові елементи]

ЗАБОРОНЕНО:
- Зайві пробіли та символи
- Повторення слів
- Вода та загальні фрази
- Пояснення що ти робиш

Відповідай ТІЛЬКИ технічним завданням, без вступу.`
          },
          {
            role: "user",
            content: prompt.trim()
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Занадто багато запитів. Спробуйте пізніше." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Необхідно поповнити баланс." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const improvedPrompt = data.choices?.[0]?.message?.content;

    if (!improvedPrompt) {
      throw new Error("No response from AI");
    }

    console.log("Prompt improved successfully");

    return new Response(
      JSON.stringify({ improvedPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error improving prompt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
