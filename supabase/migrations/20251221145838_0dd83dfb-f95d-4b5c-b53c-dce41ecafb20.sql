-- Add default_max_referral_invites to referral_settings
ALTER TABLE public.referral_settings 
ADD COLUMN default_max_referral_invites integer NOT NULL DEFAULT 4;