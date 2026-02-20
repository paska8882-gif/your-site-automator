

## Повне видалення всіх ретраїв із системи

### Що буде видалено

Знайдено **6 місць** де є retry-логіка. Кожне буде прибрано або замінено на одноразовий виклик.

---

### 1. Edge Functions: `fetchWithRetry` -> `fetchWithTimeout` (3 файли)

**Файли:**
- `supabase/functions/generate-website/index.ts`
- `supabase/functions/generate-react-website/index.ts`
- `supabase/functions/v0-proxy/index.ts`

**Зміна:** Замінити `fetchWithRetry` на простий `fetchWithTimeout` — один виклик з таймаутом, без циклу спроб, без backoff. Якщо впав — одразу помилка.

```text
БУЛО:  fetchWithRetry(url, opts, maxRetries=2, baseDelay=1500, timeout=90000)
       -> цикл з 2 спробами + exponential backoff

СТАНЕ: fetchWithTimeout(url, opts, timeoutMs=90000)
       -> один fetch з AbortController, без повторів
```

---

### 2. PHP generation: подвійна генерація при невалідному JSON (1 файл)

**Файл:** `supabase/functions/generate-php-website/index.ts`

**Зміна:** Прибрати автоматичну повторну генерацію при "invalid JSON" (рядки ~6166-6169) та повторну генерацію з "strictFormat" при неповних файлах (рядки ~6177-6213). Одна спроба — якщо результат поганий, повертаємо помилку.

---

### 3. Frontend: кнопка Retry у GenerationHistory (1 файл)

**Файл:** `src/components/GenerationHistory.tsx`

**Зміна:** Повністю прибрати:
- `handleRetryGeneration` функцію (рядки 846-923)
- `handleRetry` обгортку (рядки 925-928)
- Кнопку "Retry" у UI (рядок ~498-510)
- Передачу `onRetry` в дочірні компоненти

---

### 4. Frontend: хук `useAutoRetry` (1 файл)

**Файл:** `src/hooks/useAutoRetry.ts`

**Зміна:** Видалити файл повністю. Він вже не використовується активно (auto-retry disabled), але сам хук існує.

---

### 5. Edge Functions: `retryHistoryId` логіка (3 файли)

**Файли:**
- `supabase/functions/generate-website/index.ts`
- `supabase/functions/generate-react-website/index.ts`
- `supabase/functions/generate-php-website/index.ts`

**Зміна:** Прибрати всю гілку `if (retryHistoryId)` — service key auth bypass для retry, update existing record замість create new, тощо. Кожна генерація = новий запис. Retry більше не існує.

---

### 6. Cleanup cron: retry references

**Файл:** `supabase/functions/cleanup-stale-generations/index.ts`

**Зміна:** Прибрати `retryCount` парсинг з `admin_note` та згадки retry у повідомленнях апеляцій.

---

### 7. UI: фінансова таблиця retry_count (читання)

**Файл:** `src/components/AdminFinanceTab.tsx`

**Зміна:** Прибрати стовпець "Retry" з таблиці та відповідні підрахунки `totalRetries`.

---

### Що НЕ чіпаємо

- Колонку `retry_count` в базі даних — залишаємо для історичних даних, просто перестаємо її використовувати
- `BackendStatusBanner` з кнопкою "Повторити" для перевірки здоров'я backend — це не retry генерації, це перевірка з'єднання
- Переклади `retry` в `ru.ts` — неактивний код, прибереться природним шляхом

---

### Порядок змін

1. Замінити `fetchWithRetry` на `fetchWithTimeout` у 3 edge functions
2. Прибрати PHP auto-retry логіку
3. Прибрати `retryHistoryId` гілки у 3 edge functions
4. Прибрати retry references з cleanup cron
5. Прибрати кнопку Retry та хендлери з GenerationHistory
6. Видалити `useAutoRetry.ts`
7. Прибрати стовпець Retry з AdminFinanceTab
8. Задеплоїти оновлені edge functions

