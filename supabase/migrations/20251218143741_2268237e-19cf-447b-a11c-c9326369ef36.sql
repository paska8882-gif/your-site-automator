-- Add completed_at column to track generation completion time
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;