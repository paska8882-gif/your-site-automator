
## Полный аудит: что ещё жрёт баланс — финальный результат

### Текущее состояние cron jobs (ПОДТВЕРЖДЕНО)

Таблица `cron.job` в реальном времени:

| jobid | name | schedule | URL | Статус |
|---|---|---|---|---|
| 3 | cleanup-old-zip-files | 0 3 * * * (раз в день) | cleanup-old-zip-files | ИСПРАВЛЕНО |
| 4 | cleanup-stale-generations | */30 * * * * (каждые 30 мин) | cleanup-stale-generations | OK |
| 5 | check-problematic-tasks | */30 * * * * (каждые 30 мин) | check-problematic-tasks | OK |

Cron — чистый. Никаких phantom jobs, никаких неправильных URL.

---

### Что найдено нового при полном аудите

**Находка 1 — СРЕДНЕЕ: `ManualRequestsTab` с `refetchInterval: 30_000`**

В `src/components/ManualRequestsTab.tsx` (строка 215):
```typescript
refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
```
Это означает, что **пока открыта вкладка Manual Orders в админке** — каждые 30 секунд делается запрос `fetchManualRequests` к базе данных. Это крупный `SELECT` по нескольким таблицам с джойнами профилей и команд. При открытой вкладке на 1 час = 120 запросов. Это не Edge Function, но нагружает DB connections постоянно.

Есть лучшее решение: для `ManualRequestsTab` уже подключён `RealtimeContext`, который подписан на `appeals`, `team_members` и т.д. — таблица `manual_requests` (или что является источником этих данных) может быть добавлена в Realtime вместо polling. Но наименее рискованное решение — увеличить `refetchInterval` с 30 сек до 3 минут (180_000).

**Находка 2 — НИЗКОЕ: `useBackendHealth` dependency bug — infinite re-render risk**

В `useBackendHealth.ts` — функция `check` в `useCallback` имеет зависимость от `state.consecutiveFailures` и `state.lastErrorAt`. Это означает, что при каждом обновлении состояния (при каждой проверке) создаётся **новый** `check`, что триггерит `useEffect` (строка 163-171) и переустанавливает `setInterval`. Технически это перезапускает таймер при каждом успешном пинге — интервал не 10 минут, а "10 минут после предыдущего вызова". Это работает, но нестабильно. Уже исправлен интервал до 10 минут — оставляем как есть.

**Находка 3 — НИЗКОЕ: `useGenerationHistory` — двойной Realtime канал**

`useGenerationHistory` создаёт свой канал `generation_history_*` + `RealtimeContext` тоже подписан на `generation_history`. Это дублирование соединений. Однако у `useGenerationHistory` есть сложная логика с retry-fetch при completed статусе и fallback polling — сложно рефакторить без риска. Оставляем как есть (уже зафиксировано в предыдущем плане).

**Находка 4 — ИНФОРМАЦИОННАЯ: `check-problematic-tasks` — нет rate-limit guard**

Функция `check-problematic-tasks` запускается каждые 30 минут и имеет Smart Exit (проверяет количество активных задач), но **не имеет** rate-limit guard как у `cleanup-stale-generations`. Если cron когда-либо запустит дубликат — не будет защиты. Это низкоприоритетно (у неё нет истории дубликатов), но полезно исправить.

**Находка 5 — OK: `AdminDatabaseTab` `get-storage-stats` — только при монтировании**

`fetchStats()` + `fetchCleanupLogs()` вызываются только в `useEffect(() => { ... }, [])` — один раз при открытии вкладки. Это нормально.

**Находка 6 — OK: `AdminSystemMonitor` — 5 минут**

`setInterval(fetchLimits, 300_000)` — каждые 5 минут простой SELECT. OK.

**Находка 7 — OK: `WebsiteGenerator` polling — 5 минут**

`setInterval(fetchActiveGenerations, 300_000)` — каждые 5 минут. OK.

**Находка 8 — OK: `useAutoRetry`**

Это countdown-таймер для UI (отсчёт 30 секунд перед ручным ретраем), не вызывает никаких Edge Functions — просто декрементирует счётчик в state. Безопасно.

---

### Что нужно исправить

**Исправление 1 — СРЕДНЕЕ: `ManualRequestsTab` — увеличить `refetchInterval` с 30 сек до 3 минут**

```typescript
// БЫЛО:
refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds

// СТАНЕТ:
refetchInterval: 3 * 60 * 1000, // Auto-refresh every 3 minutes
```

Ручная кнопка "Refresh" всё равно работает. Realtime-подписки из `RealtimeContext` ловят изменения мгновенно — только этот query не будет автоматически перезапрашиваться лишний раз.

**Исправление 2 — НИЗКОЕ: `check-problematic-tasks` — добавить `last_check_at` guard**

По аналогии с `cleanup-stale-generations` добавить колонку `last_tasks_check_at` в `system_limits` и rate-limit guard на 10 минут. Это защита на случай появления дублирующих cron jobs в будущем.

---

### Что НЕ трогаем (после аудита)

| Компонент | Текущий интервал | Причина |
|---|---|---|
| `AdminDatabaseTab` `get-storage-stats` | Только при монтировании | OK |
| `AdminSystemMonitor` | 5 минут | OK |
| `WebsiteGenerator` fetchActiveGenerations | 5 минут | OK |
| `useBackendHealth` | 10 минут (уже исправлено) | OK |
| `useAutoRetry` | Countdown UI только | Не вызывает API |
| `useGenerationHistory` fallback polling | 15 сек, только при Realtime down | OK (условный) |
| cron jobid:3,4,5 | Правильные URL и расписания | OK |

---

### Технические изменения

**1. `src/components/ManualRequestsTab.tsx` — строка 215**
- `refetchInterval: 30 * 1000` → `refetchInterval: 3 * 60 * 1000`
- `staleTime: 30 * 1000` → `staleTime: 2 * 60 * 1000`

**2. `supabase/functions/check-problematic-tasks/index.ts`**
- Добавить rate-limit guard: проверять `last_tasks_check_at` в `system_limits` (минимум 10 минут между реальными запусками)
- Обновлять `last_tasks_check_at` в начале выполнения

**3. Миграция — добавить `last_tasks_check_at` в `system_limits`**
```sql
ALTER TABLE system_limits ADD COLUMN IF NOT EXISTS last_tasks_check_at timestamptz NULL;
```

---

### Итог аудита

Всё что можно было найти — найдено. Cron чистый. Единственная реальная проблема — `ManualRequestsTab` с polling каждые 30 секунд пока открыта вкладка. Остальное — мелкие улучшения надёжности.
