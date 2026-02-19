
## Полный аудит: что реально жрёт баланс и план устранения

### Диагностика

После глубокого анализа логов, cron jobs и всего кода — картина следующая:

**Вызовы `cleanup-stale-generations` за последний час:**
- До 14:55 UTC — `jobid:1` (каждые 5 мин) + `jobid:2` (каждую минуту) работали параллельно → множественные вызовы
- В 15:36 UTC — взрыв 9 POST + 7 OPTIONS за несколько секунд — это был горячий reload Lovable/браузера при открытых вкладках (старые мёртвые jobs ещё жили в памяти)
- После 14:55 — jobid:1 и jobid:2 убиты, остались только jobid:4 (каждые 30 мин) и jobid:5 (каждые 30 мин) — cron теперь чистый

**Текущее состояние cron (3 активных job):**
```
jobid:3  cleanup-old-zip-files   каждый день 03:00   → вызывает cleanup-stale-generations (ОШИБКА!)
jobid:4  cleanup-stale-generations   каждые 30 мин   → cleanup-stale-generations ✅
jobid:5  check-problematic-tasks   каждые 30 мин     → check-problematic-tasks ✅
```

**ПРОБЛЕМА: `jobid:3` с именем `cleanup-old-zip-files` вызывает `cleanup-stale-generations` вместо `cleanup-old-zip-files`.** Это ошибка в SQL миграции — чья-то старая команда перезаписала поле неправильным URL. Сейчас он стреляет только раз в день (03:00), но полностью неправильный.

**Остальные находки:**

- **`useStuckGenerationRetry.ts`** — файл существует, но **нигде не импортируется** в компонентах → мёртвый код, но не тратит деньги
- **`useBackendHealth`** — пинг каждые 2 минуты из `AppLayout`, это легкий HTTP GET к REST endpoint — безопасно
- **`useGenerationHistory`** — создаёт отдельный Realtime-канал параллельно с `RealtimeContext` (дублирование), но этот канал имеет retry-логику и нужен для надёжности. Оставляем.
- **`AdminSystemMonitor`** — уже оптимизирован до 5 минут ✅
- **`WebsiteGenerator`** — polling `fetchActiveGenerations` уже 300 секунд (5 мин) ✅

---

### Что будет исправлено

**Исправление 1 — КРИТИЧЕСКОЕ: Починить `jobid:3` — он должен вызывать `cleanup-old-zip-files`**

Выполнить SQL через `cron.alter_job`:
```sql
SELECT cron.alter_job(
  job_id := 3,
  command := $$
  SELECT net.http_post(
    url := 'https://qqnekbzcgqvpgcyqlbcr.supabase.co/functions/v1/cleanup-old-zip-files',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJ...", "x-triggered-by": "cron"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

После исправления `jobid:3` будет ежедневно запускать **правильную** функцию `cleanup-old-zip-files` вместо `cleanup-stale-generations`.

**Исправление 2 — НИЗКОЕ: Удалить мёртвый файл `useStuckGenerationRetry.ts`**

Файл нигде не используется (0 импортов в компонентах), но его функционал потенциально был полезен. Поскольку теперь логику обработки зависших генераций выполняет серверный cron job `cleanup-stale-generations`, этот клиентский хук дублирует логику и при активации потенциально запускал бы дорогие Edge Function вызовы. Удалить файл.

**Исправление 3 — СРЕДНЕЕ: Добавить дедупликацию и rate-limiting в `cleanup-stale-generations`**

Добавить в Edge Function защиту от параллельных вызовов — проверку через `system_limits` или `cleanup_logs`, чтобы если функция была вызвана менее 10 минут назад, она возвращала `{ skipped: true }` без выполнения работы. Это защита от edge-кейсов типа горячего reload или случайного двойного вызова.

```typescript
// В начале функции, после SMART EXIT:
const { data: recentLog } = await supabase
  .from("cleanup_logs")
  .select("created_at")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const TEN_MINUTES = 10 * 60 * 1000;
