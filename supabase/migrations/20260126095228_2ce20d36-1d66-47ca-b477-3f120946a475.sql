-- Add admin_note column to generation_history for manual request notes
ALTER TABLE public.generation_history
ADD COLUMN admin_note text;