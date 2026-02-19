
## Оптимизация расходов: cleanup-stale-generations и check-problematic-tasks

### Текущая проблема (факты из базы данных)

Cron jobs сейчас:
- `cleanup-stale-generations-every-minute` — запускается **каждую минуту** = 1,440 вызовов/день
- `cleanup-old-zip-files` — тот же cleanup, но раз в день в 3:00 (дублирует!)  
- `check-problematic-tasks` — каждые 5 минут = 288 вызовов/день

Итого: **1,728 вызовов Edge Functions в день** только от cron. При этом в базе сейчас 0 активных задач, которые нужно проверять, и 1 генерация в процессе — каждые 99% вызовов делают работу вхолостую.

---

### Что будет сделано

**Шаг 1: Исправить расписание cron jobs**

Удалить `cleanup-stale-generations-every-minute` (каждую минуту) и создать новый — каждые **30 минут**. Это уже 48 вызовов вместо 1,440 — снижение в **30 раз**.

Также удалить дублирующий `cleanup-old-zip-files` (он делает то же самое через другой cron).

`check-problematic-tasks` изменить с 5 минут на **30 минут** — 48 вызовов вместо 288.

Итого вместо 1,728 вызовов → **96 вызовов в день**.

**Шаг 2: Добавить "умный выход" в начало обеих функций**

Самое важное изменение — если нечего делать, выйти немедленно, не выполняя никакой работы:

Для `cleanup-stale-generations`:
```
Сначала проверить: есть ли вообще генерации в статусе pending/generating?
Если нет — сразу вернуть {"skipped": true}, не делать 5+ запросов к БД
Если есть старые (>1h) — только тогда делать полный цикл работы
Для cleanup старых zip — перенести в отдельный cron раз в сутки
```

Для `check-problematic-tasks`:
```
Сначала проверить: есть ли задачи в статусе todo/in_progress?
Если нет — сразу вернуть {"skipped": true}
Если есть — только тогда проверять дедлайны
```

**Шаг 3: Разделить cleanup на 2 отдельные задачи**

Сейчас в одной функции смешано:
- Отметить зависшие генерации как failed (нужно часто, но только когда есть активные)
- Удалить старые zip/files данные (нужно раз в сутки)

После разделения:
- `cleanup-stale-generations` — только проверка зависших, каждые 30 минут, но с умным выходом
- `cleanup-old-zip-files` остаётся раз в день в 3:00 (уже есть, просто убрать из общего cleanup)

---

### Технические изменения

**Файл 1: `supabase/functions/cleanup-stale-generations/index.ts`**
- В начале функции: один быстрый COUNT запрос
- Если `count = 0` — return immediately (0 работы)
- Убрать шаг 3 (zip cleanup) — он будет в отдельном cron
- Убрать запись в `cleanup_logs` при пустом запуске (экономия INSERT)

**Файл 2: `supabase/functions/check-problematic-tasks/index.ts`**  
- В начале: один быстрый COUNT запрос `WHERE status IN ('todo','in_progress')`
- Если `count = 0` — return immediately

**SQL для cron (через insert tool):**
```sql
-- Удалить старые дублирующие jobs
SELECT cron.unschedule('cleanup-stale-generations-every-minute');
SELECT cron.unschedule('cleanup-old-zip-files');

-- Создать новый cleanup каждые 30 минут
SELECT cron.schedule('cleanup-stale-generations', '*/30 * * * *', $$...$$);

-- Zip cleanup раз в сутки в 3:00
SELECT cron.schedule('cleanup-old-zip-files', '0 3 * * *', $$...$$);

-- check-problematic-tasks каждые 30 минут вместо 5
SELECT cron.unschedule('check-problematic-tasks');
SELECT cron.schedule('check-problematic-tasks', '*/30 * * * *', $$...$$);
```

---

### Ожидаемый результат

| Метрика | Сейчас | После |
|---|---|---|
| Вызовов Edge Functions/день | 1,728 | ~96 |
| Реальная работа при 0 активных | 5+ DB запросов каждый раз | 1 COUNT запрос, выход |
| Расход credits/день от cron | ~$3–5 | ~$0.20–0.40 |

При таком подходе цель **1–2 доллара в день** достигается с запасом — cron jobs займут < $0.50, остальное — реальные генерации пользователей и AI вызовы.
