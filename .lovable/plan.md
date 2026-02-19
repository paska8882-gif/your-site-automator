
## Устранение лишних расходов Cloud & AI баланса

### Что сейчас съедает кредиты прямо сейчас

**Проблема 1 — ГЛАВНАЯ: Дублирующий вызов Edge Function `check-super-admin` в `WebsiteGenerator.tsx`**

В `WebsiteGenerator.tsx` (строки 766–806) есть отдельный `useEffect`, который при каждом монтировании компонента вызывает Edge Function `check-super-admin`. Это ненужный вызов, потому что `isSuperAdmin` **уже доступен** через `UserDataContext` — он читает из базы данных напрямую (таблица `user_roles`) без вызова Edge Function.

Именно это и видно в логах аналитики — `check-super-admin` вызывается несколько раз подряд с коротким интервалом при каждом открытии страницы, в том числе с preflight `OPTIONS`-запросами. Каждый вызов = расход credits.

**Проблема 2 — СРЕДНЯЯ: Polling `fetchActiveGenerations` каждые 60 секунд**

В `WebsiteGenerator.tsx` (строки 1642–1645) есть `setInterval` который каждые 60 секунд делает запрос к БД для подсчёта активных генераций. Этот poll работает постоянно пока открыта страница. Realtime уже обновляет счётчик через `RealtimeContext` — этот polling дублирует логику.

---

### Что будет исправлено

**Исправление 1: Удалить вызов Edge Function `check-super-admin` из `WebsiteGenerator.tsx`**

Вместо отдельного `useState<boolean> isSuperAdmin` + отдельного `useEffect` с HTTP-запросом к Edge Function — использовать уже существующий `useSuperAdmin()` хук, который читает данные из `UserDataContext`.

До:
```tsx
// В начале компонента
const [isSuperAdmin, setIsSuperAdmin] = useState(false);

// useEffect вызывает Edge Function
useEffect(() => {
  const checkSuperAdmin = async () => {
    // ...fetch к check-super-admin Edge Function
  };
  checkSuperAdmin();
}, [user]);
```

После:
```tsx
// Убрать useState и useEffect полностью
// Добавить один хук:
const { isSuperAdmin } = useSuperAdmin();
```

Это убирает: 2 HTTP-запроса (OPTIONS + POST) к Edge Function при каждом монтировании компонента. При большом количестве пользователей — сотни лишних вызовов.

**Исправление 2: Остановить polling `fetchActiveGenerations` когда Realtime подключён**

Сейчас polling стартует безусловно. Нужно добавить условие — если Realtime-канал активен (`isConnected === true`), не запускать setInterval. Либо увеличить интервал с 60 секунд до 5 минут.

Через хук `useRealtime()` уже доступен `isConnected`. Если `isConnected`, достаточно Realtime-событий — polling не нужен вовсе.

---

### Файлы для изменения

**`src/components/WebsiteGenerator.tsx`**:
1. Добавить `import { useSuperAdmin } from "@/hooks/useSuperAdmin";` в импорты
2. Убрать `const [isSuperAdmin, setIsSuperAdmin] = useState(false);` (~строка 755)
3. Заменить его на `const { isSuperAdmin } = useSuperAdmin();`
4. Удалить весь `useEffect` с `checkSuperAdmin` (~строки 766–806) — 40+ строк лишнего кода
5. Polling `fetchActiveGenerations` — изменить интервал с `60_000` (1 мин) на `300_000` (5 мин) как резервный fallback

---

### Ожидаемый результат

| Расход | Сейчас | После |
|---|---|---|
| Вызовов `check-super-admin` при каждом открытии | 2 (OPTIONS + POST) | 0 |
| При 50 открытиях/день | ~100 Edge Function вызовов/день | 0 |
| Polling БД active_generations | каждые 60 сек | каждые 5 мин (резерв) |
| DB-запросы active_generations/день | ~1440 | ~288 |

В сочетании с уже исправленными cron jobs, суммарно расход credits от фоновых операций снизится до целевых **$1–2/день**.
