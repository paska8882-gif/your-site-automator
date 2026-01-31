

# Plan: Dodати унікальну типографіку та структуру до кожного стилю макету

## Огляд

Зараз кожен стиль макету (`LAYOUT_VARIATIONS`) містить детальні описи для структури (header, hero, секції, footer), але **шрифти не визначені** для кожного стилю. Всі сайти використовують стандартні шрифти, що робить їх схожими візуально.

## Що буде змінено

### 1. Нова структура типографіки для кожного стилю

Додаю до кожного з 30+ стилів унікальну комбінацію шрифтів:

```text
┌─────────────────┬────────────────────────────────────┐
│ Style           │ Typography                         │
├─────────────────┼────────────────────────────────────┤
│ classic         │ Heading: Playfair Display (serif)  │
│                 │ Body: Source Sans Pro              │
├─────────────────┼────────────────────────────────────┤
│ corporate       │ Heading: Montserrat (bold)         │
│                 │ Body: Open Sans                    │
├─────────────────┼────────────────────────────────────┤
│ minimalist      │ Heading: Inter (thin)              │
│                 │ Body: Inter                        │
├─────────────────┼────────────────────────────────────┤
│ brutalist       │ Heading: Space Grotesk             │
│                 │ Body: JetBrains Mono (monospace)   │
├─────────────────┼────────────────────────────────────┤
│ retro           │ Heading: Press Start 2P (pixel)    │
│                 │ Body: VT323                        │
├─────────────────┼────────────────────────────────────┤
│ editorial       │ Heading: Cormorant Garamond        │
│                 │ Body: Libre Baskerville            │
├─────────────────┼────────────────────────────────────┤
│ executive       │ Heading: Cinzel (luxury serif)     │
│                 │ Body: Lora                         │
├─────────────────┼────────────────────────────────────┤
│ tech            │ Heading: Space Grotesk             │
│                 │ Body: IBM Plex Sans                │
├─────────────────┼────────────────────────────────────┤
│ saas            │ Heading: Inter (medium)            │
│                 │ Body: Inter                        │
├─────────────────┼────────────────────────────────────┤
│ creative        │ Heading: Caveat (handwritten)      │
│                 │ Body: Poppins                      │
├─────────────────┼────────────────────────────────────┤
│ restaurant      │ Heading: Playfair Display          │
│                 │ Body: Raleway                      │
├─────────────────┼────────────────────────────────────┤
│ hotel           │ Heading: Cormorant Garamond        │
│                 │ Body: Nunito Sans                  │
└─────────────────┴────────────────────────────────────┘
```

### 2. Оновлені структурні специфікації

Розширюю `description` кожного стилю з додатковими правилами:

- **Порядок секцій** - унікальна послідовність для кожного стилю
- **Розташування елементів** - ліво/право/центр для різних блоків
- **Пропорції грід** - 2 колонки, 3 колонки, асиметричні
- **Розміри типографіки** - конкретні px значення для H1-H6
- **Відступи** - унікальні spacing patterns

### 3. Технічна реалізація

#### Файли для зміни:

**Edge Functions (3 файли):**
- `supabase/functions/generate-website/index.ts`
- `supabase/functions/generate-php-website/index.ts`  
- `supabase/functions/generate-react-website/index.ts`

**Зміни в кожному файлі:**

1. **Оновити `LAYOUT_VARIATIONS` масив** - додати поле `typography`:

```typescript
const LAYOUT_VARIATIONS = [
  {
    id: "classic",
    name: "Classic Corporate",
    typography: {
      headingFont: "Playfair Display",
      bodyFont: "Source Sans Pro",
      headingWeight: "700",
      bodyWeight: "400",
      letterSpacing: "normal",
      lineHeight: "1.6"
    },
    description: `...existing description...`
  },
  // ... інші стилі
];
```

2. **Додати Google Fonts import** у генерований HTML:

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet">
```

3. **Додати CSS змінні** для типографіки:

```css
:root {
  --font-heading: 'Playfair Display', serif;
  --font-body: 'Source Sans Pro', sans-serif;
  --heading-weight: 700;
  --body-weight: 400;
}

h1, h2, h3, h4, h5, h6 { 
  font-family: var(--font-heading);
  font-weight: var(--heading-weight);
}

