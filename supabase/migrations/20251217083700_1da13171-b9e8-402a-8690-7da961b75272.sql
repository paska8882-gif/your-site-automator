-- Add external site pricing to team_pricing table
ALTER TABLE public.team_pricing 
ADD COLUMN IF NOT EXISTS external_price numeric DEFAULT 7;

-- Add comment for clarity
COMMENT ON COLUMN public.team_pricing.external_price IS 'Sale price for external (Codex/v0/onepage) generated sites per team';