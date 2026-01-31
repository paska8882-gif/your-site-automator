
# Plan: Виправити VIP генерацію - правильна підстановка домену, адреси, телефону

## Виявлені проблеми

### Проблема 1: КРИТИЧНИЙ БАГ - VIP prompt перезаписується при наявності geo
У файлі `supabase/functions/generate-website/index.ts` рядок 10283:
```typescript
promptForGeneration = `${prompt}\n\n[TARGET COUNTRY: ${countryName}]...
```
Коли є geo параметр, він бере **`prompt`** (оригінальний) замість **`promptForGeneration`** (який вже містить vipPrompt). Це повністю втрачає VIP prompt!

**Такий самий баг є в:**
- `generate-php-website/index.ts`
- `generate-react-website/index.ts`

### Проблема 2: VIP prompt шаблон не має примусових інструкцій
Поточний VIP_TEMPLATE в `generate-vip-prompt/index.ts` просто перелічує дані, але не містить:
- **Примусових інструкцій** для AI використовувати ці конкретні дані
- **Заборон** на вигадування інших адрес/телефонів
- **Чітких маркерів** для post-processing

### Проблема 3: max_tokens занадто малий для VIP
VIP генерація має більше контенту (детальна структура сторінок, дизайн), але max_tokens = 2000 для AI виклику page structure та 1000 для design - це може обрізати відповідь.

## Виправлення

### 1. Виправити баг з prompt vs promptForGeneration (3 файли)
**Файли:**
- `supabase/functions/generate-website/index.ts`
- `supabase/functions/generate-php-website/index.ts`
- `supabase/functions/generate-react-website/index.ts`

**Зміна рядка 10283 (та аналогічних):**
```typescript
// БУЛО (НЕПРАВИЛЬНО):
promptForGeneration = `${prompt}\n\n[TARGET COUNTRY: ${countryName}]...

// СТАЛО (ПРАВИЛЬНО):
promptForGeneration = `${promptForGeneration}\n\n[TARGET COUNTRY: ${countryName}]...
```

### 2. Оновити VIP_TEMPLATE з примусовими інструкціями
**Файл:** `supabase/functions/generate-vip-prompt/index.ts`

Додати примусовий преамбулу:
```text
⚠️⚠️⚠️ MANDATORY VIP DATA - NON-NEGOTIABLE! ⚠️⚠️⚠️

THE FOLLOWING DATA MUST APPEAR EXACTLY AS PROVIDED:
- Domain: {domain} → Use in meta tags, JSON-LD, sitemap
- Name: {siteName} → Use in logo, title, footer, copyright
- Address: {address} → Use in contact page AND footer
- Phone: {phone} → Use in contact page AND footer (with tel: link)

⛔ FORBIDDEN:
- DO NOT invent different address
- DO NOT generate random phone number
- DO NOT change the site name
- DO NOT use placeholder data like "123 Main St" or "+1 555-1234"

✅ REQUIRED:
- Phone MUST be clickable: <a href="tel:{phoneDigits}">{phone}</a>
- Address MUST appear on contact.html AND in footer
- Name MUST appear in logo and copyright

Domain: {domain}
Name: {siteName}
Geo: {geo}
...
```

### 3. Збільшити max_tokens для VIP генерації
**Файл:** `supabase/functions/generate-vip-prompt/index.ts`

```typescript
// Page structure generation
max_tokens: 4000,  // було 2000

// Design generation  
max_tokens: 2000,  // було 1000
```

### 4. Додати post-processing валідацію для VIP даних
**Файл:** `supabase/functions/generate-website/index.ts`

Створити функцію `enforceVipDataInFiles()` яка:
1. Знаходить телефон з VIP prompt та примусово підставляє його
2. Знаходить адресу з VIP prompt та перевіряє її наявність
3. Перевіряє наявність site name в логотипі та footer

### 5. Передавати VIP дані окремими параметрами для post-processing
На фронтенді додати парсинг VIP prompt для отримання:
- vipPhone
- vipAddress
- vipSiteName

Передавати їх як окремі параметри в body запиту.

## Технічні деталі

### Файли для зміни:

| Файл | Зміни |
|------|-------|
| `generate-website/index.ts` | Виправити prompt → promptForGeneration, додати enforceVipDataInFiles() |
| `generate-php-website/index.ts` | Виправити prompt → promptForGeneration, додати enforceVipDataInFiles() |
| `generate-react-website/index.ts` | Виправити prompt → promptForGeneration |
| `generate-vip-prompt/index.ts` | Оновити VIP_TEMPLATE з примусовими інструкціями, збільшити max_tokens |
| `src/lib/websiteGenerator.ts` | Парсити vipPrompt для отримання phone/address |

### Приклад оновленого VIP_TEMPLATE:

```text
⚠️⚠️⚠️ CRITICAL VIP GENERATION - ALL DATA BELOW IS MANDATORY! ⚠️⚠️⚠️

YOU MUST USE THESE EXACT VALUES - NO EXCEPTIONS:

📍 SITE IDENTITY (USE EXACTLY):
   Domain: {domain}
   Business Name: {siteName}
   
📞 CONTACT DETAILS (MANDATORY ON CONTACT PAGE + FOOTER):
   Phone: {phone}
   Address: {address}
   
🌍 LOCALIZATION:
   Target Country: {geo}
   Language: {language}

⛔ ABSOLUTELY FORBIDDEN:
   - Using different phone number
   - Using different address
   - Using different business name
   - Making up placeholder contact details

✅ VERIFICATION CHECKLIST:
   □ Phone "{phone}" appears in footer with tel: link
   □ Phone "{phone}" appears on contact page
   □ Address "{address}" appears in footer
   □ Address "{address}" appears on contact page  
   □ Business name "{siteName}" in logo
   □ Business name "{siteName}" in copyright
   □ Domain "{domain}" in canonical URL

═══════════════════════════════════════════════════════════════

Topic: {topic}
Type: Information Platform + {typeDescription}
Description: {description}
Keywords: {keywords}
Banned words: {bannedWords}

{pageStructure}

{design}

Technology: HTML5 / CSS3 / Vanilla JS; responsive; semantic markup; JSON-LD schema; meta tags; hreflang={hreflang}; sitemap.xml + robots.txt
```

## Послідовність реалізації

1. **Виправити критичний баг** (prompt → promptForGeneration) в усіх 3 edge functions
2. **Оновити VIP_TEMPLATE** з примусовими інструкціями
3. **Збільшити max_tokens** для AI викликів
4. **Додати post-processing** для VIP даних
5. **Протестувати** VIP генерацію з різними geo/language комбінаціями

## Очікуваний результат

- VIP prompt більше не втрачається при наявності geo
- AI отримує чіткі примусові інструкції використовувати надані дані
- Post-processing перевіряє та гарантує наявність phone/address
- Генеровані сайти мають правильні контактні дані
