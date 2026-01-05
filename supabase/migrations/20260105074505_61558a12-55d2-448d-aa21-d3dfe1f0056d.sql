-- Create table for saved spend sets
CREATE TABLE public.spend_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  generation_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.spend_sets ENABLE ROW LEVEL SECURITY;

-- Users can manage their own sets
CREATE POLICY "Users can view their own sets" 
ON public.spend_sets FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sets" 
ON public.spend_sets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sets" 
ON public.spend_sets FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sets" 
ON public.spend_sets FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_spend_sets_updated_at
BEFORE UPDATE ON public.spend_sets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();