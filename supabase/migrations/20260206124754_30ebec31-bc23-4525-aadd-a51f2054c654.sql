
-- Create team_admins junction table for multiple admins per team
CREATE TABLE public.team_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id, admin_id)
);

-- Enable RLS
ALTER TABLE public.team_admins ENABLE ROW LEVEL SECURITY;

-- Admins can manage team_admins
CREATE POLICY "Admins can manage team_admins"
ON public.team_admins
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_team_admins_team ON public.team_admins(team_id);
CREATE INDEX idx_team_admins_admin ON public.team_admins(admin_id);

-- Migrate existing data from teams.assigned_admin_id
INSERT INTO public.team_admins (team_id, admin_id)
SELECT id, assigned_admin_id FROM public.teams
WHERE assigned_admin_id IS NOT NULL
ON CONFLICT DO NOTHING;
