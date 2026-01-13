-- ============================================================
-- ПОВНА МІГРАЦІЯ БАЗИ ДАНИХ
-- Створено: 2026-01-13
-- Застосуйте цей файл у SQL Editor вашого Supabase проекту
-- ============================================================

-- ============================================================
-- 1. БАЗОВІ ТАБЛИЦІ ТА ФУНКЦІЇ
-- ============================================================

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- 2. GENERATION HISTORY
-- ============================================================

CREATE TABLE public.generation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number SERIAL,
  prompt TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  zip_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  files_data jsonb,
  error_message text,
  ai_model text DEFAULT 'junior',
  website_type text DEFAULT 'html',
  site_name TEXT,
  sale_price DECIMAL(10,2),
  generation_cost DECIMAL(10,2),
  specific_ai_model text,
  image_source text DEFAULT 'basic',
  team_id uuid,
  completed_at TIMESTAMP WITH TIME ZONE,
  improved_prompt TEXT DEFAULT NULL,
  geo TEXT DEFAULT NULL,
  vip_prompt text DEFAULT NULL
);

ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_generation_history_status ON public.generation_history(status);
CREATE INDEX IF NOT EXISTS idx_generation_history_team_id ON public.generation_history(team_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_history;

-- ============================================================
-- 3. PROFILES
-- ============================================================

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT false,
  max_concurrent_generations integer NOT NULL DEFAULT 30,
  CONSTRAINT check_max_concurrent_generations CHECK (max_concurrent_generations >= 1 AND max_concurrent_generations <= 100)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'display_name');
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- 4. USER ROLES
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'super_admin');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::app_role
  )
$$;

-- ============================================================
-- 5. TEAMS
-- ============================================================

CREATE TYPE public.team_role AS ENUM ('owner', 'team_lead', 'buyer', 'tech_dev');
CREATE TYPE public.member_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  balance numeric NOT NULL DEFAULT 0,
  assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  credit_limit numeric NOT NULL DEFAULT 0,
  max_referral_invites integer NOT NULL DEFAULT 4
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_teams_assigned_admin ON public.teams(assigned_admin_id);

-- Enable realtime for teams
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;

-- Add foreign key for generation_history.team_id
ALTER TABLE public.generation_history
ADD CONSTRAINT generation_history_team_id_fkey
FOREIGN KEY (team_id)
REFERENCES public.teams(id)
ON DELETE SET NULL;

-- ============================================================
-- 6. TEAM MEMBERS
-- ============================================================

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

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- 7. TEAM PRICING
-- ============================================================

CREATE TABLE public.team_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  html_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  react_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  generation_cost_junior DECIMAL(10,2) NOT NULL DEFAULT 0.10,
  generation_cost_senior DECIMAL(10,2) NOT NULL DEFAULT 0.25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  external_price numeric DEFAULT 7,
  vip_extra_price numeric DEFAULT 2,
  UNIQUE(team_id)
);

ALTER TABLE public.team_pricing ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_team_pricing_updated_at
BEFORE UPDATE ON public.team_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. INVITE CODES
-- ============================================================

CREATE TABLE public.invite_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_role team_role
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. APPEALS
-- ============================================================

CREATE TABLE public.appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES public.generation_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  amount_to_refund NUMERIC NOT NULL DEFAULT 0,
  admin_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  screenshot_url TEXT,
  screenshot_urls jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_appeals_status ON public.appeals(status);
CREATE INDEX idx_appeals_user_id ON public.appeals(user_id);
CREATE INDEX idx_appeals_team_id ON public.appeals(team_id);

-- ============================================================
-- 10. APPEAL SCREENSHOTS STORAGE
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('appeal-screenshots', 'appeal-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload appeal screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'appeal-screenshots' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view appeal screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'appeal-screenshots');

CREATE POLICY "Users can delete own appeal screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'appeal-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- 12. SUPPORT SYSTEM
-- ============================================================

CREATE TABLE public.support_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

CREATE TRIGGER update_support_conversations_updated_at
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 13. FEEDBACK & QUOTES
-- ============================================================

CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Insert default quotes
INSERT INTO public.quotes (text, author, created_by) VALUES
('Код — це поезія, яку розуміють машини', 'Генератор мудростей v2.0', '00000000-0000-0000-0000-000000000000'),
('Найкращий код — той, який не потрібно писати', 'Лінивий програміст', '00000000-0000-0000-0000-000000000000'),
('Спочатку вирішуй проблему, потім пиши код', 'Джон Джонсон', '00000000-0000-0000-0000-000000000000'),
('Простота — передумова надійності', 'Едсгер Дейкстра', '00000000-0000-0000-0000-000000000000'),
('Працюючий код завжди кращий за ідеальний, якого немає', 'Прагматичний розробник', '00000000-0000-0000-0000-000000000000');

-- ============================================================
-- 14. BALANCE TRANSACTIONS & REQUESTS
-- ============================================================

CREATE TABLE public.balance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  note TEXT NOT NULL,
  admin_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_balance_transactions_team_id ON public.balance_transactions(team_id);
CREATE INDEX idx_balance_transactions_created_at ON public.balance_transactions(created_at DESC);

CREATE TABLE public.balance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  amount NUMERIC NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_comment TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 15. PAYMENT ADDRESSES
-- ============================================================

CREATE TABLE public.payment_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL UNIQUE,
  address text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_address_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  old_address text,
  new_address text NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_address_history ENABLE ROW LEVEL SECURITY;

-- Insert default addresses
INSERT INTO public.payment_addresses (network, address) VALUES
  ('TRC20 (USDT)', 'TDdkv5moLsjkjtL5pUXsgDZ79HGYB8k2kS'),
  ('ERC20 (USDT)', '0x5fda65463736a538b29055eee3fdf3920f9ea3e2'),
  ('BTC', ''),
  ('ETH', '');

-- ============================================================
-- 16. REFERRAL SYSTEM
-- ============================================================

CREATE TABLE public.referral_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_reward numeric NOT NULL DEFAULT 70,
  milestone_reward numeric NOT NULL DEFAULT 70,
  milestone_generations integer NOT NULL DEFAULT 50,
  new_user_bonus numeric NOT NULL DEFAULT 100,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  default_max_referral_invites integer NOT NULL DEFAULT 4
);

