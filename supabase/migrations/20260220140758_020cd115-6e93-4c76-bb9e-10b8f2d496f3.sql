
-- Create SQL function for check-problematic-tasks
CREATE OR REPLACE FUNCTION public.check_problematic_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_check timestamptz;
  v_active_count integer;
  v_updated integer := 0;
  v_notified integer := 0;
  v_task record;
  v_twelve_hours_ago timestamptz := now() - interval '12 hours';
BEGIN
  -- RATE-LIMIT GUARD: max 1 run per 10 minutes
  SELECT last_tasks_check_at INTO v_last_check
  FROM system_limits WHERE id = 'global';

  IF v_last_check IS NOT NULL AND (now() - v_last_check) < interval '10 minutes' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'rate_limited');
  END IF;

  -- Mark this run
  UPDATE system_limits SET last_tasks_check_at = now() WHERE id = 'global';

  -- SMART EXIT: any active tasks?
  SELECT count(*) INTO v_active_count
  FROM admin_tasks WHERE status IN ('todo', 'in_progress');

  IF v_active_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_active_tasks');
  END IF;

  -- Find and update problematic tasks
  FOR v_task IN
    SELECT id, status, created_at, deadline, title, created_by
    FROM admin_tasks
    WHERE status IN ('todo', 'in_progress')
      AND (
        (status = 'todo' AND created_at < v_twelve_hours_ago)
        OR (status = 'in_progress' AND deadline < now())
      )
  LOOP
    -- Mark as problematic
    UPDATE admin_tasks SET status = 'problematic' WHERE id = v_task.id;
    v_updated := v_updated + 1;

    -- Create notification
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      v_task.created_by,
      'Проблемне завдання',
      'Завдання "' || v_task.title || '" стало проблемним через прострочення',
      'task_problematic'
    );
    v_notified := v_notified + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated,
    'notified', v_notified
  );
END;
$$;

-- Unschedule old cron job (edge function version)
SELECT cron.unschedule('check-problematic-tasks');

-- Schedule new SQL-based cron job every 30 minutes
SELECT cron.schedule(
  'check-problematic-tasks-sql',
  '*/30 * * * *',
  $$SELECT public.check_problematic_tasks();$$
);
