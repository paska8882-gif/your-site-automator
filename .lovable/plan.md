
## Полный аудит расходов: все проблемы и план устранения

### Состояние cron jobs (актуально сейчас)
Хорошая новость — cron jobs уже оптимизированы предыдущими правками:
- `cleanup-stale-generations` — каждые 30 минут (было каждую минуту) ✅
- `check-problematic-tasks` — каждые 30 минут (было каждые 5 минут) ✅
- `cleanup-old-zip-files` — каждый день в 03:00 ✅

Cron jobs больше не проблема. Теперь фокус — на фронтенде.

---

### Найденные проблемы во фронтенде

**ПРОБЛЕМА 1 — КРИТИЧЕСКАЯ: Три дублирующих Realtime-канала в sidebar хуках**

`usePendingAppeals.ts`, `usePendingManualRequests.ts`, `usePendingUsers.ts` — каждый из них создаёт **свой отдельный Realtime-канал** к Supabase, который висит открытым всё время пока открыта страница:

```
usePendingAppeals → channel("pending-appeals-indicator") → подписка на таблицу appeals
usePendingManualRequests → channel("pending-manual-requests-indicator") → подписка на generation_history
usePendingUsers → channel("pending-users-indicator") → подписка на team_members
```

При этом `RealtimeContext.tsx` уже подписан на те же таблицы (`appeals`, `team_members`) через `admin-updates-{userId}` канал! Это прямое дублирование. Каждый лишний канал = постоянная активная подписка = расход credits.

**Решение**: Переписать эти три хука чтобы они использовали `useRealtimeTable()` из уже существующего `RealtimeContext` вместо создания собственных каналов. Для `generation_history` — добавить обработчик в существующую подписку внутри `RealtimeContext`.

**ПРОБЛЕМА 2 — ВЫСОКАЯ: `checkStaleGenerations` в `GenerationHistory.tsx` — дублирует работу cron**

В `GenerationHistory.tsx` (~строки 938–1018) есть функция `checkStaleGenerations`, которая каждые 15 минут вызывает Edge Function `cleanup-stale-generations` с фронтенда. Это происходит **параллельно** с уже настроенным cron-job который делает то же самое каждые 30 минут!

Cron job — это правильное место для этой логики. Фронтенд не должен дублировать серверную задачу. При каждом вызове тратятся credits: Edge Function boot + DB запросы.

**Решение**: Полностью удалить `checkStaleGenerations` и весь связанный `useEffect` из `GenerationHistory.tsx` (~40 строк кода).

**ПРОБЛЕМА 3 — СРЕДНЯЯ: `AdminSystemMonitor` полинг каждые 30 секунд**

`AdminSystemMonitor.tsx` делает запрос к `system_limits` каждые 30 секунд через `setInterval`. Эта страница открыта у каждого администратора всё время, пока они работают в панели. При 5 активных администраторах = 10 запросов/минуту = 14,400 запросов/день только для этого.

`RealtimeContext` уже не подписан на `system_limits`. Но правильное решение — добавить Realtime для этой таблицы и убрать polling, или сильно увеличить интервал до 5 минут.

**Решение**: Увеличить интервал с 30 секунд до 5 минут (`300_000` ms). Активных генераций обычно 0–3, обновление раз в 5 минут достаточно для мониторинга.

**ПРОБЛЕМА 4 — СРЕДНЯЯ: `useGenerationHistory` создаёт СВОЙ Realtime-канал параллельно с `RealtimeContext`**

В `useGenerationHistory.ts` (~строки 330–460) создаётся отдельный Realtime-канал `generation_history_{mode}_{userId}_{timestamp}`. При этом `RealtimeContext` уже подписан на `generation_history` с фильтром `user_id=eq.{userId}`.

Это означает два параллельных канала на одну и ту же таблицу. Каждый канал = постоянная активная подписка.

Однако этот хук имеет сложную логику (retry на `CLOSED`, fallback polling, reconnect) которая обеспечивает надёжность. Его нельзя просто удалить, но можно упростить — убрать дублирование с `RealtimeContext` и использовать `useRealtimeTable()`.

**Решение**: Рефакторинг `useGenerationHistory` — заменить собственный канал на `useRealtimeTable()` из `RealtimeContext`. Fallback polling оставить на случай отключения Realtime.

---

### Конкретные изменения по файлам

**Файл 1: `src/hooks/usePendingAppeals.ts`**
- Убрать: `supabase.channel("pending-appeals-indicator")` + `.subscribe()` + `supabase.removeChannel()`
- Добавить: `useRealtimeTable("appeals", handleUpdate)`
- Результат: -1 постоянный Realtime-канал

**Файл 2: `src/hooks/usePendingManualRequests.ts`**
- Убрать: собственный канал на `generation_history`
- Добавить: `useRealtimeTable("generation_history", handleUpdate)`
- Результат: -1 постоянный Realtime-канал

**Файл 3: `src/hooks/usePendingUsers.ts`**
- Убрать: `supabase.channel("pending-users-indicator")` на `team_members`
- Добавить: `useRealtimeTable("team_members", handleUpdate)` (через RealtimeContext который уже подписан на `team_members`)
- Результат: -1 постоянный Realtime-канал

**Файл 4: `src/contexts/RealtimeContext.tsx`**
- Добавить `"generation_history"` в `USER_TABLES` с фильтром по `user_id` (уже есть, просто убедиться)
- Добавить `"team_members"` в `ADMIN_TABLES` (уже есть)
- Вся логика уже реализована — просто используем её

**Файл 5: `src/components/GenerationHistory.tsx`**
- Удалить: функцию `checkStaleGenerations` (~строки 938–1006)
- Удалить: `useEffect` с интервалом 15 минут для `checkStaleGenerations` (~строки 1008–1018)
- Результат: -1 Edge Function вызов каждые 15 минут с фронтенда при активных генерациях

**Файл 6: `src/components/AdminSystemMonitor.tsx`**
- Изменить: `setInterval(fetchLimits, 30_000)` → `setInterval(fetchLimits, 300_000)` (30с → 5 мин)
- Результат: 10x меньше DB запросов от системного монитора

---

### Ожидаемый результат

| Проблема | До | После |
|---|---|---|
| Дублирующие Realtime-каналы (sidebar) | 3 лишних канала | 0 лишних каналов |
| `checkStaleGenerations` с фронтенда | каждые 15 мин при активных генерациях | удалено полностью |
| `AdminSystemMonitor` polling | каждые 30 сек | каждые 5 мин |
| Дублирующий канал в `useGenerationHistory` | 2 канала на `generation_history` | 1 канал |

Совокупная экономия: убираем ~3–5 постоянно открытых WebSocket-соединений и уменьшаем лишние DB запросы от мониторинга на порядок.
