
# План: Покращення генерації промптів до рівня прикладу

## Проблема
Поточні функції `improve-prompt` та `generate-theme-prompt` генерують або занадто довгі ТЗ, або занадто короткі описи без структури. Потрібен компактний, структурований brief як у прикладі користувача.

---

## Цільовий формат (як в прикладі)

```text
[domain] ([industry])

Company Name: [name] ([owners if relevant])
Geo: [country/region]
Language: [language]
Industry: [industry type]
Core Theme: [one sentence core business description]

1. Company Overview
[2-3 sentences about what the company does]

2. Tone & Editorial Identity
Tone: [4 descriptive words]
Audience: [target audience]
Principles: [4-5 key principles]

3. Website Architecture
index.html: Hero "[tagline]"; [3-4 sections with descriptions]
[page2].html: [sections]
[page3].html: [sections]
[page4].html: [sections]
contact.html: [contact form + details]

4. Visual Direction
Palette: [Color Name] (#HEX), [Color Name], [Accent Color]
Imagery: [4-5 specific image types]

5. Technical & SEO
SEO: "[keyword1]", "[keyword2]", "[keyword3]", "[keyword4]"
JSON-LD: [Schema.org type]

6. Keywords & Restrictions
Keywords: [8-12 relevant keywords]
Restrictions: Do not use: [banned words list]
```

---

## Технічні зміни

### 1. Оновити `improve-prompt/index.ts`

**Новий системний промпт:**
- Генерувати brief у форматі прикладу
- Автоматично придумувати реалістичну адресу по гео
- Генерувати телефон у форматі країни
- Підбирати SEO keywords по ніші
- Визначати JSON-LD тип
- Підбирати кольорову палітру по темі

### 2. Оновити `generate-theme-prompt/index.ts`

**Повністю переписати:**
- Замість 150-300 слів генерувати повноцінний brief
- Включати всі 6 секцій з прикладу
- Автоматично генерувати:
  - Креативну назву компанії
  - Реалістичну адресу по гео
  - Телефон по гео
  - 5 сторінок архітектури
  - Кольорову палітру по ніші
  - SEO keywords

### 3. Додати утилітні функції

**Нові helper-функції:**
```typescript
// Генерація реалістичного телефону по гео
function generatePhoneByGeo(geo: string): string

// Генерація реалістичної адреси по гео  
function generateAddressByGeo(geo: string): string

// Підбір JSON-LD типу по ніші
function getSchemaType(industry: string): string

// Підбір кольорової палітри по ніші
function getColorPaletteByIndustry(industry: string): {name: string, hex: string}[]

// Генерація SEO keywords по ніші
function generateSEOKeywords(industry: string, geo: string): string[]
```

---

## Детальна реалізація

### A. Новий системний промпт для `improve-prompt`

```text
You are an expert website brief writer. Create a STRUCTURED website brief in this EXACT format:

[domain] ([industry])

Company Name: [Creative business name]
Geo: [Country from input]
Language: [Language from input]
Industry: [Industry/Niche]
Core Theme: [One sentence describing the core business]

1. Company Overview
[2-3 sentences describing what the company does, their specialization, and unique value]

2. Tone & Editorial Identity
Tone: [4 descriptive words matching the industry]
Audience: [Specific target audience description]
Principles: [4-5 core business principles]

3. Website Architecture
index.html: Hero "[Catchy tagline]"; [3-4 specific sections]
[service-page].html: [Relevant sections]
[about-page].html: [Relevant sections]  
[resources-page].html: [Relevant sections]
contact.html: [Contact form + location details]

4. Visual Direction
Palette: [Primary Color Name] (#HEX), [Secondary], [Accent]
Imagery: [4-5 specific image types for this industry]

5. Technical & SEO
SEO: "[keyword1]", "[keyword2]", "[keyword3]", "[keyword4]"
JSON-LD: [Appropriate Schema.org type]

6. Keywords & Restrictions
Keywords: [8-12 industry-relevant keywords]
Restrictions: Do not use: [standard banned words]

CRITICAL RULES:
- Use the EXACT phone number if provided
- Generate REALISTIC address for the geo/country
- Keep brief COMPACT - no more than 400 words total
- Make content UNIQUE and SPECIFIC to the niche
- Include REAL HEX color codes that match the industry
```

