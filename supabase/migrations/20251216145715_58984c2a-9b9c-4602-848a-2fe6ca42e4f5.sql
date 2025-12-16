-- Create team pricing table
CREATE TABLE public.team_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  html_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  react_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  generation_cost_junior DECIMAL(10,2) NOT NULL DEFAULT 0.10,
  generation_cost_senior DECIMAL(10,2) NOT NULL DEFAULT 0.25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- Enable RLS
ALTER TABLE public.team_pricing ENABLE ROW LEVEL SECURITY;

-- Only super admin (admins) can manage pricing
CREATE POLICY "Admins can manage team pricing"
ON public.team_pricing
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_team_pricing_updated_at
BEFORE UPDATE ON public.team_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add sale_price to generation_history to track individual sales
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS generation_cost DECIMAL(10,2);