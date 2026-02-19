
## Анализ проблемы: компоненты не на своих местах

### Что найдено в коде

Проблема не одна — их четыре, и они работают совместно, создавая каскадный эффект. Каждая из них действует на разных уровнях пайплайна.

---

### Проблема 1: `injectBaseStyles` (preview) ломает навигацию на мобильных

**Файл:** `src/lib/inlineAssets.ts`, строки 491–496 и 500–510

В preview-обработчике (который применяется при отображении в редакторе) есть следующий CSS:

```text
@media (max-width: 991px) {
  nav, .nav, .navigation {
    width: 100%;
    order: 10;      ← ПРОБЛЕМА: nav уходит в конец, НИЖЕ всего
    justify-content: center;
    margin-top: 0.5rem;
  }
}

@media (max-width: 767px) {
  nav ul, .nav ul, .menu, .nav-links {
    flex-direction: column !important;   ← ПРОБЛЕМА: навигация становится вертикальной
    align-items: center !important;
  }
}
```

`order: 10` выталкивает `<nav>` в самый конец flex-контейнера header, что визуально перемещает его под логотип. Это происходит даже если AI сгенерировал правильный горизонтальный header.

**Конфликт**: В `enforceUiUxBaselineInFiles` (edge function) nav принудительно `display: flex; flex-wrap: nowrap`, а preview инжектит `order: 10` и `flex-direction: column` — CSS с `!important` в preview побеждает.

---

### Проблема 2: `img, svg, video { height: auto }` делает иконки гигантскими

**Файл:** `src/lib/inlineAssets.ts` → `enforceResponsiveImagesInFiles` (edge function), строка 3187

В первом CSS guard (edge function) написано:
```css
img, svg, video { max-width: 100%; height: auto; }
```

Это правило глобальное и применяется к **всем** SVG на странице, включая иконки. Если иконка — это `<svg width="24" height="24">`, то CSS переопределяет `height: auto`, и браузер рассчитывает высоту исходя из viewBox — на широком экране SVG-иконка может вырастать до 100px+ или даже до ширины контейнера.

Правило `enforceUiUxBaselineInFiles` (строки 3204+) пытается это компенсировать через `.feature-icon svg { width: 28px !important; height: 28px !important; }`, но охватывает только конкретные классы (`feature-icon`, `service-icon`, `icon-box` и т.д.). Если AI использует `icon-wrap`, `icon-badge`, `service-icon-wrapper` или любой нестандартный класс — иконки не ограничены.

---

### Проблема 3: Конфликт между несколькими CSS guard-блоками

Сейчас в пайплайне накапливаются **3 разных** CSS guard блока, которые иногда противоречат друг другу:

1. `enforceResponsiveImagesInFiles` → инжектирует `<style id="lovable-responsive-images">` (строка 3187)
2. `enforceUiUxBaselineInFiles` → инжектирует `<style id="lovable-uix-baseline">` (строка 3214) 
3. `injectBaseStyles` в preview (src/lib/inlineAssets.ts) → инжектирует `<style data-preview-base>` (строка 303)

Стиль из пункта 3 применяется **после** двух первых и содержит:
- `.logo, .site-logo, .brand` → `display: inline-flex` — конфликт с `nav-logo` у которого `display: flex` и `max-width: 280px`
- Nav `order: 10` на планшетах

---

### Проблема 4: regex в `ensureFaviconAndLogoInFiles` слишком узкий

**Файл:** `supabase/functions/generate-website/index.ts`, строка 3537

```js
/<a([^>]*\bclass=["'][^"']*(?:nav-logo|logo|brand)[^"']*["'][^>]*)>(?!\s*<img\b)[\s\S]*?<\/a>/gi
```

Этот regex заменяет текстовые логотипы на `img + span` только для `class="nav-logo"`, `class="logo"`, `class="brand"`. Но AI часто генерирует:
- `class="site-logo"` 
- `class="header-logo"`
- `class="navbar-brand"`
- `class="logo-link"`
- `class="brand-logo"`

Для этих вариантов замена **не происходит**, и в header остаётся голый текст вместо иконки. Хотя Logo Safety Guard в edge function CSS добавлен для этих классов, он не заменяет HTML-структуру, а только стилизует существующий текст.

---

## Что нужно исправить

### Исправление 1: `src/lib/inlineAssets.ts` — убрать `order: 10` и `flex-direction: column` для навигации

В `injectBaseStyles` (строки 491–510):
- Убрать `order: 10` у `nav` на 991px — пусть nav остаётся на своём месте
- На 767px: вместо `flex-direction: column !important` для `.nav-links` — добавить `display: none !important` (мобильное меню должно быть скрытым по умолчанию, а не переноситься в колонку)
- Добавить `.nav-links.active, .nav-links.open { display: flex !important; flex-direction: column !important; }` чтобы мобильное меню работало корректно при открытии

### Исправление 2: `src/lib/inlineAssets.ts` — ограничить SVG глобальный reset

В `injectBaseStyles` добавить:
```css
/* Prevent inline SVG icons from growing to 100% width */
svg:not([class*="hero"]):not([class*="banner"]):not([class*="illustration"]) {
  max-width: none;
}
/* Named icon SVGs — hard cap */
.icon svg, [class*="icon"] svg, [class*="-icon"] svg {
  width: 1em !important;
  height: 1em !important;
  max-width: 2rem !important;
  max-height: 2rem !important;
}
```

### Исправление 3: `enforceResponsiveImagesInFiles` в edge function — ограничить `svg` global rule

На строке 3187 изменить:
```css
/* БЫЛО: */
img, svg, video { max-width: 100%; height: auto; }

/* СТАТЬ: */
img, video { max-width: 100%; height: auto; }
svg { max-width: 100%; }  /* height: auto убрать, чтобы SVG-иконки не растягивались */
```

### Исправление 4: Расширить regex в `ensureFaviconAndLogoInFiles`

Строка 3537 — добавить в regex дополнительные классы-варианты логотипа:

```text
БЫЛО:  (?:nav-logo|logo|brand)
СТАТЬ: (?:nav-logo|site-logo|header-logo|logo-link|navbar-brand|brand-logo|logo|brand)
```

### Исправление 5: Добавить universal SVG icon cap в `enforceUiUxBaselineInFiles`

В блок icon constraints (строка 3214) добавить fallback для нестандартных классов иконок:
```css
/* Universal SVG icon cap — catches any icon not covered by specific classes */
a svg, button svg, li svg, p svg,
.card svg:not([class*="hero"]):not([class*="banner"]),
[class*="icon"] svg, [class*="-icon"] > svg {
  width: 28px !important;
  height: 28px !important;
  max-width: 28px !important;
  max-height: 28px !important;
  flex-shrink: 0 !important;
}
```

---

## Изменяемые файлы

- `src/lib/inlineAssets.ts` — правки в `injectBaseStyles` (mobile nav + SVG global rule)
- `supabase/functions/generate-website/index.ts` — правки в трёх местах:
  1. `enforceResponsiveImagesInFiles` → строка 3187 (SVG global rule)
  2. `enforceUiUxBaselineInFiles` → строка 3214 (universal SVG icon cap)
  3. `ensureFaviconAndLogoInFiles` → строка 3537 (расширить regex для лого-классов)
