
# План виправлення Auto-Retry генерації

## Проблема
При автоматичному або ручному retry (повторній генерації) сайту втрачаються ключові параметри:
- **colorScheme** (кольорова гама)
- **layoutStyle** (стиль макету)
- **improvedPrompt** (покращений промпт)
- **vipPrompt** (VIP промпт)

Перший запит працює коректно, бо всі параметри передаються з форми. Але retry бере дані з `HistoryItem`, який не містить цих полів, і не передає їх в edge function.

---

## Що потрібно виправити

### 1. Оновити інтерфейс HistoryItem
**Файл:** `src/hooks/useGenerationHistory.ts`

Додати поля до інтерфейсу:
```typescript
export interface HistoryItem {
  // ... існуючі поля
  improved_prompt: string | null;  // ДОДАТИ
  vip_prompt: string | null;       // ДОДАТИ
  // color_scheme та layout_style вже є
}
```

### 2. Оновити SELECT запит
**Файл:** `src/hooks/useGenerationHistory.ts`

Включити нові поля в select:
```sql
...improved_prompt, vip_prompt...
```

### 3. Оновити функцію handleRetryGeneration
**Файл:** `src/components/GenerationHistory.tsx`

Передавати всі необхідні параметри при retry:
```typescript
body: JSON.stringify({
  prompt: item.prompt,
  language: item.language,
  aiModel: item.ai_model || "senior",
  siteName: item.site_name,
  imageSource: item.image_source || "basic",
  teamId: teamMember?.team_id,
  geo: item.geo,
  retryHistoryId: item.id,
  // ДОДАТИ:
  colorScheme: item.color_scheme,
  layoutStyle: item.layout_style,
  improvedPrompt: item.improved_prompt,  // НЕ vip_prompt - він вже в prompt
}),
```

### 4. Оновити addOptimisticItem (опціонально)
**Файл:** `src/hooks/useGenerationHistory.ts`

Додати дефолтні значення для нових полів.

---

## Технічні деталі

### Структура даних в БД (generation_history)
Колонки що вже існують:
- `color_scheme` - text
- `layout_style` - text  
- `improved_prompt` - text
- `vip_prompt` - text

### Edge Function (generate-website/index.ts)
Вже приймає `colorScheme` та `layoutStyle` з body запиту (лінія 9190):
```typescript
const { ..., colorScheme } = body;
```

І передає їх в `runBackgroundGeneration` (лінія 9668).

### Потік даних при Retry
```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  HistoryItem    │ --> │ handleRetryGen.  │ --> │  Edge Function  │
│  (з БД)         │     │ (формує body)    │     │  (генерує)      │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ color_scheme    │ ==> │ colorScheme      │ ==> │ colorScheme     │
│ layout_style    │ ==> │ layoutStyle      │ ==> │ layoutStyle     │
│ improved_prompt │ ==> │ improvedPrompt   │ ==> │ improvedPrompt  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Результат
Після виправлення retry буде зберігати всі стилістичні налаштування оригінальної генерації:
- Кольорова гама
- Стиль макету
- Покращений/VIP промпт
