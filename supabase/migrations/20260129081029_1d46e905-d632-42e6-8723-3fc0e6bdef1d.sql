
-- Create cleanup_logs table for monitoring
CREATE TABLE public.cleanup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  zips_cleared INTEGER NOT NULL DEFAULT 0,
  files_cleared INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  retried INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'cron'
);

-- Enable RLS
ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view cleanup logs
CREATE POLICY "Super admins can view cleanup logs"
  ON public.cleanup_logs
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Service role can insert logs
CREATE POLICY "Service role can insert cleanup logs"
  ON public.cleanup_logs
  FOR INSERT
  WITH CHECK (true);
