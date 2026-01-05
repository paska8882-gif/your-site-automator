-- Create table for tracking spends per generation
CREATE TABLE public.generation_spends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES public.generation_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  spend_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(generation_id)
);

-- Enable RLS
ALTER TABLE public.generation_spends ENABLE ROW LEVEL SECURITY;

-- Users can view spends for their own generations
CREATE POLICY "Users can view their own spends"
ON public.generation_spends
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert spends for their own generations
CREATE POLICY "Users can insert their own spends"
ON public.generation_spends
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own spends
CREATE POLICY "Users can update their own spends"
ON public.generation_spends
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own spends
CREATE POLICY "Users can delete their own spends"
ON public.generation_spends
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all spends
CREATE POLICY "Admins can view all spends"
ON public.generation_spends
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Team owners can view their team members' spends
CREATE POLICY "Team owners can view team spends"
ON public.generation_spends
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM generation_history gh
    JOIN team_members tm ON gh.team_id = tm.team_id
    WHERE gh.id = generation_spends.generation_id
    AND tm.user_id = auth.uid()
    AND tm.role = 'owner'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_generation_spends_updated_at
BEFORE UPDATE ON public.generation_spends
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();