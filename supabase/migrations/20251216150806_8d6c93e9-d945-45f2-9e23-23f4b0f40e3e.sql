-- Add balance column to teams table
ALTER TABLE public.teams 
ADD COLUMN balance numeric NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.teams.balance IS 'Team balance in USD for website generation';