
## Анализ апелляций и проблем с промптом

### Что я нашёл в апелляциях за сегодня

**Статистика жалоб (9 апелляций, все Israel + Russian):**
- "огромные иконки" — 3 случая
- "контактная информация не совпадает с промптом" — 3 случая  
- "кривые блоки" — 1 случай
- "побудова вайта виглядає погано" / "виконана погано" — 2 случая
- "пустой вайт" — 1 случай

---

### Критические баги в промпте (найдены в коде)

**Проблема 1: Огромные иконки (самая частая)**

В промпте нет НИ ОДНОГО явного ограничения на размер SVG-иконок и emoji-иконок. Промпт описывает "3 columns with icons" (layout "Classic Corporate"), "4-column grid with formal icons" (layout "Business Serious") — но не говорит ИИ какой должен быть максимальный размер иконки. Gemini 2.5 Pro самостоятельно рендерит иконки 80–120px и даже больше. В CSS guard-ах есть:
```css
img, svg, video { max-width: 100%; height: auto; }
```
Но это не ограничивает SVG-иконки по `width/height` явно. Нет строки типа `.feature-icon svg, .service-icon svg { width: 48px; height: 48px; max-width: 48px; }`.

**Проблема 2: Контактные данные не совпадают с промптом**

В промпте (improved_prompt) уже есть адреса типа:
- "Улица Герцль 15, Тель-Авив" — для Israel
- Но потом в `contactDataSection` генерируется НОВЫЙ адрес через `generateRealisticAddress(geo)` — и для Israel нет специфической логики! Функция `generateRealisticAddress` не имеет case для Israel, поэтому падает в дефолт. Дефолт — Germany (`+49 30 ...`). А функция `generateRealisticPhone` — тоже не имеет case для Israel (нет "+972"). Поэтому телефон генерируется как дефолт (Germany) или US-формат, хотя в improved_prompt уже прописан израильский адрес.

При этом в `contactDataSection` написано: "USE THESE EXACT VALUES - DO NOT INVENT YOUR OWN!" — и ИИ слушается, заменяя правильный израильский адрес из improved_prompt на случайный американский/немецкий.

**Проблема 3: Кривые блоки / плохой layout**

Промпт содержит противоречия:
- В одном месте: `hero { max-height: 70vh }` (из `IMAGE_CSS`)  
- В другом месте: guard добавляет `min-height: clamp(420px, 70vh, 720px) !important`
- Плюс `section { padding: 80px 0 }` конфликтует с `clamp(56px, 7vw, 96px)`

Это создаёт каскадные CSS-конфликты в результирующем HTML.

**Проблема 4: Пустой сайт**

Ограничение `MAX_REFINED_PROMPT_CHARS = 6000` обрезает refinedPrompt по середине предложения. Это может привести к ситуации когда контент бизнеса обрывается, и ИИ генерирует пустые/заглушечные секции.

**Проблема 5: Одинаковая цветовая палитра у всех сайтов**

В improved_prompt у ВСЕХ апелляций одна и та же палитра:
```
Palette: Профессиональный синий (#3b82f6), Нейтральный серый (#6b7280), Чистый белый (#f9fafb)
```
Это происходит потому что промпт `improve-prompt` всегда генерирует "Профессиональный синий" как дефолт для любой тематики. Флористика, кулинария, медитация — всё синее.

---

### Что нужно исправить

**Fix 1 — Иконки (КРИТИЧНО): добавить CSS-ограничения на иконки в глобальный guard**

В функции `injectImageGuardCSS` (строки 3155-3157) и `injectLayoutNormalizerCSS` (строки 3181-3184) добавить правило:
```css
/* ICON SIZE CONSTRAINTS - MANDATORY */
.feature-icon, .service-icon, .icon-box, .icon-wrapper,
.card-icon, .why-icon, .step-icon, .benefit-icon {
  width: 56px !important;
  height: 56px !important;
  max-width: 56px !important;
  max-height: 56px !important;
  font-size: 28px !important;
  line-height: 56px !important;
}
.feature-icon svg, .service-icon svg, .icon-box svg,
.icon-wrapper svg, .card-icon svg {
  width: 28px !important;
  height: 28px !important;
}
```

И добавить явный запрет в текст промпта HTML_GENERATION_PROMPT:
```
ICON SIZE RULES (NON-NEGOTIABLE):
- Feature/service icons: MAXIMUM 56px container, 28px icon inside
- Never use font-size > 2rem for icons
- Never use width/height > 80px for icon containers
- Emoji icons: font-size: 1.75rem MAXIMUM
```

**Fix 2 — Контакты для Israel (КРИТИЧНО): добавить case для Israel**

В функции `generateRealisticPhone` добавить:
```typescript
// Israel +972
if (geoLower.includes("israel") || geoLower.includes("ізраїл") || geoLower.includes("израиль") || hasGeoCode("il")) {
  const areaCodes = ["2", "3", "4", "8", "9"];
  return `+972 ${pick(areaCodes)}-${randomDigits(3)}-${randomDigits(4)}`;
}
```

В функции `generateRealisticAddress` добавить case для Israel со страницами в формате `רחוב ... / улица ..., Тель-Авив, Израиль`.

**Fix 3 — Конфликты CSS**: Унифицировать padding/min-height значения в guard-ах. Убрать дублирующийся `section { padding: 80px 0 }` из промпта (строка 6303), заменив его на `clamp(56px, 7vw, 96px)` везде.

**Fix 4 — Обрезка промпта**: Увеличить `MAX_REFINED_PROMPT_CHARS` с 6000 до 8000 или убрать этот лимит полностью (refined prompt это Stage 1, он входит в Stage 2 как user content — обрезка здесь создаёт пустые блоки).

**Fix 5 — Разнообразие палитр**: В функции `improve-prompt` — уже сгенерированная палитра `#3b82f6` это дефолт ИИ. Нужно в промпте для improve-prompt явно требовать "DO NOT use #3b82f6 as primary color — generate UNIQUE palette based on the business theme/industry".

---

### Технические файлы для изменения

1. `supabase/functions/generate-website/index.ts`:
   - Строки ~3155-3157: добавить icon constraints в `injectImageGuardCSS`
   - Строки ~3181-3184: добавить icon constraints в `injectLayoutNormalizerCSS`
   - Строки ~263-546: добавить Israel case в `generateRealisticPhone`
   - Строки ~550-900+: добавить Israel case в `generateRealisticAddress`
   - Строки ~5803-5823: добавить ICON SIZE RULES в HTML_GENERATION_PROMPT
   - Строка ~8110: увеличить MAX_REFINED_PROMPT_CHARS до 8000

2. `supabase/functions/improve-prompt/index.ts`:
   - Добавить запрет на стандартный синий в палитру

---

### Приоритет исправлений

```text
ПРИОРИТЕТ 1 (исправляет 3/9 жалоб): Israel телефон + адрес
ПРИОРИТЕТ 2 (исправляет 3/9 жалоб): Icon size constraints (CSS guard + промпт)
ПРИОРИТЕТ 3 (исправляет 2/9 жалоб): CSS конфликты layout
ПРИОРИТЕТ 4 (исправляет 1/9 жалоб): Обрезка промпта
ПРИОРИТЕТ 5 (общий): Разнообразие палитр
```
