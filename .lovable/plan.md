
## Контрольная проверка: взаимодействие пользователей с UI

### Результат: всё ОК, одна проблема требует исправления

---

### Что проверено

Полный аудит каждого хука и компонента с периодическими запросами, Realtime-подписками и polling.

---

### ПРОБЛЕМА: `useBackendHealth` — баг с бесконечной перезагрузкой интервала

**Серьёзность: СРЕДНЯЯ** — не Edge Function вызов, но при каждой успешной проверке создаётся новый `setInterval`.

Суть бага:
```typescript
// Строка 149 useBackendHealth.ts:
const check = useCallback(async (isManualRetry = false) => {
  // ...
  if (state.consecutiveFailures > 0) { ... } // <- читает state
}, [initialTimeoutMs, maxRetries, getBackoffDelay, state.consecutiveFailures, state.lastErrorAt]);
//                                                  ^^^^ зависит от state

useEffect(() => {
  check();
  intervalRef.current = setInterval(() => check(), baseIntervalMs);
  // ...
}, [check, baseIntervalMs]); // <- check меняется при каждом setState -> интервал сбрасывается
```

При каждом пинге: `check()` → `setState({consecutiveFailures: 0})` → `check` пересоздаётся → `useEffect` срабатывает → `clearInterval` + новый `setInterval`. По факту интервал всегда "10 минут с момента предыдущего успешного вызова", а не фиксированные 10 минут. При нормальной работе backend — разница несущественна. Но при проблемах (частые `consecutiveFailures`) — интервал перезапускается агрессивно.

**Исправление**: убрать `state.consecutiveFailures` и `state.lastErrorAt` из зависимостей `check`, читать их через `setState(prev => ...)` паттерн.

---

### Всё остальное — в порядке

| Компонент/Хук | Тип | Частота | Статус |
|---|---|---|---|
| `RealtimeContext` | WS-соединение | Постоянное (2 канала) | OK — Realtime, не polling |
| `useNotifications` | useQuery | Нет polling, только Realtime | OK |
| `useTaskIndicators` | Realtime trigger | Только при событии admin_tasks | OK |
| `usePendingAppeals` | Realtime trigger | Только при событии appeals | OK |
| `usePendingManualRequests` | Realtime trigger | Только при событии generation_history | OK |
| `usePendingUsers` | Realtime trigger | Только при событии team_members | OK |
| `UserDataContext` | useQuery | staleTime 5 мин, без polling | OK |
| `useBalanceData` | useQuery | staleTime 5 мин, без polling | OK |
| `useBalanceRequests` | useQuery | staleTime 2 мин, без polling | OK |
| `useSpends` | useQuery | staleTime 5 мин, без polling | OK |
| `useGenerationHistory` | Realtime + fallback poll | fallback 15с — только если Realtime down | OK |
| `AdminSystemMonitor` | setInterval | 5 минут — простой SELECT | OK |
| `ManualRequestsTab` | refetchInterval | 3 минуты (только что исправлено) | OK |
| `AdminBalanceRequestsTab` | Realtime channel | Только при событии | OK — прямой канал, корректно |
| `AdminSupportTab` | Realtime channel | Только при событии | OK — прямой канал, корректно |
| `SupportChat` | Realtime channel | Только при открытом чате | OK — закрывается при unmount |
| `AiEditorTab` | Realtime channel | Только при активном jobId | OK — отписывается при завершении |
| `useBackendHealth` | setInterval | 10 минут (но с багом перезапуска) | ИСПРАВИТЬ |
| `useAutoRetry` | setInterval | UI countdown, не вызывает API | OK |
| `WebsiteGenerator` fetchActiveGenerations | setInterval | 5 минут (safety fallback) | OK |
| `EditChat.tsx` timer | setInterval | UI таймер отображения времени | OK — не вызывает API |

---

### AdminBalanceRequestsTab и AdminSupportTab — отдельные Realtime каналы

Эти два компонента создают **собственные** Realtime каналы вне `RealtimeContext`:

- `AdminBalanceRequestsTab` → `channel("admin-balance-requests")` — слушает `balance_requests`
- `AdminSupportTab` → `channel("admin-conversations")` + `channel("admin-messages-*")` — слушают `support_conversations` и `support_messages`

Это **нормально**: `support_conversations` и `support_messages` не добавлены в `RealtimeContext` (они специфичны только для этих компонент). Каналы правильно удаляются через `return () => supabase.removeChannel(channel)`. Никакой утечки нет.

---

### Что исправить

**Только одно: исправить `useBackendHealth` dependency bug**

Убрать `state.consecutiveFailures` и `state.lastErrorAt` из зависимостей `useCallback`, читать их через `setState(prev => prev.consecutiveFailures)` — это позволит `check` стать стабильной функцией без лишних пересозданий. Эффект: `setInterval` будет реально работать с фиксированным 10-минутным интервалом, а не перезапускаться при каждом вызове.

**Конкретное изменение в `src/hooks/useBackendHealth.ts`**:

```typescript
// БЫЛО — читает state напрямую в теле функции:
const check = useCallback(async (isManualRetry = false) => {
  // ...
  if (state.consecutiveFailures > 0) { // <- проблема
    logHealthEvent("backend_recovered", {
      previousFailures: state.consecutiveFailures,
      downtime: state.lastErrorAt ? Date.now() - state.lastErrorAt : null,
    });
  }
  // ...
}, [initialTimeoutMs, maxRetries, getBackoffDelay, state.consecutiveFailures, state.lastErrorAt]);

// СТАНЕТ — использует ref для чтения state без добавления в deps:
const stateRef = useRef(state);
useEffect(() => { stateRef.current = state; }, [state]);

const check = useCallback(async (isManualRetry = false) => {
  // ...
  const currentState = stateRef.current;
  if (currentState.consecutiveFailures > 0) {
    logHealthEvent("backend_recovered", {
      previousFailures: currentState.consecutiveFailures,
      downtime: currentState.lastErrorAt ? Date.now() - currentState.lastErrorAt : null,
    });
  }
  // ...
}, [initialTimeoutMs, maxRetries, getBackoffDelay]); // стабильные deps
```

Эффект: `check` больше не пересоздаётся при каждом setState → `useEffect` не перезапускается → `setInterval` работает стабильно ровно каждые 10 минут.

---

### Итог

Система в целом чистая. Realtime-архитектура работает правильно — вся мгновенная реактивность идёт через WebSocket без polling. Все query-кеши настроены с разумными `staleTime`. Единственный реальный баг — `useBackendHealth` с нестабильным интервалом, который нужно исправить через `stateRef` паттерн.