if (recentLog && Date.now() - new Date(recentLog.created_at).getTime() < TEN_MINUTES) {
  return new Response(JSON.stringify({ success: true, skipped: true, reason: "recent_run" }), ...);
}
```

**Проблема с этим подходом**: `cleanup_logs` пишется только когда работа реально выполнялась (processed > 0). При `no_active_generations` лог не пишется — значит при частых вызовах "холостых" всё равно будут записи только при реальной работе. Поэтому нужно другой механизм — хранить timestamp последнего запуска в `system_limits`.

Правильное решение: добавить колонку `last_cleanup_at` в `system_limits` и проверять её в функции.

**Исправление 4 — СРЕДНЕЕ: Убрать `useBackendHealth` из постоянного polling**

Сейчас `useBackendHealth` делает GET запрос к REST endpoint каждые 2 минуты из `AppLayout` — то есть **каждый открытый tab**. При 5 пользователях = 150 запросов/час. Это не Edge Function вызов (бесплатно), но создаёт нагрузку на DB connections.

Оптимизация: увеличить `baseIntervalMs` по умолчанию с 120,000 (2 мин) до 600,000 (10 мин). Банер "backend недоступен" всё равно появится, просто с 10-минутной задержкой вместо 2-минутной — для пользователей разница несущественна.

---

### Изменения по файлам

**1. SQL через insert tool (не миграция — это изменение данных)**
```sql
SELECT cron.alter_job(
  job_id := 3,
  command := $job$
  SELECT net.http_post(
    url := 'https://qqnekbzcgqvpgcyqlbcr.supabase.co/functions/v1/cleanup-old-zip-files',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbmVrYnpjZ3F2cGdjeXFsYmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzM5MzUsImV4cCI6MjA4MTM0OTkzNX0.xKxsCxrk79VYiNbvQ-NDPCVpcjBYGBWQclByv4fI8QM", "x-triggered-by": "cron"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $job$
);
```

**2. Миграция — добавить `last_cleanup_at` в `system_limits`**
```sql
ALTER TABLE system_limits ADD COLUMN IF NOT EXISTS last_cleanup_at timestamptz NULL;
```

**3. `supabase/functions/cleanup-stale-generations/index.ts`**
- После SMART EXIT (проверки `activeCount === 0`), добавить проверку `last_cleanup_at`:
  - Если последний запуск был < 10 минут назад — вернуть `{ skipped: true, reason: "too_recent" }`
- В конце успешного выполнения — обновить `last_cleanup_at` в `system_limits`
- Это гарантирует максимум 1 реальный запуск каждые 10 минут даже при множественных вызовах

**4. `src/hooks/useBackendHealth.ts`**
- Изменить: `baseIntervalMs = 120000` → `baseIntervalMs = 600000` (2 мин → 10 мин)

**5. Удалить: `src/hooks/useStuckGenerationRetry.ts`** (мёртвый неиспользуемый файл)

---

### Итоговая таблица

| Проблема | Статус | После исправления |
|---|---|---|
| jobid:1, jobid:2 (каждую минуту/5 мин) | Убиты в 14:55 ✅ | — |
| jobid:3 вызывает неправильную функцию | Активна ошибка | Починить URL → cleanup-old-zip-files |
| Параллельные вызовы при race condition | Нет защиты | last_cleanup_at guard (10 мин minimum) |
| useBackendHealth ping каждые 2 мин | Активно | Увеличить до 10 мин |
| useStuckGenerationRetry мёртвый код | Файл есть | Удалить |

**Основной вывод:** Главная утечка денег была от `jobid:1` и `jobid:2` которые запускались каждую минуту. Они убиты. Сейчас cron работает нормально (каждые 30 мин). Добавляем защиту от параллельных вызовов и чиним неправильный URL в `jobid:3`.
