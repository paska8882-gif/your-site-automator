-- Add manual_price column to team_pricing for manual generation pricing
ALTER TABLE public.team_pricing
ADD COLUMN manual_price numeric DEFAULT 0;