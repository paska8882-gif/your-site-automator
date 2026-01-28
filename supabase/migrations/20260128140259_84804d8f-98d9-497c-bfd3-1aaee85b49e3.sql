-- Add assigned_admin_id to track which admin took the manual request
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS assigned_admin_id uuid DEFAULT NULL;

-- Add taken_at timestamp to track when admin took the request
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS taken_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on manual requests by admin
CREATE INDEX IF NOT EXISTS idx_generation_history_assigned_admin 
ON public.generation_history(assigned_admin_id) 
WHERE assigned_admin_id IS NOT NULL;