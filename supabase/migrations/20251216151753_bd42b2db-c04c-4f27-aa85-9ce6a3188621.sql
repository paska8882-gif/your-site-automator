-- Create appeals table
CREATE TABLE public.appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES public.generation_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  amount_to_refund NUMERIC NOT NULL DEFAULT 0,
  admin_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- Users can create appeals for their own generations
CREATE POLICY "Users can create their own appeals"
ON public.appeals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own appeals
CREATE POLICY "Users can view their own appeals"
ON public.appeals
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all appeals
CREATE POLICY "Admins can view all appeals"
ON public.appeals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update appeals
CREATE POLICY "Admins can update appeals"
ON public.appeals
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_appeals_status ON public.appeals(status);
CREATE INDEX idx_appeals_user_id ON public.appeals(user_id);
CREATE INDEX idx_appeals_team_id ON public.appeals(team_id);