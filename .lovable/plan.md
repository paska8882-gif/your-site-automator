
# План: Виправлення кольорової схеми, стилю та брендінгу

## Виявлені проблеми

### Проблема 1: Логотип і фавікон завжди зелені
**Файл:** `supabase/functions/generate-website/index.ts` (рядки 2487-2510)

Функція `ensureFaviconAndLogoInFiles` має хардкоджені кольори:
```
stop-color="#10b981"  // Зелений - завжди!
stop-color="#047857"  // Темно-зелений - завжди!
```

Ці кольори ніколи не змінюються, незалежно від вибраної схеми.

### Проблема 2: AI не знає про вибрану кольорову схему
**Файл:** `supabase/functions/generate-website/index.ts` (рядки 5666-5679)

Промпт до AI НЕ включає вибрану кольорову схему. AI просто каже "Generate a UNIQUE color palette based on the industry" - і генерує що хоче.

Кольорова схема застосовується ТІЛЬКИ в `ensureQualityCSS()` (рядок 6316-6345) - це вже ПІСЛЯ генерації, коли AI вже написав свої кольори.

### Проблема 3: Layout style не примушує AI
AI отримує опис стилю макету, але без жорстких маркерів "MANDATORY" - тому часто ігнорує.

---

## Рішення

### 1. Передати кольорову схему логотипу/фавікону

**Файл:** `supabase/functions/generate-website/index.ts`

**Зміни:**
```text
Функція ensureFaviconAndLogoInFiles:
- Додати параметр colorScheme?: { primary: string; accent: string }
- Замінити хардкоджені #10b981 та #047857 на colorScheme.primary та colorScheme.accent
- Якщо colorScheme не передано - використовувати дефолт
```

**Оновити виклик:**
```typescript
// Рядок 8555: передати кольорову схему
const selectedScheme = COLOR_SCHEMES.find(s => s.name === colorScheme) || COLOR_SCHEMES[0];
enforcedFiles = ensureFaviconAndLogoInFiles(enforcedFiles, desiredSiteName, {
  primary: selectedScheme.primary,
  accent: selectedScheme.accent
});
```

### 2. Додати кольорову схему в AI промпт

**Файл:** `supabase/functions/generate-website/index.ts` (рядки 5666-5679)

**Перед формуванням websiteRequestBody:**
```typescript
// Отримати HEX кольори вибраної схеми
let mandatoryColorSection = "";
if (userColorScheme) {
  const scheme = COLOR_SCHEMES.find(s => s.name === userColorScheme);
  if (scheme) {
    mandatoryColorSection = `
⚠️⚠️⚠️ MANDATORY COLOR PALETTE - YOU MUST USE THESE EXACT COLORS! ⚠️⚠️⚠️

Color Scheme: "${scheme.name}"
PRIMARY COLOR: ${scheme.primary} (main brand color - buttons, links, accents)
SECONDARY COLOR: ${scheme.secondary} (darker variant - hovers, headers)
ACCENT COLOR: ${scheme.accent} (highlights, CTAs, icons)
BACKGROUND LIGHT: ${scheme.bgLight} (section backgrounds)
BORDER COLOR: ${scheme.border} (borders, dividers)
HEADING TEXT: ${scheme.heading} (all headings)
BODY TEXT: ${scheme.text} (paragraphs, descriptions)

⚠️ USE THESE EXACT HEX CODES IN YOUR CSS! DO NOT CHANGE THEM!
⚠️ Primary buttons = ${scheme.primary}
⚠️ Links = ${scheme.primary}  
⚠️ Section highlights = ${scheme.bgLight}
⚠️ All colored elements MUST use these colors!

`;
  }
}
```

**В промпт (рядок 5677):**
```typescript
content: `${HTML_GENERATION_PROMPT}\n\n${mandatoryColorSection}${imageStrategy}\n\n...`
```

### 3. Посилити Layout Style директиви

**Файл:** `supabase/functions/generate-website/index.ts` (рядок 5677)

Замінити:
```
=== MANDATORY LAYOUT STRUCTURE (FOLLOW EXACTLY) ===
${selectedLayout.description}
```

На:
```
⚠️⚠️⚠️ MANDATORY LAYOUT STRUCTURE - NON-NEGOTIABLE! ⚠️⚠️⚠️
LAYOUT STYLE: "${selectedLayout.name}"

${selectedLayout.description}

⚠️ YOU MUST FOLLOW THIS LAYOUT EXACTLY!
⚠️ Hero section MUST match the layout description above!
⚠️ Card grids MUST use the specified arrangement!
⚠️ IF YOU IGNORE THIS LAYOUT = GENERATION FAILURE!
```

---

## Файли для зміни

| Файл | Зміни |
|------|-------|
| `supabase/functions/generate-website/index.ts` | 1. Оновити `ensureFaviconAndLogoInFiles` для прийому кольорової схеми |
| | 2. Оновити виклик функції (рядок 8555) |
| | 3. Додати `mandatoryColorSection` в промпт (рядок ~5660) |
| | 4. Посилити layout style директиви (рядок 5677) |
| `supabase/functions/generate-php-website/index.ts` | Аналогічні зміни для PHP генератора |

---

## Результат

**До:**
- Логотип/фавікон: завжди зелений
- AI кольори: випадкові, ігнорує вибір
- Layout: часто ігнорується

**Після:**
- Логотип/фавікон: відповідає вибраній схемі (синій/червоний/фіолетовий...)
- AI кольори: жорстко прописані HEX у промпті
- Layout: MANDATORY директиви з попередженнями