INSERT INTO public.referral_settings (id, invite_reward, milestone_reward, milestone_generations, new_user_bonus)
VALUES (gen_random_uuid(), 70, 70, 50, 100);

ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.referral_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id),
  referrer_team_id uuid REFERENCES public.teams(id),
  invited_user_id uuid REFERENCES auth.users(id),
  invited_team_id uuid REFERENCES public.teams(id),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  milestone_reached boolean NOT NULL DEFAULT false
);

ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_referral_invites_code ON public.referral_invites(code);
CREATE INDEX idx_referral_invites_referrer ON public.referral_invites(referrer_user_id);

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

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_referral_rewards_status ON public.referral_rewards(status);

-- ============================================================
-- 17. ADMIN TASKS
-- ============================================================

CREATE TYPE public.admin_task_status AS ENUM ('todo', 'in_progress', 'done', 'problematic');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE public.admin_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status admin_task_status NOT NULL DEFAULT 'todo',
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL,
  created_by UUID NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  priority task_priority NOT NULL DEFAULT 'medium'
);

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;

-- Enable realtime for admin_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_tasks;

CREATE TABLE public.task_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
  old_status admin_task_status NULL,
  new_status admin_task_status NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- ============================================================
-- 18. GENERATION SPENDS
-- ============================================================

CREATE TABLE public.generation_spends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES public.generation_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  spend_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_favorite boolean NOT NULL DEFAULT false,
  UNIQUE(generation_id)
);

ALTER TABLE public.generation_spends ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_generation_spends_updated_at
BEFORE UPDATE ON public.generation_spends
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 19. SPEND SETS
-- ============================================================

CREATE TABLE public.spend_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  generation_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.spend_sets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_spend_sets_updated_at
BEFORE UPDATE ON public.spend_sets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 20. ФУНКЦІЯ РЕЄСТРАЦІЇ З ІНВАЙТ-КОДОМ
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_with_invite_code(
  p_invite_code TEXT,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_result jsonb;
BEGIN
  SELECT id, team_id, assigned_role, is_active, used_by
  INTO v_invite
  FROM invite_codes
  WHERE code = UPPER(p_invite_code)
    AND is_active = true
    AND used_by IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or used invite code');
  END IF;
  
  UPDATE invite_codes
  SET used_by = p_user_id,
      used_at = NOW()
  WHERE id = v_invite.id;
  
  IF v_invite.team_id IS NOT NULL AND v_invite.assigned_role IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role, status)
    VALUES (
      v_invite.team_id,
      p_user_id,
      v_invite.assigned_role,
      CASE 
        WHEN v_invite.assigned_role = 'owner' THEN 'approved'::member_status
        ELSE 'pending'::member_status
      END
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'team_id', v_invite.team_id,
      'role', v_invite.assigned_role,
      'status', CASE WHEN v_invite.assigned_role = 'owner' THEN 'approved' ELSE 'pending' END
    );
  END IF;
  
  RETURN jsonb_build_object('success', true, 'team_id', null, 'role', null);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_with_invite_code(TEXT, UUID) TO authenticated;

-- ============================================================
-- 21. RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- USER ROLES
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- GENERATION HISTORY
CREATE POLICY "Users can view their own generations" ON public.generation_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own generations" ON public.generation_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own generations" ON public.generation_history FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own generations" ON public.generation_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all generations" ON public.generation_history FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- TEAMS
CREATE POLICY "Admins can manage all teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team members can view their teams" ON public.teams FOR SELECT USING (is_team_member(auth.uid(), id));

