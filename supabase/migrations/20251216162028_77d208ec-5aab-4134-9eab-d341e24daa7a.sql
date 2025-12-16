-- Add column to track specific AI model used
ALTER TABLE public.generation_history 
ADD COLUMN specific_ai_model text;