body, p, li, td { 
  font-family: var(--font-body);
  font-weight: var(--body-weight);
}
```

4. **Оновити AI prompt** з обов'язковими вимогами до типографіки:

```text
⚠️⚠️⚠️ MANDATORY TYPOGRAPHY - NON-NEGOTIABLE! ⚠️⚠️⚠️
HEADING FONT: Playfair Display (Google Fonts)
BODY FONT: Source Sans Pro (Google Fonts)

YOU MUST:
- Import these fonts from Google Fonts
- Apply heading font to h1, h2, h3, h4, h5, h6
- Apply body font to body, p, li, a
- Use font-weight: 700 for headings
- Use font-weight: 400 for body text
```

### 4. Повний список типографіки для всіх 30+ стилів

| Style ID | Heading Font | Body Font | Mood |
|----------|-------------|-----------|------|
| classic | Playfair Display | Source Sans Pro | Елегантний |
| corporate | Montserrat | Open Sans | Діловий |
| professional | Roboto Slab | Roboto | Чистий |
| executive | Cinzel | Lora | Люксовий |
| asymmetric | Archivo Black | Archivo | Сміливий |
| editorial | Cormorant Garamond | Libre Baskerville | Журнальний |
| bold | Bebas Neue | Barlow | Агресивний |
| creative | Caveat | Poppins | Творчий |
| artistic | DM Serif Display | Karla | Галерея |
| minimalist | Inter | Inter | Чистий |
| zen | Cormorant | Nunito Sans | Спокійний |
| clean | Work Sans | Work Sans | Простий |
| whitespace | Jost | Jost | Повітряний |
| showcase | Syne | Space Grotesk | Динамічний |
| interactive | Plus Jakarta Sans | Plus Jakarta Sans | Сучасний |
| animated | Outfit | Outfit | Плавний |
| parallax | Oswald | Lato | Глибокий |
| saas | Inter | Inter | Технічний |
| startup | Manrope | Manrope | Стартап |
| tech | Space Grotesk | IBM Plex Sans | Код |
| app | SF Pro Display | SF Pro Text | Мобільний |
| gradient | Clash Display | Satoshi | Трендовий |
| brutalist | Space Grotesk | JetBrains Mono | Сирий |
| glassmorphism | Poppins | Poppins | Прозорий |
| neomorphism | Nunito | Nunito | М'який |
| retro | Press Start 2P | VT323 | 90-ті |
| portfolio | Sora | DM Sans | Креативний |
| agency | Clash Display | Cabinet Grotesk | Агенція |
| studio | Bodoni Moda | Figtree | Кіно |
| ecommerce | Lexend | Lexend | Магазин |
| services | Mulish | Mulish | Сервіс |
| restaurant | Playfair Display | Raleway | Ресторан |
| hotel | Cormorant Garamond | Nunito Sans | Готель |

### 5. Приклад результату генерації

**До (всі стилі схожі):**
- Всі сайти: system-ui, Arial, sans-serif
- Однакові пропорції тексту
- Стандартні відступи

**Після (унікальний вигляд):**

**Classic Corporate:**
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Sans+Pro:wght@400;600&display=swap');

h1 { font-family: 'Playfair Display', serif; font-size: 56px; }
h2 { font-family: 'Playfair Display', serif; font-size: 42px; }
body { font-family: 'Source Sans Pro', sans-serif; }
```

**Tech Modern:**
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500&display=swap');

h1 { font-family: 'Space Grotesk', sans-serif; font-size: 48px; letter-spacing: -1px; }
body { font-family: 'IBM Plex Sans', sans-serif; }
code { font-family: 'JetBrains Mono', monospace; }
```

**Retro 90s:**
```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');

h1 { font-family: 'Press Start 2P', cursive; font-size: 32px; }
body { font-family: 'VT323', monospace; font-size: 20px; }
```

## Послідовність реалізації

1. **Створити типографічну конфігурацію** - об'єкт з шрифтами для всіх 30+ стилів
2. **Оновити LAYOUT_VARIATIONS** - додати typography поле до кожного стилю
3. **Модифікувати HTML_GENERATION_PROMPT** - додати обов'язкові вимоги до шрифтів
4. **Додати post-processing** - перевірка наявності Google Fonts import
5. **Тестування** - перевірити генерацію для кількох стилів

## Очікуваний результат

- Кожен з 30+ стилів матиме унікальну типографіку
- Сайти візуально відрізнятимуться один від одного
- Google Fonts буде автоматично підключатися
- AI буде отримувати чіткі інструкції щодо шрифтів

