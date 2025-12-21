
-- Create referral settings table (admin-configurable)
CREATE TABLE public.referral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_reward numeric NOT NULL DEFAULT 70,
  milestone_reward numeric NOT NULL DEFAULT 70,
  milestone_generations integer NOT NULL DEFAULT 50,
  new_user_bonus numeric NOT NULL DEFAULT 100,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.referral_settings (id, invite_reward, milestone_reward, milestone_generations, new_user_bonus)
VALUES (gen_random_uuid(), 70, 70, 50, 100);

-- Enable RLS
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view settings
CREATE POLICY "Anyone can view referral settings"
ON public.referral_settings FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update referral settings"
ON public.referral_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create referral invites table
CREATE TABLE public.referral_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id),
  referrer_team_id uuid REFERENCES public.teams(id),
  invited_user_id uuid REFERENCES auth.users(id),
  invited_team_id uuid REFERENCES public.teams(id),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

-- Users can view their own referral invites
CREATE POLICY "Users can view their own referral invites"
ON public.referral_invites FOR SELECT
USING (auth.uid() = referrer_user_id OR auth.uid() = invited_user_id);

-- Users can create referral invites
CREATE POLICY "Users can create referral invites"
ON public.referral_invites FOR INSERT
WITH CHECK (auth.uid() = referrer_user_id);

-- Admins can view all referral invites
CREATE POLICY "Admins can view all referral invites"
ON public.referral_invites FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update referral invites
CREATE POLICY "Admins can update referral invites"
ON public.referral_invites FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create referral rewards table
CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_invite_id uuid NOT NULL REFERENCES public.referral_invites(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  team_id uuid REFERENCES public.teams(id),
  reward_type text NOT NULL CHECK (reward_type IN ('invite', 'milestone', 'new_user_bonus')),
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamp with time zone,
  admin_comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Users can view their own rewards
CREATE POLICY "Users can view their own rewards"
ON public.referral_rewards FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all rewards
CREATE POLICY "Admins can view all rewards"
ON public.referral_rewards FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update rewards
CREATE POLICY "Admins can update rewards"
ON public.referral_rewards FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can create rewards
CREATE POLICY "Service can create rewards"
ON public.referral_rewards FOR INSERT
WITH CHECK (true);

-- Add milestone_reached flag to referral_invites
ALTER TABLE public.referral_invites ADD COLUMN milestone_reached boolean NOT NULL DEFAULT false;

-- Create index for faster lookups
CREATE INDEX idx_referral_invites_code ON public.referral_invites(code);
CREATE INDEX idx_referral_invites_referrer ON public.referral_invites(referrer_user_id);
CREATE INDEX idx_referral_rewards_status ON public.referral_rewards(status);
