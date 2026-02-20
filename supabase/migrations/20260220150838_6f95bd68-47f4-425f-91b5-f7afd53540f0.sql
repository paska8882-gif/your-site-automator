
-- 1. Update cleanup_stale_generations: timeout 1 hour -> 25 minutes
CREATE OR REPLACE FUNCTION public.cleanup_stale_generations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_active_count integer;
  v_stale_count integer;
  v_processed integer := 0;
  v_appeals_created integer := 0;
  v_counter_synced boolean := false;
  v_old_counter integer;
  v_new_counter integer;
  v_last_cleanup timestamptz;
  v_stale_row record;
  v_team_id uuid;
  v_existing_appeal_id uuid;
  v_refund numeric;
  v_timeout_ago timestamptz := now() - interval '25 minutes';
BEGIN
  -- SMART EXIT: Check if there's any active work
  SELECT count(*) INTO v_active_count
  FROM generation_history
  WHERE status IN ('pending', 'generating');

  IF v_active_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_active_generations');
  END IF;

  -- RATE-LIMIT GUARD: max 1 real run per 10 minutes
  SELECT last_cleanup_at INTO v_last_cleanup
  FROM system_limits WHERE id = 'global';

  IF v_last_cleanup IS NOT NULL AND (now() - v_last_cleanup) < interval '10 minutes' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'too_recent');
  END IF;

  -- Mark start
  UPDATE system_limits SET last_cleanup_at = now() WHERE id = 'global';

  -- Process stale generations (>25 minutes)
  FOR v_stale_row IN
    SELECT id, user_id, team_id, sale_price, admin_note
    FROM generation_history
    WHERE status IN ('pending', 'generating')
      AND created_at < v_timeout_ago
  LOOP
    v_refund := COALESCE(v_stale_row.sale_price, 0);
    v_team_id := v_stale_row.team_id;

    -- Fallback: find team_id from membership if missing
    IF v_team_id IS NULL AND v_stale_row.user_id IS NOT NULL THEN
      SELECT tm.team_id INTO v_team_id
      FROM team_members tm
      WHERE tm.user_id = v_stale_row.user_id AND tm.status = 'approved'
      LIMIT 1;
    END IF;

    -- Create appeal if user exists and no existing appeal
    IF v_stale_row.user_id IS NOT NULL THEN
      SELECT a.id INTO v_existing_appeal_id
      FROM appeals a WHERE a.generation_id = v_stale_row.id LIMIT 1;

      IF v_existing_appeal_id IS NULL THEN
        INSERT INTO appeals (generation_id, user_id, team_id, reason, status, amount_to_refund, admin_comment)
        VALUES (
          v_stale_row.id,
          v_stale_row.user_id,
          v_team_id,
          'Автоповідомлення: генерація перевищила час очікування (>25 хв). Потребує розгляду адміністратором.',
          'pending',
          v_refund,
          '⏱️ Auto-timeout 25min. Suggested refund: $' || v_refund::text
        );
        v_appeals_created := v_appeals_created + 1;
      END IF;
    END IF;

    -- Mark as failed
    UPDATE generation_history
    SET status = 'failed',
        error_message = 'Перевищено час очікування (25 хв). Апеляцію створено автоматично.'
    WHERE id = v_stale_row.id;

    v_processed := v_processed + 1;
  END LOOP;

  -- Sync active_generations counter
  SELECT count(*) INTO v_new_counter
  FROM generation_history
  WHERE status IN ('pending', 'generating');

  SELECT active_generations INTO v_old_counter
  FROM system_limits WHERE id = 'global';

  IF v_old_counter IS DISTINCT FROM v_new_counter THEN
    UPDATE system_limits
    SET active_generations = v_new_counter, updated_at = now()
    WHERE id = 'global';
    v_counter_synced := true;
  END IF;

  -- Log only when work was done
  IF v_processed > 0 OR v_appeals_created > 0 THEN
    INSERT INTO cleanup_logs (zips_cleared, files_cleared, processed, retried, success, triggered_by)
    VALUES (0, 0, v_processed, 0, true, 'pg_cron');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'appealsCreated', v_appeals_created,
    'counterSynced', v_counter_synced,
    'counterBefore', v_old_counter,
    'counterAfter', v_new_counter
  );
END;
$function$;

-- 2. Remove dead cron job that calls non-existent Edge Function cleanup-old-zip-files
SELECT cron.unschedule(3);
