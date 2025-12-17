-- Add image_source column to track photo selection mode (basic/ai)
ALTER TABLE public.generation_history 
ADD COLUMN image_source text DEFAULT 'basic';