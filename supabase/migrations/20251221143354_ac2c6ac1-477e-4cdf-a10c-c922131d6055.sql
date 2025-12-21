
-- Add max referral invites limit to teams
ALTER TABLE public.teams ADD COLUMN max_referral_invites integer NOT NULL DEFAULT 4;

-- Add comment explaining the field
COMMENT ON COLUMN public.teams.max_referral_invites IS 'Maximum active referral invites that have not reached milestone';
