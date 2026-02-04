-- Add generation_disabled column to maintenance_mode table
ALTER TABLE public.maintenance_mode 
ADD COLUMN IF NOT EXISTS generation_disabled boolean NOT NULL DEFAULT false;

-- Add generation maintenance message
ALTER TABLE public.maintenance_mode 
ADD COLUMN IF NOT EXISTS generation_message text DEFAULT 'Ведеться технічне обслуговування. Генерація тимчасово недоступна.';