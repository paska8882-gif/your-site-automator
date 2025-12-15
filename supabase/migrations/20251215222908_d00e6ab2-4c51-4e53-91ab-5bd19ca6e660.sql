-- Add column to track which AI model was used
ALTER TABLE public.generation_history 
ADD COLUMN ai_model text DEFAULT 'junior';

-- Add column to track website type (html or react)
ALTER TABLE public.generation_history 
ADD COLUMN website_type text DEFAULT 'html';

-- Allow users to update their own generations
CREATE POLICY "Users can update their own generations"
ON public.generation_history
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);