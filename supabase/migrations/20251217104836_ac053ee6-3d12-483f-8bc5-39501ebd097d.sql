-- Add assigned_admin_id column to teams table
ALTER TABLE public.teams 
ADD COLUMN assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_teams_assigned_admin ON public.teams(assigned_admin_id);