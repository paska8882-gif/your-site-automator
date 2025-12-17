-- Add credit_limit column to teams table
ALTER TABLE public.teams 
ADD COLUMN credit_limit numeric NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.teams.credit_limit IS 'Maximum allowed negative balance (credit limit) for the team';