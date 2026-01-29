

# 🔧 Проблема з Cookie-банером в редакторі сайтів

## 📋 Що відбувається

Ти описав **дві** пов'язані проблеми:

### Проблема 1: Cookie-налаштування погано відображаються в превʼю

Система генерації інжектить складний cookie-банер з модальним вікном (~120 рядків HTML/CSS/JS) **перед закриваючим `</body>`**. Проблеми виникають тому що:

- Cookie-банер має **унікальні ID** (`lovable-cookie-banner`, `lovable-cookie-modal`) зі стилями
- Стилі примусово ховають будь-які інші cookie-банери: `#cookie-banner,.cookie-banner{display:none!important}`
- Скрипт читає `localStorage.cookiePreferences` - але в превʼю iframe це може працювати некоректно

### Проблема 2: Cookie-налаштування ламаються після редагування

Коли ШІ робить редагування файлу, відбувається наступне:

```
SEARCH/REPLACE стратегія → фрагмент cookie-банера збігається → частково перезаписується → HTML ламається
```

**Приклад поломки:**
- ШІ знаходить рядок `</body>` або `</div>` в cookie-блоці
- Замінює його, ненавмисно вбиваючи частину cookie-системи
- Результат: незакриті теги, зламаний JavaScript, сторінка не рендериться

---

## 🛠️ План виправлення

### 1. Захистити cookie-банер від AI-редагування

**Файл:** `supabase/functions/edit-website/index.ts`

Стратегія: перед тим як давати AI код сторінки, **вирізати cookie-блок** і після застосування змін **вставити його назад**.

```
До AI:
  HTML без cookie-блоку

Після AI:
  Застосувати зміни → Вставити cookie-блок назад
```

Технічно:
- Додати функцію `extractCookieBanner(html)` → повертає `{ cleanHtml, cookieBanner }`
- Додати функцію `restoreCookieBanner(html, cookieBanner)` → вставляє назад перед `</body>`

### 2. Виправити відображення cookie в превʼю

**Файл:** `src/lib/inlineAssets.ts`

Проблема в тому що базові стилі (`injectBaseStyles`) конфліктують з cookie-стилями.

Виправлення:
- Видалити дублюючі правила для `.cookie-banner` з `injectBaseStyles()`
- Cookie-банер вже має `position: fixed` і `z-index: 9999` в своїх інлайн-стилях

### 3. Додати перевірку цілісності cookie-банера

**Файл:** `supabase/functions/edit-website/index.ts`

Після застосування SEARCH/REPLACE блоків, перевіряти чи cookie-банер все ще валідний:

```typescript
function validateCookieBanner(html: string): boolean {
  const hasOpenTag = html.includes('id="lovable-cookie-banner"');
  const hasCloseTag = html.includes('<!-- End Cookie Banner -->');
  const hasScript = html.includes('cookiePreferences');
  return hasOpenTag && hasCloseTag && hasScript;
}
```

Якщо банер пошкоджено - відновити його з оригінального файлу.

---

## 📁 Файли для редагування

| Файл | Зміни |
|------|-------|
| `supabase/functions/edit-website/index.ts` | Додати захист cookie-блоку |
| `src/lib/inlineAssets.ts` | Видалити конфліктні стилі |

---

## 🔒 Технічні деталі

### Структура cookie-блоку для захисту

```html
<!-- Cookie Banner with Settings -->
<style>
  ...~70 рядків CSS...
</style>
<div id="lovable-cookie-banner">...</div>
<div id="lovable-cookie-modal">...</div>
<script>
  ...~30 рядків JS...
</script>
<!-- End Cookie Banner -->
```

### Regex для вирізання

```typescript
const COOKIE_BLOCK_REGEX = /<!--\s*Cookie Banner with Settings\s*-->[\s\S]*?<!--\s*End Cookie Banner\s*-->/i;
```

### Логіка в edit-website

```typescript
// Перед відправкою в AI
const relevantFilesClean = relevantFiles.map(f => {
  if (f.path.endsWith('.html')) {
    const match = f.content.match(COOKIE_BLOCK_REGEX);
    return {
      ...f,
      content: f.content.replace(COOKIE_BLOCK_REGEX, ''),
      _cookieBanner: match ? match[0] : null
    };
  }
  return f;
});

// Після застосування змін AI
const restoredFiles = modifiedFiles.map(f => {
  const original = relevantFilesClean.find(o => o.path === f.path);
  if (original?._cookieBanner && !f.content.includes('lovable-cookie-banner')) {
    // Вставити назад перед </body>
    return {
      ...f,
      content: f.content.replace('</body>', original._cookieBanner + '\n</body>')
    };
  }
  return f;
});
```

