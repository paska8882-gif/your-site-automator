
# План: Виправлення Auto-Retry для застряглих генерацій

## Проблема

Auto-retry механізм не працює через конфлікт авторизації:
- `cleanup-stale-generations` передає SERVICE_ROLE_KEY як Bearer token
- `generate-website` (і аналогічні функції) очікують JWT токен користувача і падають з помилкою "Invalid JWT structure"

Результат: сайт `507db582` застряг у статусі "generating" навіть після 2 спроб retry.

## Технічний план

### Крок 1: Оновити `generate-website/index.ts`

Додати альтернативну логіку авторизації для retry-запитів:

```text
1. Перевірити чи є retryHistoryId в body
2. Якщо є retryHistoryId:
   - Перевірити чи Authorization header = SERVICE_ROLE_KEY
   - Якщо так - дозволити запит і отримати userId з generation_history запису
3. Якщо немає retryHistoryId - працювати як зараз (парсити JWT)
```

Зміни в коді (рядки ~8700-8750):

```typescript
// Попередньо прочитати body для перевірки retryHistoryId
const body = await req.json();
const { retryHistoryId, prompt, ... } = body;

// Якщо це retry від cleanup (SERVICE_ROLE_KEY), пропустити JWT парсинг
if (retryHistoryId && token === supabaseServiceKey) {
  // Отримати userId з існуючого запису
  const { data: existingRecord } = await supabase
    .from("generation_history")
    .select("user_id")
    .eq("id", retryHistoryId)
    .single();
  
  if (!existingRecord?.user_id) {
    return error("Retry record not found");
  }
  userId = existingRecord.user_id;
  console.log("🔄 Retry mode with service key, userId from DB:", userId);
} else {
  // Звичайна JWT авторизація
  // ... існуючий код
}
```

### Крок 2: Оновити `generate-react-website/index.ts`

Аналогічні зміни для React генератора.

### Крок 3: Оновити `generate-php-website/index.ts`

Аналогічні зміни для PHP генератора.

### Крок 4: Оновити `cleanup-stale-generations/index.ts`

Покращити логування для діагностики:

```typescript
console.log(`🔄 Auto-retrying generation ${item.id} via ${functionName}`);
```

### Крок 5: Передеплой всіх Edge Functions

1. `generate-website`
2. `generate-react-website`
3. `generate-php-website`
4. `cleanup-stale-generations`

### Крок 6: Ручне виправлення поточного застряглого сайту

SQL запит для скидання retry counter і статусу:

```sql
UPDATE generation_history
SET status = 'pending', admin_note = 'retry:0', error_message = NULL
WHERE id = '507db582-8c3f-4e4f-8703-947e6c469a5e';
```

## Очікуваний результат

- Auto-retry працюватиме коректно з SERVICE_ROLE_KEY
- Застряглі генерації автоматично перезапускатимуться
- Логи показуватимуть retry-mode для діагностики

## Файли для редагування

| Файл | Зміни |
|------|-------|
| `supabase/functions/generate-website/index.ts` | Додати bypass JWT для retry з service key |
| `supabase/functions/generate-react-website/index.ts` | Аналогічно |
| `supabase/functions/generate-php-website/index.ts` | Аналогічно |
| `supabase/functions/cleanup-stale-generations/index.ts` | Покращити логування |
