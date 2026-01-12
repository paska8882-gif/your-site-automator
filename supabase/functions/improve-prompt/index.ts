import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Normalize duplicate country code patterns produced by the model.
  // Examples:
  // - "+353+353 1 234 5678" -> "+353 1 234 5678"
  // - "+353 353 1 234 5678" -> "+353 1 234 5678"
  // - "tel:+3533531234567" -> "tel:+3531234567"
  const normalizeDuplicateCountryCodes = (text: string) => {
    let out = text;

    // 1) Two explicit +codes
    out = out.replace(/\+(\d{1,3})\s*\+\s*\1\b/g, (_m, code) => `+${code}`);

    // 2) "+code code" (second code without +)
    out = out.replace(/\+(\d{1,3})\s+\1\b/g, (_m, code) => `+${code}`);

    // 3) Digits form: "+353353..." (code repeated immediately)
    out = out.replace(/\+(\d{1,3})\1(\d{6,})\b/g, (_m, code, rest) => `+${code}${rest}`);

    return out;
  };

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
            content: `Ти супер досвідчений веб-розробник корпоративних сайтів з 15+ роками досвіду. Твоя спеціалізація - створення детальних технічних завдань для розробки професійних веб-сайтів.

ТВОЯ ЗАДАЧА: На основі короткого опису створити розгорнуте, структуроване, професійне технічне завдання на розробку сайту.

ОБОВ'ЯЗКОВА СТРУКТУРА ТЕХНІЧНОГО ЗАВДАННЯ:

ЗАГАЛЬНА ІНФОРМАЦІЯ
- Назва проекту та домен
- Тип сайту: корпоративний / лендінг / портфоліо / каталог / блог
- Цільова аудиторія та її потреби
- Ключові цілі та задачі сайту
- Конкурентні переваги що мають бути відображені

АРХІТЕКТУРА САЙТУ (мінімум 5-7 сторінок)
Для кожної сторінки детально опиши:

1. ГОЛОВНА СТОРІНКА
- Hero-секція: заголовок, підзаголовок, CTA-кнопка, фонове зображення/відео
- Секція переваг: 4-6 ключових переваг з іконками
- Секція послуг: картки послуг з описом та посиланнями
- Секція про компанію: коротка історія, місія, цінності
- Секція відгуків: слайдер з відгуками клієнтів
- Секція партнерів/клієнтів: логотипи
- Секція CTA: заклик до дії з формою
- Секція новин/блогу: останні публікації

2. ПРО НАС
- Hero з заголовком та зображенням команди
- Історія компанії: таймлайн розвитку
- Місія та цінності: блоки з іконками
- Команда: фото, імена, посади, соцмережі
- Досягнення: цифри та факти
- Сертифікати та нагороди

3. ПОСЛУГИ
- Каталог послуг: картки з детальним описом
- Для кожної послуги: опис, переваги, процес роботи
- Ціни або CTA для отримання пропозиції
- FAQ по послугах

4. ПОРТФОЛІО / ПРОЕКТИ
- Галерея робіт з фільтрацією по категоріях
- Детальні кейси: задача, рішення, результат
- До/після якщо релевантно

5. КОНТАКТИ
- Контактна інформація: адреса, телефон, email
- Карта з розташуванням офісу
- Форма зворотного зв'язку: ім'я, телефон, email, повідомлення
- Графік роботи
- Соціальні мережі

6. БЛОГ / НОВИНИ (якщо релевантно)
- Список статей з пагінацією
- Категорії та теги
- Пошук по блогу

7. ДОДАТКОВІ СТОРІНКИ
- Політика конфіденційності
- Умови використання
- Сторінка 404

ДИЗАЙН ТА ВІЗУАЛЬНИЙ СТИЛЬ
- Колірна палітра: основний колір, акцентний, фоновий, текстовий
- Типографіка: шрифт заголовків, шрифт тексту, розміри
- Стиль: мінімалізм / корпоративний / креативний / елегантний / технологічний
- Іконки: лінійні / заливка / 3D
- Фотографії: професійні / lifestyle / абстрактні
- Анімації: scroll-анімації, hover-ефекти, transitions

ФУНКЦІОНАЛЬНІ ЕЛЕМЕНТИ
- Sticky навігація з мобільним меню (бургер)
- Breadcrumbs для внутрішніх сторінок
- Кнопка "Вгору"
- Cookie consent банер
- Форми з валідацією
- Інтеграція з Google Maps
- Соціальні кнопки
- Чат або callback віджет

ТЕХНІЧНІ ВИМОГИ
- Responsive: desktop (1920px), laptop (1366px), tablet (768px), mobile (375px)
- SEO: meta-теги, Open Graph, структуровані дані, sitemap.xml, robots.txt
- Швидкість завантаження: оптимізація зображень, lazy loading
- Доступність: WCAG 2.1 AA
- Кросбраузерність: Chrome, Firefox, Safari, Edge

ПРАВИЛА НАПИСАННЯ:
- Зберігай мову оригінального опису
- Пиши конкретно та професійно
- Кожен пункт має бути змістовним
- Без зайвих пробілів, переносів та спецсимволів
- Одразу починай з технічного завдання без вступних фраз`,
          },
          {
            role: "user",
            content: prompt.trim(),
          },
        ],
      }),
    });

    // Get response text first to safely handle empty/truncated responses
    const responseText = await response.text();
    console.log("AI response length:", responseText.length, "chars");

    if (!response.ok) {
      console.error("AI gateway error:", response.status, responseText.substring(0, 500));

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Занадто багато запитів. Спробуйте пізніше." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Недостатньо кредитів Lovable AI. Зверніться до адміністратора для поповнення." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Handle empty response
    if (!responseText || responseText.trim().length === 0) {
      console.error("Empty response from AI gateway");
      throw new Error("Порожня відповідь від AI. Спробуйте ще раз.");
    }

    // Parse JSON safely
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw response (first 500 chars):", responseText.substring(0, 500));
      throw new Error("Помилка парсингу відповіді AI. Спробуйте ще раз.");
    }

    const improvedPromptRaw = data.choices?.[0]?.message?.content;

    if (!improvedPromptRaw) {
      console.error("No content in AI response:", JSON.stringify(data).substring(0, 500));
      throw new Error("AI не повернув результат. Спробуйте ще раз.");
    }

    const improvedPrompt = normalizeDuplicateCountryCodes(String(improvedPromptRaw));

    console.log("Prompt improved successfully, length:", improvedPrompt.length);

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