### B. Приклади по нішах

| Ніша | Palette | JSON-LD | Tone |
|------|---------|---------|------|
| IT/Tech | Deep Blue (#0d4f8b), Steel Gray | ITService | Technical, Innovative, Reliable |
| Health | Healing Green (#2d8f5e), Calm Teal | MedicalBusiness | Caring, Professional, Trusted |
| Finance | Midnight Navy (#1a365d), Gold Accent | FinancialService | Strategic, Dependable, Expert |
| Beauty | Rose Pink (#e8507b), Soft Lavender | BeautyService | Elegant, Modern, Luxurious |
| Legal | Corporate Blue (#234e70), Brass | LegalService | Authoritative, Trustworthy |
| Food | Warm Orange (#e67e22), Fresh Green | Restaurant | Appetizing, Welcoming, Fresh |

### C. Генерація телефону по гео

```typescript
const GEO_PHONE_FORMATS = {
  "Canada": { code: "+1", format: "XXX-XXX-XXXX", area: ["416", "604", "514"] },
  "USA": { code: "+1", format: "XXX-XXX-XXXX", area: ["212", "310", "312"] },
  "UK": { code: "+44", format: "XXXX XXXXXX", area: ["20", "161", "141"] },
  "Germany": { code: "+49", format: "XXX XXXXXXXX", area: ["30", "89", "40"] },
  "France": { code: "+33", format: "X XX XX XX XX", area: ["1", "4", "6"] },
  // ... 30+ countries
};
```

### D. Генерація адреси по гео

```typescript
const GEO_ADDRESS_TEMPLATES = {
  "Canada": {
    cities: ["Toronto", "Vancouver", "Montreal", "Calgary"],
    streets: ["Bay Street", "Main Street", "King Street", "Granville Street"],
    format: "{number} {street}, {city}, {province} {postal}"
  },
  // ... інші країни
};
```

---

## Порядок впровадження

| # | Крок | Файл |
|---|------|------|
| 1 | Додати helper-функції для гео-даних | `improve-prompt/index.ts` |
| 2 | Переписати системний промпт | `improve-prompt/index.ts` |
| 3 | Додати той самий формат | `generate-theme-prompt/index.ts` |
| 4 | Оновити VIP генерацію | `generate-vip-prompt/index.ts` |
| 5 | Задеплоїти Edge Functions | — |
| 6 | Тестування | — |

---

## Очікуваний результат

**До (поточний improve-prompt):**
```
ТЕХНІЧНЕ ЗАВДАННЯ
ЗАГАЛЬНА ІНФОРМАЦІЯ
- Назва проекту: ...
- Тип сайту: корпоративний
[... 1000+ слів нечитабельного тексту ...]
```

**Після (новий формат):**
```
bosman-fish.com (Maritime Fleet IT)

Company Name: BOSMAN-FISH Maritime IT
Geo: Canada (Atlantic & Pacific Coasts)
Language: English
Industry: IT Services / Maritime Logistics
Core Theme: Developing maritime fleet management systems...

1. Company Overview
BOSMAN-FISH Maritime IT specializes in digital navigation...

2. Tone & Editorial Identity
Tone: Strategic, Nautical, Dependable, Advanced
...
```

---

## Додаткові покращення

1. **Auto-detect language** - визначати мову з гео якщо не вказана
2. **Industry mapping** - автоматично мапити тему на індустрію
3. **Smart domain** - генерувати домен з назви якщо не вказано
4. **Validation** - перевіряти що всі секції заповнені
