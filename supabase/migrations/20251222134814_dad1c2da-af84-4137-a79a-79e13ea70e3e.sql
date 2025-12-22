-- Add improved_prompt column to store the AI-enhanced prompt (commercial secret)
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS improved_prompt TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.generation_history.improved_prompt IS 'AI-improved prompt, visible only to admins. Original prompt field contains what the buyer submitted.';