-- TEAM MEMBERS
CREATE POLICY "Admins can manage all team members" ON public.team_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can view all members of their team" ON public.team_members FOR SELECT USING (is_team_owner(auth.uid(), team_id));
CREATE POLICY "Team owners can update members of their team" ON public.team_members FOR UPDATE USING (is_team_owner(auth.uid(), team_id));
CREATE POLICY "Users can view their own membership" ON public.team_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own pending membership" ON public.team_members FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- TEAM PRICING
CREATE POLICY "Admins can manage team pricing" ON public.team_pricing FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- INVITE CODES
CREATE POLICY "Admins can view all invite codes" ON public.invite_codes FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create invite codes" ON public.invite_codes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update invite codes" ON public.invite_codes FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can validate invite codes" ON public.invite_codes FOR SELECT USING (is_active = true AND used_by IS NULL);
CREATE POLICY "Team owners can view their team invite codes" ON public.invite_codes FOR SELECT USING (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));
CREATE POLICY "Team owners can create team invite codes" ON public.invite_codes FOR INSERT WITH CHECK (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));
CREATE POLICY "Team owners can update their team invite codes" ON public.invite_codes FOR UPDATE USING (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));

-- APPEALS
CREATE POLICY "Users can create their own appeals" ON public.appeals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own appeals" ON public.appeals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all appeals" ON public.appeals FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update appeals" ON public.appeals FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- NOTIFICATIONS
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- SUPPORT CONVERSATIONS
CREATE POLICY "Users can view their own conversations" ON public.support_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own conversations" ON public.support_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all conversations" ON public.support_conversations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update conversations" ON public.support_conversations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- SUPPORT MESSAGES
CREATE POLICY "Users can view messages in their conversations" ON public.support_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.support_conversations WHERE id = conversation_id AND user_id = auth.uid()));
CREATE POLICY "Users can send messages in their conversations" ON public.support_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.support_conversations WHERE id = conversation_id AND user_id = auth.uid()) AND is_admin = false);
CREATE POLICY "Admins can view all messages" ON public.support_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can send messages" ON public.support_messages FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_admin = true);

-- FEEDBACK
CREATE POLICY "Users can create feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all feedback" ON public.feedback FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete feedback" ON public.feedback FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- QUOTES
CREATE POLICY "Anyone can view active quotes" ON public.quotes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage quotes" ON public.quotes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- BALANCE TRANSACTIONS
CREATE POLICY "Admins can view all balance transactions" ON public.balance_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create balance transactions" ON public.balance_transactions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- BALANCE REQUESTS
CREATE POLICY "Users can create their own balance requests" ON public.balance_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own balance requests" ON public.balance_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all balance requests" ON public.balance_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update balance requests" ON public.balance_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can view their team balance requests" ON public.balance_requests FOR SELECT USING (is_team_owner(auth.uid(), team_id));

-- PAYMENT ADDRESSES
CREATE POLICY "Anyone can view active payment addresses" ON public.payment_addresses FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage payment addresses" ON public.payment_addresses FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view payment history" ON public.payment_address_history FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can insert payment history" ON public.payment_address_history FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

-- REFERRAL SETTINGS
CREATE POLICY "Anyone can view referral settings" ON public.referral_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update referral settings" ON public.referral_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- REFERRAL INVITES
CREATE POLICY "Users can view their own referral invites" ON public.referral_invites FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = invited_user_id);
CREATE POLICY "Users can create referral invites" ON public.referral_invites FOR INSERT WITH CHECK (auth.uid() = referrer_user_id);
CREATE POLICY "Admins can view all referral invites" ON public.referral_invites FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update referral invites" ON public.referral_invites FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- REFERRAL REWARDS
CREATE POLICY "Users can view their own rewards" ON public.referral_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all rewards" ON public.referral_rewards FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update rewards" ON public.referral_rewards FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can create rewards" ON public.referral_rewards FOR INSERT WITH CHECK (true);

-- ADMIN TASKS
CREATE POLICY "Admins can view all tasks" ON public.admin_tasks FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create tasks" ON public.admin_tasks FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update tasks" ON public.admin_tasks FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete tasks" ON public.admin_tasks FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- TASK STATUS HISTORY
CREATE POLICY "Admins can view task history" ON public.task_status_history FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create task history" ON public.task_status_history FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- TASK COMMENTS
CREATE POLICY "Admins can view task comments" ON public.task_comments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create task comments" ON public.task_comments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete their own comments" ON public.task_comments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

-- GENERATION SPENDS
CREATE POLICY "Users can view their own spends" ON public.generation_spends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own spends" ON public.generation_spends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own spends" ON public.generation_spends FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own spends" ON public.generation_spends FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all spends" ON public.generation_spends FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can view team spends" ON public.generation_spends FOR SELECT USING (EXISTS (SELECT 1 FROM generation_history gh JOIN team_members tm ON gh.team_id = tm.team_id WHERE gh.id = generation_spends.generation_id AND tm.user_id = auth.uid() AND tm.role = 'owner'));

-- SPEND SETS
CREATE POLICY "Users can view their own sets" ON public.spend_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own sets" ON public.spend_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sets" ON public.spend_sets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sets" ON public.spend_sets FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ЗАВЕРШЕННЯ
-- ============================================================

-- Примітка: Після застосування цієї міграції не забудьте:
-- 1. Налаштувати Edge Function секрети
-- 2. Налаштувати автоматичне підтвердження email в Auth Settings
-- 3. Додати першого admin/super_admin користувача вручну в user_roles
