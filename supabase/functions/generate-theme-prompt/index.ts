import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Complete topic categories with all niches
const TOPIC_CATEGORIES: Record<string, string[]> = {
  // Финансы (Education)
  "Фінанси (Освіта)": [
    "Ведення бюджету",
    "Інвестування", 
    "Робота з криптовалютами",
    "Фінансова грамотність",
    "Побудова бізнесу",
    "Краудфандинг",
    "Фінансовий аналітик",
    "Трейдинг",
    "Машинне навчання у фінансах"
  ],
  
  // Здоровье (Education)
  "Здоров'я (Освіта)": [
    "Здоровий спосіб життя",
    "Правильне харчування",
    "Гімнастика",
    "Йога",
    "Вегетаріанство",
    "Кросфіт"
  ],
  
  // Красота (Education)
  "Краса (Освіта)": [
    "Манікюр",
    "Візажист",
    "Стиліст",
    "Перукар"
  ],
  
  // Изучение иностранных языков
  "Вивчення іноземних мов": [
    "Англійська мова",
    "Польська мова",
    "Німецька мова",
    "Іспанська мова",
    "Французька мова",
    "Італійська мова",
    "Португальська мова",
    "Арабська мова",
    "Японська мова"
  ],
  
  // Саморазвитие
  "Саморозвиток": [
    "Підвищення мотивації",
    "Медитація",
    "Особистісний ріст",
    "Психологія",
    "Коучинг",
    "Сімейні відносини",
    "Вивчення релігій",
    "Побудова командної роботи",
    "Астрологія",
    "Дейтинг",
    "Креативність"
  ],
  
  // Карьерный рост
  "Кар'єрний ріст": [
    "Туроператор",
    "Маркетолог",
    "Дизайнер",
    "Менеджмент",
    "Журналістика",
    "Флорист",
    "Організатор свят",
    "Акторська майстерність",
    "Кіберспорт",
    "Туристичний гід",
    "Торгівля на маркетплейсах",
    "Еколог",
    "Юрист",
    "Ріелтор",
    "Соціальний працівник",
    "Стрімінг",
    "Нафта",
    "Газ",
    "Енергетика"
  ],
  
  // Творчество
  "Творчість": [
    "Письменництво",
    "Кулінарія",
    "Малювання",
    "Фотограф",
    "Музика",
    "Танці"
  ],
  
  // IT
  "IT (Освіта)": [
    "Розробка мобільних ігор",
    "Програмування",
    "Відеомонтаж",
    "Основи блокчейну",
    "Веб-дизайн",
    "Системний адміністратор",
    "SEO-спеціаліст",
    "Розробник AR/VR ігор",
    "3D-дизайн для ігор",
    "ШІ (штучний інтелект)",
    "Кібербезпека"
  ],
  
  // === УСЛУГИ (Services) ===
  
  // Финансы (Услуги)
  "Фінанси (Послуги)": [
    "Побудова бізнесу",
    "Управління бюджетом",
    "Фінансове консультування",
    "Фінансова підтримка",
    "Бухгалтерський облік",
    "Фінансовий аудит",
    "Автоматизація фінансових процесів",
    "ШІ-рішення для управління фінансами"
  ],
  
  // Здоровье (Услуги)
  "Здоров'я (Послуги)": [
    "Йога",
    "Гімнастика",
    "Кросфіт",
    "Нутриціологія",
    "Здоров'я людей похилого віку",
    "Масаж та релаксація",
    "Антистрес-терапія"
  ],
  
  // Саморазвитие (Услуги)
  "Саморозвиток (Послуги)": [
    "Лайф-коучинг",
    "Психологія",
    "Сімейне консультування",
    "Медитація",
    "Розвиток лідерства"
  ],
  
  // Красота (Услуги)
  "Краса (Послуги)": [
    "Манікюр",
    "Візажист",
    "Стиліст",
    "Перукар"
  ],
  
  // Профессиональные услуги
  "Професійні послуги": [
    "Туроператор",
    "Цифровий маркетинг",
    "Графічний дизайн",
    "Проектне управління",
    "Журналістика",
    "Флористика",
    "Івент-менеджмент",
    "Актор",
    "Торгівля на маркетплейсах",
    "Екологічне консультування",
    "Соціальна робота",
    "Перекладач",
    "Таргетована реклама",
    "Контент-менеджмент"
  ],
  
  // Креативность (Услуги)
  "Креативність (Послуги)": [
    "Копірайтер",
    "Кулінар",
    "Художник",
    "Фотограф",
    "Музикант"
  ],
  
  // IT (Услуги)
  "IT (Послуги)": [
    "Розробка мобільних додатків",
    "Програмування",
    "Відеомонтаж",
    "Веб-дизайн",
    "SEO",
    "Системне адміністрування",
    "AR/VR розробка",
    "3D-дизайн",
    "ШІ (штучний інтелект)",
    "Кібербезпека",
    "Розробка ігор",
    "Тестування ПЗ",
    "Блокчейн-розробка",
    "Розробка чат-ботів",
    "Управління базами даних"
  ]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, siteName, geo, phone, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!topic || topic.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Generating prompt for topic:", topic);
    console.log("Site name:", siteName || "not specified");
    console.log("Geo:", geo || "not specified");
    console.log("Language:", language || "not specified");

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

ТВОЯ ЗАДАЧА: На основі вказаної тематики/ніші створити детальний, структурований, професійний опис сайту для генерації.

ПРАВИЛА:
1. Створи КОНКРЕТНИЙ опис бізнесу/сервісу в даній ніші
2. Придумай креативну назву компанії (якщо не вказана)
3. Опиши основні послуги/продукти
4. Вкажи цільову аудиторію
5. Опиши ключові переваги та унікальні пропозиції
6. Вкажи стиль дизайну (сучасний, мінімалістичний, корпоративний тощо)
7. Опиши основні секції сайту
8. Якщо вказано гео - адаптуй контент під цю країну/регіон
9. Якщо вказано телефон - включи його в опис

ФОРМАТ ВІДПОВІДІ:
- Пиши одним суцільним текстом без розмітки
- Опис має бути 150-300 слів
- Пиши мовою, вказаною в запиті (за замовчуванням українська)
- Будь конкретним та деталізованим
- Без зайвих вступів та пояснень

ПРИКЛАД для теми "Йога":
"Сайт для студії йоги YogaHarmony - сучасний wellness-центр, що спеціалізується на хатха-йозі, віньяса-йозі та медитативних практиках. Основна аудиторія - жінки та чоловіки 25-55 років, які прагнуть покращити фізичне та ментальне здоров'я. Ключові послуги: групові заняття для початківців та досвідчених практиків, індивідуальні сесії з сертифікованими інструкторами, онлайн-курси йоги, ретрити вихідного дня. Унікальні переваги: затишний простір з панорамними вікнами, безкоштовне перше заняття, гнучкий графік з ранку до вечора. Дизайн сайту має бути мінімалістичним з використанням природних кольорів (зелений, бежевий, білий), якісними фото практик, плавними анімаціями. Секції: головна з hero-банером, розклад занять, наші інструктори, прайс-лист з абонементами, галерея студії, відгуки клієнтів, контакти з картою та формою запису."`,
          },
          {
            role: "user",
            content: buildUserPrompt(topic.trim(), siteName, geo, phone, language),
          },
        ],
      }),
    });

    function buildUserPrompt(topic: string, siteName?: string, geo?: string, phone?: string, language?: string): string {
      let fullPrompt = `ТЕМАТИКА/НІША: ${topic}`;
      
      if (siteName) {
        fullPrompt += `\nНАЗВА САЙТУ/КОМПАНІЇ: ${siteName}`;
      }
      
      if (geo) {
        fullPrompt += `\nГЕО/КРАЇНА: ${geo}`;
      }
      
      if (phone) {
        fullPrompt += `\nКОНТАКТНИЙ ТЕЛЕФОН: ${phone}`;
      }
      
      if (language) {
        fullPrompt += `\nМОВА КОНТЕНТУ: ${language}`;
      }
      
      fullPrompt += "\n\nСтвори детальний опис сайту для цієї ніші.";
      
      return fullPrompt;
    }

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
          JSON.stringify({ error: "Недостатньо кредитів Lovable AI. Зверніться до адміністратора." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    if (!responseText || responseText.trim().length === 0) {
      console.error("Empty response from AI gateway");
      throw new Error("Порожня відповідь від AI. Спробуйте ще раз.");
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Помилка парсингу відповіді AI. Спробуйте ще раз.");
    }

    const generatedPrompt = data.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      console.error("No content in AI response:", JSON.stringify(data).substring(0, 500));
      throw new Error("AI не повернув результат. Спробуйте ще раз.");
    }

    console.log("Prompt generated successfully, length:", generatedPrompt.length);

    return new Response(
      JSON.stringify({ 
        generatedPrompt: String(generatedPrompt).trim(),
        categories: TOPIC_CATEGORIES 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error generating theme prompt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
