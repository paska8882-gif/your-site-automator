-- Phase 2: Add system_limits table for rate limiting
CREATE TABLE IF NOT EXISTS public.system_limits (
  id TEXT PRIMARY KEY DEFAULT 'global',
  active_generations INTEGER NOT NULL DEFAULT 0,
  max_concurrent_generations INTEGER NOT NULL DEFAULT 50,
  max_generations_per_user INTEGER NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default global limits
INSERT INTO public.system_limits (id, active_generations, max_concurrent_generations, max_generations_per_user)
VALUES ('global', 0, 50, 3)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_limits ENABLE ROW LEVEL SECURITY;

-- Anyone can read limits (needed for frontend to check)
CREATE POLICY "Anyone can view system limits"
ON public.system_limits
FOR SELECT
USING (true);

-- Only service role can update (edge functions use service role)
CREATE POLICY "Service role can update system limits"
ON public.system_limits
FOR UPDATE
USING (auth.role() = 'service_role');

-- Function to increment active generations atomically
CREATE OR REPLACE FUNCTION public.increment_active_generations()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INTEGER;
  v_max INTEGER;
BEGIN
  SELECT active_generations, max_concurrent_generations
  INTO v_current, v_max
  FROM system_limits
  WHERE id = 'global'
  FOR UPDATE;
  
  IF v_current >= v_max THEN
    RETURN false;
  END IF;
  
  UPDATE system_limits
  SET active_generations = active_generations + 1,
      updated_at = now()
  WHERE id = 'global';
  
  RETURN true;
END;
$$;

-- Function to decrement active generations atomically
CREATE OR REPLACE FUNCTION public.decrement_active_generations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE system_limits
  SET active_generations = GREATEST(0, active_generations - 1),
      updated_at = now()
  WHERE id = 'global';
END;
$$;

-- Function to check user's concurrent generations
CREATE OR REPLACE FUNCTION public.get_user_active_generations(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM generation_history
  WHERE user_id = p_user_id
    AND status IN ('pending', 'generating');
$$;

-- Phase 3: Add indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_generation_history_user_status 
ON generation_history(user_id, status) 
WHERE status IN ('pending', 'generating');

CREATE INDEX IF NOT EXISTS idx_generation_history_user_created
ON generation_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, read) 
WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_admin_tasks_assigned_status 
ON admin_tasks(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_status_problematic
ON admin_tasks(status)
WHERE status = 'problematic';

CREATE INDEX IF NOT EXISTS idx_appeals_status
ON appeals(status)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_balance_requests_status
ON balance_requests(status)
WHERE status = 'pending';

-- Function to get task indicators in one query (optimization for useTaskIndicators)
CREATE OR REPLACE FUNCTION public.get_task_indicators(p_user_id UUID)
RETURNS TABLE(has_new_tasks BOOLEAN, has_problematic BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM admin_tasks
      WHERE assigned_to = p_user_id
        AND status = 'todo'
    ) AS has_new_tasks,
    EXISTS (
      SELECT 1 FROM admin_tasks
      WHERE status = 'problematic'
        AND (assigned_to = p_user_id OR created_by = p_user_id)
    ) AS has_problematic;
$$;