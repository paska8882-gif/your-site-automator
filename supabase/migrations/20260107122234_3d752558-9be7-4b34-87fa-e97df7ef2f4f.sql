-- Add vip_prompt column to generation_history
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS vip_prompt text DEFAULT NULL;

-- Add vip_extra_price column to team_pricing
ALTER TABLE public.team_pricing 
ADD COLUMN IF NOT EXISTS vip_extra_price numeric DEFAULT 2;