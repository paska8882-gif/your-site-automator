
# План виправлення генерації

## ✅ ВИПРАВЛЕНО (27.01.2026)

### Проблема #1: Retry втрачає параметри
При автоматичному або ручному retry сайту втрачались параметри:
- **colorScheme** (кольорова гама)
- **layoutStyle** (стиль макету)
- **improvedPrompt** (покращений промпт)
- **vipPrompt** (VIP промпт)

**Рішення:** Виправлено update при retry у всіх 3-х edge functions.

### Проблема #2: Нові генерації не фіксують color_scheme/layout_style
При **створенні нового** запису в БД не записувались:
- `color_scheme`
- `layout_style`
- `vip_prompt`

**Рішення:** Додано ці поля в `.insert()` для всіх 3-х edge functions:

1. **generate-website/index.ts** (рядок ~10479)
2. **generate-react-website/index.ts** (рядок ~3348)
3. **generate-php-website/index.ts** (рядок ~7373)

### Логіка збереження
```typescript
// При INSERT (нова генерація)
color_scheme: colorScheme || null,
layout_style: layoutStyle || null,
vip_prompt: vipPrompt || null,

// При UPDATE (retry)
color_scheme: colorScheme || existingRecord.color_scheme || null,
layout_style: layoutStyle || existingRecord.layout_style || null,
vip_prompt: vipPrompt || existingRecord.vip_prompt || null,
```

Тепер color_scheme та layout_style фіксуються відразу при створенні запису, а не тільки після завершення.

