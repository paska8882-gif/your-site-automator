-- Add site_name column to generation_history table
ALTER TABLE public.generation_history ADD COLUMN site_name TEXT;