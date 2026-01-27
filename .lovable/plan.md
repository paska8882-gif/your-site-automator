
# План виправлення Auto-Retry генерації

## ✅ ВИПРАВЛЕНО (27.01.2026)

### Проблема
При автоматичному або ручному retry сайту втрачались параметри:
- **colorScheme** (кольорова гама)
- **layoutStyle** (стиль макету)
- **improvedPrompt** (покращений промпт)
- **vipPrompt** (VIP промпт)

### Рішення
Виправлено у всіх 3-х edge functions:

1. **generate-website/index.ts**
   - Розширено `select` для `existingRecord`: додано `color_scheme, layout_style, improved_prompt, vip_prompt`
   - Оновлено `update` при retry: тепер зберігає/оновлює ці параметри

2. **generate-react-website/index.ts**
   - Додано `vipPrompt, colorScheme` до body destructuring
   - Розширено `select` для `existingRecord`
   - Оновлено `update` при retry

3. **generate-php-website/index.ts**
   - Розширено `select` для `existingRecord`
   - Оновлено `update` при retry

### Логіка збереження
```typescript
color_scheme: colorScheme || existingRecord.color_scheme || null,
layout_style: layoutStyle || existingRecord.layout_style || null,
improved_prompt: improvedPrompt || existingRecord.improved_prompt || null,
vip_prompt: vipPrompt || existingRecord.vip_prompt || null,
```

Пріоритет: параметри з запиту > збережені в БД > null

### Фронтенд (вже було коректно)
`GenerationHistory.tsx` вже передавав всі параметри при retry:
```typescript
body: JSON.stringify({
  colorScheme: item.color_scheme,
  layoutStyle: item.layout_style,
  improvedPrompt: item.improved_prompt,
  vipPrompt: item.vip_prompt,
  // ...інші параметри
})
```

`useGenerationHistory.ts` вже вибирав ці поля з БД:
```typescript
.select("..., color_scheme, layout_style, improved_prompt, vip_prompt")
```

