-- Create team roles enum
CREATE TYPE public.team_role AS ENUM ('owner', 'team_lead', 'buyer', 'tech_dev');

-- Create team member status enum
CREATE TYPE public.member_status AS ENUM ('pending', 'approved', 'rejected');

-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role team_role NOT NULL,
  status member_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  UNIQUE(team_id, user_id)
);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Add team_id and assigned_role to invite_codes
ALTER TABLE public.invite_codes 
ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
ADD COLUMN assigned_role team_role;

-- Function to check if user is team owner
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'owner'
      AND status = 'approved'
  )
$$;

-- Function to check if user is team member (approved)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND status = 'approved'
  )
$$;

-- Teams RLS policies
CREATE POLICY "Admins can manage all teams"
ON public.teams
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members can view their teams"
ON public.teams
FOR SELECT
USING (is_team_member(auth.uid(), id));

-- Team members RLS policies
CREATE POLICY "Admins can manage all team members"
ON public.team_members
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team owners can view all members of their team"
ON public.team_members
FOR SELECT
USING (is_team_owner(auth.uid(), team_id));

CREATE POLICY "Team owners can update members of their team"
ON public.team_members
FOR UPDATE
USING (is_team_owner(auth.uid(), team_id));

CREATE POLICY "Users can view their own membership"
ON public.team_members
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending membership"
ON public.team_members
FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Update invite_codes policies to include team owners
CREATE POLICY "Team owners can view their team invite codes"
ON public.invite_codes
FOR SELECT
USING (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));

CREATE POLICY "Team owners can create team invite codes"
ON public.invite_codes
FOR INSERT
WITH CHECK (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));

CREATE POLICY "Team owners can update their team invite codes"
ON public.invite_codes
FOR UPDATE
USING (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));