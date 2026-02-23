-- =============================================================================
-- FULL MIGRATION SQL — Site Automator
-- Generated: 2026-02-23
-- 
-- This file contains the complete database schema for migrating to an external
-- Supabase project. Execute in order in the Supabase SQL Editor.
--
-- IMPORTANT: After running this SQL, you also need to:
-- 1. Deploy Edge Functions via CLI (supabase functions deploy)
-- 2. Set secrets (OPENAI_API_KEY, V0_API_KEY, PEXELS_API_KEY, etc.)
-- 3. Enable pg_cron extension and create cron jobs (see bottom of file)
-- 4. Enable Realtime for required tables (see bottom of file)
-- =============================================================================

-- ===================== EXTENSIONS =====================
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- ===================== ENUMS =====================
CREATE TYPE public.admin_task_status AS ENUM ('todo', 'in_progress', 'done', 'problematic');
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'super_admin');
CREATE TYPE public.member_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.team_role AS ENUM ('owner', 'team_lead', 'buyer', 'tech_dev');

-- ===================== SEQUENCES =====================
CREATE SEQUENCE IF NOT EXISTS public.generation_history_number_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1;

-- ===================== TABLES =====================

CREATE TABLE public.teams (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), balance numeric NOT NULL DEFAULT 0, assigned_admin_id uuid, credit_limit numeric NOT NULL DEFAULT 0, max_referral_invites integer NOT NULL DEFAULT 4, name text NOT NULL);
CREATE TABLE public.profiles (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_blocked boolean NOT NULL DEFAULT false, max_concurrent_generations integer NOT NULL DEFAULT 30, display_name text, avatar_url text);
CREATE TABLE public.user_roles (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, role public.app_role NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.team_members (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id), user_id uuid NOT NULL, role public.team_role NOT NULL, status public.member_status NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, approved_by uuid, UNIQUE(team_id, user_id));
CREATE TABLE public.team_admins (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id), admin_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(team_id, admin_id));
CREATE TABLE public.team_pricing (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, team_id uuid NOT NULL UNIQUE REFERENCES public.teams(id), html_price numeric NOT NULL DEFAULT 0, react_price numeric NOT NULL DEFAULT 0, generation_cost_junior numeric NOT NULL DEFAULT 0.10, generation_cost_senior numeric NOT NULL DEFAULT 0.25, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), external_price numeric DEFAULT 7, vip_extra_price numeric DEFAULT 2, manual_price numeric DEFAULT 0, php_price numeric DEFAULT 0);
CREATE TABLE public.generation_history (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, number integer NOT NULL DEFAULT nextval('generation_history_number_seq'::regclass), prompt text NOT NULL, language text NOT NULL DEFAULT 'en', zip_data text, created_at timestamptz NOT NULL DEFAULT now(), user_id uuid, status text NOT NULL DEFAULT 'pending', files_data jsonb, error_message text, ai_model text DEFAULT 'junior', website_type text DEFAULT 'html', site_name text, sale_price numeric, generation_cost numeric, specific_ai_model text, image_source text DEFAULT 'basic', team_id uuid REFERENCES public.teams(id), completed_at timestamptz, improved_prompt text, geo text, vip_prompt text, admin_note text, total_generation_cost numeric DEFAULT 0, retry_count integer DEFAULT 0, color_scheme text, layout_style text, assigned_admin_id uuid, taken_at timestamptz, vip_images jsonb, download_url text);
CREATE TABLE public.ai_generation_jobs (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending', domain text NOT NULL, geo text, languages text[] NOT NULL DEFAULT '{}', theme text, keywords text, prohibited_words text, technical_prompt text, files_data jsonb, validation jsonb, error_message text, created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz);
CREATE TABLE public.appeals (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, generation_id uuid NOT NULL REFERENCES public.generation_history(id), user_id uuid NOT NULL, team_id uuid REFERENCES public.teams(id), reason text NOT NULL, status text NOT NULL DEFAULT 'pending', amount_to_refund numeric NOT NULL DEFAULT 0, admin_comment text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, resolved_by uuid, screenshot_url text, screenshot_urls jsonb DEFAULT '[]'::jsonb);
CREATE TABLE public.balance_requests (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, team_id uuid NOT NULL REFERENCES public.teams(id), amount numeric NOT NULL, note text NOT NULL, status text NOT NULL DEFAULT 'pending', admin_comment text, processed_by uuid, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.balance_transactions (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id), amount numeric NOT NULL, balance_before numeric NOT NULL, balance_after numeric NOT NULL, note text NOT NULL, admin_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.credit_transactions (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, team_id uuid NOT NULL, generation_id uuid REFERENCES public.generation_history(id), type text NOT NULL, amount numeric NOT NULL, balance_before numeric NOT NULL, balance_after numeric NOT NULL, credit_limit numeric NOT NULL, is_on_credit boolean NOT NULL DEFAULT false, note text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.notifications (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, read boolean NOT NULL DEFAULT false, data jsonb, created_at timestamptz NOT NULL DEFAULT now(), type text NOT NULL, title text NOT NULL, message text NOT NULL);
CREATE TABLE public.admin_tasks (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, title text NOT NULL, description text, status public.admin_task_status NOT NULL DEFAULT 'todo', team_id uuid REFERENCES public.teams(id), assigned_to uuid NOT NULL, created_by uuid NOT NULL, deadline timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, priority public.task_priority NOT NULL DEFAULT 'medium');
CREATE TABLE public.task_comments (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, task_id uuid NOT NULL REFERENCES public.admin_tasks(id), user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), message text NOT NULL);
CREATE TABLE public.task_status_history (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, task_id uuid NOT NULL REFERENCES public.admin_tasks(id), old_status public.admin_task_status, new_status public.admin_task_status NOT NULL, changed_by uuid NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.feedback (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), is_read boolean NOT NULL DEFAULT false);
CREATE TABLE public.support_conversations (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'open');
CREATE TABLE public.support_messages (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES public.support_conversations(id), sender_id uuid NOT NULL, is_admin boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), message text NOT NULL);
CREATE TABLE public.invite_codes (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, code text NOT NULL UNIQUE, created_by uuid NOT NULL, used_by uuid, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), is_active boolean NOT NULL DEFAULT true, team_id uuid REFERENCES public.teams(id), assigned_role public.team_role);
CREATE TABLE public.generation_spends (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, generation_id uuid NOT NULL UNIQUE REFERENCES public.generation_history(id), user_id uuid NOT NULL, spend_amount numeric NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD', notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_favorite boolean NOT NULL DEFAULT false);
CREATE TABLE public.spend_sets (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, generation_ids jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL);
CREATE TABLE public.cleanup_logs (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), zips_cleared integer NOT NULL DEFAULT 0, files_cleared integer NOT NULL DEFAULT 0, processed integer NOT NULL DEFAULT 0, retried integer NOT NULL DEFAULT 0, success boolean NOT NULL DEFAULT true, error_message text, triggered_by text DEFAULT 'cron');
CREATE TABLE public.system_limits (id text NOT NULL DEFAULT 'global' PRIMARY KEY, active_generations integer NOT NULL DEFAULT 0, max_concurrent_generations integer NOT NULL DEFAULT 50, max_generations_per_user integer NOT NULL DEFAULT 3, updated_at timestamptz NOT NULL DEFAULT now(), last_cleanup_at timestamptz, last_tasks_check_at timestamptz);
CREATE TABLE public.maintenance_mode (id text NOT NULL DEFAULT 'global' PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, message text DEFAULT 'Ведуться технічні роботи', support_link text DEFAULT 'https://t.me/dragonwhite7', updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, generation_disabled boolean NOT NULL DEFAULT false, generation_message text DEFAULT 'Ведеться технічне обслуговування. Генерація тимчасово недоступна.');
CREATE TABLE public.payment_addresses (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, network text NOT NULL UNIQUE, address text NOT NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.payment_address_history (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, changed_by uuid NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), network text NOT NULL, old_address text, new_address text NOT NULL);
CREATE TABLE public.quotes (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, text text NOT NULL, author text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL);
CREATE TABLE public.pricing_config (id text NOT NULL DEFAULT 'global' PRIMARY KEY, tiers jsonb NOT NULL DEFAULT '[]'::jsonb, volume_discounts jsonb NOT NULL DEFAULT '[]'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, footer_note text DEFAULT '* Ціна на ручну видачу також може змінюватись залежно від складності ТЗ. Обговорюється індивідуально.');
CREATE TABLE public.referral_invites (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, referrer_user_id uuid NOT NULL, referrer_team_id uuid REFERENCES public.teams(id), invited_user_id uuid, invited_team_id uuid REFERENCES public.teams(id), code text NOT NULL UNIQUE, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), is_active boolean NOT NULL DEFAULT true, milestone_reached boolean NOT NULL DEFAULT false);
CREATE TABLE public.referral_rewards (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, referral_invite_id uuid NOT NULL REFERENCES public.referral_invites(id), user_id uuid NOT NULL, team_id uuid REFERENCES public.teams(id), amount numeric NOT NULL, reward_type text NOT NULL, status text NOT NULL DEFAULT 'pending', admin_comment text, processed_by uuid, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.referral_settings (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, invite_reward numeric NOT NULL DEFAULT 70, milestone_reward numeric NOT NULL DEFAULT 70, milestone_generations integer NOT NULL DEFAULT 50, new_user_bonus numeric NOT NULL DEFAULT 100, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, default_max_referral_invites integer NOT NULL DEFAULT 4);

-- ===================== INDEXES =====================
CREATE INDEX idx_admin_tasks_assigned_status ON public.admin_tasks (assigned_to, status);
CREATE INDEX idx_admin_tasks_status_problematic ON public.admin_tasks (status) WHERE (status = 'problematic'::admin_task_status);
CREATE INDEX idx_ai_generation_jobs_created_at ON public.ai_generation_jobs (created_at DESC);
CREATE INDEX idx_ai_generation_jobs_user_status ON public.ai_generation_jobs (user_id, status);
CREATE INDEX idx_appeals_status ON public.appeals (status);
CREATE INDEX idx_appeals_team_id ON public.appeals (team_id);
CREATE INDEX idx_appeals_user_id ON public.appeals (user_id);
CREATE INDEX idx_balance_requests_status ON public.balance_requests (status) WHERE (status = 'pending'::text);
CREATE INDEX idx_balance_transactions_created_at ON public.balance_transactions (created_at DESC);
CREATE INDEX idx_balance_transactions_team_id ON public.balance_transactions (team_id);
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions (team_id, created_at DESC);
CREATE INDEX idx_credit_transactions_team_id ON public.credit_transactions (team_id);
CREATE INDEX idx_generation_history_assigned_admin ON public.generation_history (assigned_admin_id) WHERE (assigned_admin_id IS NOT NULL);
CREATE INDEX idx_generation_history_status ON public.generation_history (status);
CREATE INDEX idx_generation_history_team_id ON public.generation_history (team_id);
CREATE INDEX idx_generation_history_user_created ON public.generation_history (user_id, created_at DESC);
CREATE INDEX idx_generation_history_user_status ON public.generation_history (user_id, status) WHERE (status = ANY (ARRAY['pending'::text, 'generating'::text]));
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read) WHERE (read = false);
CREATE INDEX idx_referral_invites_code ON public.referral_invites (code);
CREATE INDEX idx_referral_invites_referrer ON public.referral_invites (referrer_user_id);
CREATE INDEX idx_referral_rewards_status ON public.referral_rewards (status);
CREATE INDEX idx_team_admins_admin ON public.team_admins (admin_id);
CREATE INDEX idx_team_admins_team ON public.team_admins (team_id);
CREATE INDEX idx_teams_assigned_admin ON public.teams (assigned_admin_id) WHERE (assigned_admin_id IS NOT NULL);

-- ===================== FUNCTIONS =====================

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role) $$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND status = 'approved') $$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner' AND status = 'approved') $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN INSERT INTO public.profiles (user_id, display_name) VALUES (new.id, new.raw_user_meta_data ->> 'display_name'); RETURN new; END; $$;

CREATE OR REPLACE FUNCTION public.increment_active_generations() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE v_current INTEGER; v_max INTEGER; BEGIN SELECT active_generations, max_concurrent_generations INTO v_current, v_max FROM system_limits WHERE id = 'global' FOR UPDATE; IF v_current >= v_max THEN RETURN false; END IF; UPDATE system_limits SET active_generations = active_generations + 1, updated_at = now() WHERE id = 'global'; RETURN true; END; $$;

CREATE OR REPLACE FUNCTION public.decrement_active_generations() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN UPDATE system_limits SET active_generations = GREATEST(0, active_generations - 1), updated_at = now() WHERE id = 'global'; END; $$;

CREATE OR REPLACE FUNCTION public.get_user_active_generations(p_user_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT COUNT(*)::INTEGER FROM generation_history WHERE user_id = p_user_id AND status IN ('pending', 'generating'); $$;

CREATE OR REPLACE FUNCTION public.get_task_indicators(p_user_id uuid) RETURNS TABLE(has_new_tasks boolean, has_problematic boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM admin_tasks WHERE assigned_to = p_user_id AND status = 'todo') AS has_new_tasks, EXISTS (SELECT 1 FROM admin_tasks WHERE status = 'problematic' AND (assigned_to = p_user_id OR created_by = p_user_id)) AS has_problematic; $$;

CREATE OR REPLACE FUNCTION public.get_database_storage_stats() RETURNS TABLE(total_size text, tables_size text, generation_history_size text, zip_data_size text, table_count bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN RETURN QUERY SELECT pg_size_pretty(pg_database_size(current_database())) as total_size, (SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)::regclass))) FROM pg_tables WHERE schemaname = 'public') as tables_size, pg_size_pretty(pg_total_relation_size('generation_history')) as generation_history_size, COALESCE((SELECT pg_size_pretty(SUM(LENGTH(zip_data))) FROM generation_history WHERE zip_data IS NOT NULL), '0 bytes') as zip_data_size, (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as table_count; END; $$;

CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE v_invite RECORD; BEGIN SELECT id, team_id, assigned_role INTO v_invite FROM invite_codes WHERE code = UPPER(TRIM(p_code)) AND is_active = true AND used_by IS NULL; IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF; RETURN jsonb_build_object('valid', true, 'has_team', v_invite.team_id IS NOT NULL); END; $$;

CREATE OR REPLACE FUNCTION public.register_with_invite_code(p_invite_code text, p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE v_invite RECORD; BEGIN SELECT id, team_id, assigned_role, is_active, used_by INTO v_invite FROM invite_codes WHERE code = UPPER(p_invite_code) AND is_active = true AND used_by IS NULL; IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid or used invite code'); END IF; UPDATE invite_codes SET used_by = p_user_id, used_at = NOW() WHERE id = v_invite.id; IF v_invite.team_id IS NOT NULL AND v_invite.assigned_role IS NOT NULL THEN INSERT INTO team_members (team_id, user_id, role, status) VALUES (v_invite.team_id, p_user_id, v_invite.assigned_role, CASE WHEN v_invite.assigned_role = 'owner' THEN 'approved'::member_status ELSE 'pending'::member_status END); RETURN jsonb_build_object('success', true, 'team_id', v_invite.team_id, 'role', v_invite.assigned_role, 'status', CASE WHEN v_invite.assigned_role = 'owner' THEN 'approved' ELSE 'pending' END); END IF; RETURN jsonb_build_object('success', true, 'team_id', null, 'role', null); END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_generations() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE v_active_count integer; v_processed integer := 0; v_appeals_created integer := 0; v_counter_synced boolean := false; v_old_counter integer; v_new_counter integer; v_last_cleanup timestamptz; v_stale_row record; v_team_id uuid; v_existing_appeal_id uuid; v_refund numeric; v_timeout_ago timestamptz := now() - interval '25 minutes'; BEGIN SELECT count(*) INTO v_active_count FROM generation_history WHERE status IN ('pending', 'generating'); IF v_active_count = 0 THEN RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_active_generations'); END IF; SELECT last_cleanup_at INTO v_last_cleanup FROM system_limits WHERE id = 'global'; IF v_last_cleanup IS NOT NULL AND (now() - v_last_cleanup) < interval '10 minutes' THEN RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'too_recent'); END IF; UPDATE system_limits SET last_cleanup_at = now() WHERE id = 'global'; FOR v_stale_row IN SELECT id, user_id, team_id, sale_price, admin_note FROM generation_history WHERE status IN ('pending', 'generating') AND created_at < v_timeout_ago LOOP v_refund := COALESCE(v_stale_row.sale_price, 0); v_team_id := v_stale_row.team_id; IF v_team_id IS NULL AND v_stale_row.user_id IS NOT NULL THEN SELECT tm.team_id INTO v_team_id FROM team_members tm WHERE tm.user_id = v_stale_row.user_id AND tm.status = 'approved' LIMIT 1; END IF; IF v_stale_row.user_id IS NOT NULL THEN SELECT a.id INTO v_existing_appeal_id FROM appeals a WHERE a.generation_id = v_stale_row.id LIMIT 1; IF v_existing_appeal_id IS NULL THEN INSERT INTO appeals (generation_id, user_id, team_id, reason, status, amount_to_refund, admin_comment) VALUES (v_stale_row.id, v_stale_row.user_id, v_team_id, 'Автоповідомлення: генерація перевищила час очікування (>25 хв). Потребує розгляду адміністратором.', 'pending', v_refund, '⏱️ Auto-timeout 25min. Suggested refund: $' || v_refund::text); v_appeals_created := v_appeals_created + 1; END IF; END IF; UPDATE generation_history SET status = 'failed', error_message = 'Перевищено час очікування (25 хв). Апеляцію створено автоматично.' WHERE id = v_stale_row.id; v_processed := v_processed + 1; END LOOP; SELECT count(*) INTO v_new_counter FROM generation_history WHERE status IN ('pending', 'generating'); SELECT active_generations INTO v_old_counter FROM system_limits WHERE id = 'global'; IF v_old_counter IS DISTINCT FROM v_new_counter THEN UPDATE system_limits SET active_generations = v_new_counter, updated_at = now() WHERE id = 'global'; v_counter_synced := true; END IF; IF v_processed > 0 OR v_appeals_created > 0 THEN INSERT INTO cleanup_logs (zips_cleared, files_cleared, processed, retried, success, triggered_by) VALUES (0, 0, v_processed, 0, true, 'pg_cron'); END IF; RETURN jsonb_build_object('success', true, 'processed', v_processed, 'appealsCreated', v_appeals_created, 'counterSynced', v_counter_synced, 'counterBefore', v_old_counter, 'counterAfter', v_new_counter); END; $$;

CREATE OR REPLACE FUNCTION public.check_problematic_tasks() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE v_last_check timestamptz; v_active_count integer; v_updated integer := 0; v_notified integer := 0; v_task record; v_twelve_hours_ago timestamptz := now() - interval '12 hours'; BEGIN SELECT last_tasks_check_at INTO v_last_check FROM system_limits WHERE id = 'global'; IF v_last_check IS NOT NULL AND (now() - v_last_check) < interval '10 minutes' THEN RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'rate_limited'); END IF; UPDATE system_limits SET last_tasks_check_at = now() WHERE id = 'global'; SELECT count(*) INTO v_active_count FROM admin_tasks WHERE status IN ('todo', 'in_progress'); IF v_active_count = 0 THEN RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_active_tasks'); END IF; FOR v_task IN SELECT id, status, created_at, deadline, title, created_by FROM admin_tasks WHERE status IN ('todo', 'in_progress') AND ((status = 'todo' AND created_at < v_twelve_hours_ago) OR (status = 'in_progress' AND deadline < now())) LOOP UPDATE admin_tasks SET status = 'problematic' WHERE id = v_task.id; v_updated := v_updated + 1; INSERT INTO notifications (user_id, title, message, type) VALUES (v_task.created_by, 'Проблемне завдання', 'Завдання "' || v_task.title || '" стало проблемним через прострочення', 'task_problematic'); v_notified := v_notified + 1; END LOOP; RETURN jsonb_build_object('success', true, 'updated', v_updated, 'notified', v_notified); END; $$;

-- ===================== TRIGGERS =====================
CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_pricing_updated_at BEFORE UPDATE ON public.team_pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_conversations_updated_at BEFORE UPDATE ON public.support_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_generation_spends_updated_at BEFORE UPDATE ON public.generation_spends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spend_sets_updated_at BEFORE UPDATE ON public.spend_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================== ENABLE RLS =====================
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_spends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_address_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spend_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ===================== RLS POLICIES =====================

-- admin_tasks
CREATE POLICY "Admins can create tasks" ON public.admin_tasks FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete tasks" ON public.admin_tasks FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update tasks" ON public.admin_tasks FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all tasks" ON public.admin_tasks FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- ai_generation_jobs
CREATE POLICY "Service role can update jobs" ON public.ai_generation_jobs FOR UPDATE USING (true);
CREATE POLICY "Users can create their own jobs" ON public.ai_generation_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own jobs" ON public.ai_generation_jobs FOR SELECT USING (auth.uid() = user_id);

-- appeals
CREATE POLICY "Admins can update appeals" ON public.appeals FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all appeals" ON public.appeals FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create their own appeals" ON public.appeals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own appeals" ON public.appeals FOR SELECT USING (auth.uid() = user_id);

-- balance_requests
CREATE POLICY "Admins can update balance requests" ON public.balance_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all balance requests" ON public.balance_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can view their team balance requests" ON public.balance_requests FOR SELECT USING (is_team_owner(auth.uid(), team_id));
CREATE POLICY "Users can create their own balance requests" ON public.balance_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own balance requests" ON public.balance_requests FOR SELECT USING (auth.uid() = user_id);

-- balance_transactions
CREATE POLICY "Admins can create balance transactions" ON public.balance_transactions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all balance transactions" ON public.balance_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- cleanup_logs
CREATE POLICY "Service role can insert cleanup logs" ON public.cleanup_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Super admins can view cleanup logs" ON public.cleanup_logs FOR SELECT USING (is_super_admin(auth.uid()));

-- credit_transactions
CREATE POLICY "Admins can insert credit transactions" ON public.credit_transactions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all credit transactions" ON public.credit_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can insert credit transactions" ON public.credit_transactions FOR INSERT WITH CHECK (auth.role() = 'service_role'::text);
CREATE POLICY "Team owners can view their team credit transactions" ON public.credit_transactions FOR SELECT USING (is_team_owner(auth.uid(), team_id));

-- feedback
CREATE POLICY "Admins can delete feedback" ON public.feedback FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all feedback" ON public.feedback FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- generation_history
CREATE POLICY "Admins can update all generations" ON public.generation_history FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all generations" ON public.generation_history FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create their own generations" ON public.generation_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own generations" ON public.generation_history FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own generations" ON public.generation_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own generations" ON public.generation_history FOR SELECT USING (auth.uid() = user_id);

-- generation_spends
CREATE POLICY "Admins can view all spends" ON public.generation_spends FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can view team spends" ON public.generation_spends FOR SELECT USING (EXISTS (SELECT 1 FROM generation_history gh JOIN team_members tm ON gh.team_id = tm.team_id WHERE gh.id = generation_spends.generation_id AND tm.user_id = auth.uid() AND tm.role = 'owner'::team_role));
CREATE POLICY "Users can delete their own spends" ON public.generation_spends FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own spends" ON public.generation_spends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own spends" ON public.generation_spends FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own spends" ON public.generation_spends FOR SELECT USING (auth.uid() = user_id);

-- invite_codes
CREATE POLICY "Admins can create invite codes" ON public.invite_codes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update invite codes" ON public.invite_codes FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all invite codes" ON public.invite_codes FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can create team invite codes" ON public.invite_codes FOR INSERT WITH CHECK (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));
CREATE POLICY "Team owners can update their team invite codes" ON public.invite_codes FOR UPDATE USING (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));
CREATE POLICY "Team owners can view their team invite codes" ON public.invite_codes FOR SELECT USING (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));

-- maintenance_mode
CREATE POLICY "Anyone can view maintenance mode" ON public.maintenance_mode FOR SELECT USING (true);
CREATE POLICY "Super admins can update maintenance mode" ON public.maintenance_mode FOR UPDATE USING (is_super_admin(auth.uid()));

-- notifications
CREATE POLICY "Only service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'service_role'::text);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- payment_address_history
CREATE POLICY "Super admins can insert payment history" ON public.payment_address_history FOR INSERT WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view payment history" ON public.payment_address_history FOR SELECT USING (is_super_admin(auth.uid()));

-- payment_addresses
CREATE POLICY "Anyone can view active payment addresses" ON public.payment_addresses FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage payment addresses" ON public.payment_addresses FOR ALL USING (is_super_admin(auth.uid()));

-- pricing_config
CREATE POLICY "Admins can manage pricing config" ON public.pricing_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);

-- quotes
CREATE POLICY "Admins can manage quotes" ON public.quotes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active quotes" ON public.quotes FOR SELECT USING (is_active = true);

-- referral_invites
CREATE POLICY "Admins can update referral invites" ON public.referral_invites FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all referral invites" ON public.referral_invites FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create referral invites" ON public.referral_invites FOR INSERT WITH CHECK (auth.uid() = referrer_user_id);
CREATE POLICY "Users can view their own referral invites" ON public.referral_invites FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = invited_user_id);

-- referral_rewards
CREATE POLICY "Admins can update rewards" ON public.referral_rewards FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all rewards" ON public.referral_rewards FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can create rewards" ON public.referral_rewards FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own rewards" ON public.referral_rewards FOR SELECT USING (auth.uid() = user_id);

-- referral_settings
CREATE POLICY "Admins can update referral settings" ON public.referral_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view referral settings" ON public.referral_settings FOR SELECT USING (true);

-- spend_sets
CREATE POLICY "Users can create their own sets" ON public.spend_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sets" ON public.spend_sets FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own sets" ON public.spend_sets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own sets" ON public.spend_sets FOR SELECT USING (auth.uid() = user_id);

-- support_conversations
CREATE POLICY "Admins can update conversations" ON public.support_conversations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all conversations" ON public.support_conversations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create their own conversations" ON public.support_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own conversations" ON public.support_conversations FOR SELECT USING (auth.uid() = user_id);

-- support_messages
CREATE POLICY "Admins can send messages" ON public.support_messages FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_admin = true);
CREATE POLICY "Admins can view all messages" ON public.support_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can send messages in their conversations" ON public.support_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM support_conversations WHERE id = support_messages.conversation_id AND user_id = auth.uid()) AND is_admin = false);
CREATE POLICY "Users can view messages in their conversations" ON public.support_messages FOR SELECT USING (EXISTS (SELECT 1 FROM support_conversations WHERE id = support_messages.conversation_id AND user_id = auth.uid()));

-- system_limits
CREATE POLICY "Anyone can view system limits" ON public.system_limits FOR SELECT USING (true);
CREATE POLICY "Service role can update system limits" ON public.system_limits FOR UPDATE USING (auth.role() = 'service_role'::text);

-- task_comments
CREATE POLICY "Admins can create task comments" ON public.task_comments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete their own comments" ON public.task_comments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);
CREATE POLICY "Admins can view task comments" ON public.task_comments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- task_status_history
CREATE POLICY "Admins can create task history" ON public.task_status_history FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view task history" ON public.task_status_history FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- team_admins
CREATE POLICY "Admins can manage team_admins" ON public.team_admins FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- team_members
CREATE POLICY "Admins can manage all team members" ON public.team_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team owners can update members of their team" ON public.team_members FOR UPDATE USING (is_team_owner(auth.uid(), team_id));
CREATE POLICY "Team owners can view all members of their team" ON public.team_members FOR SELECT USING (is_team_owner(auth.uid(), team_id));
CREATE POLICY "Users can insert their own pending membership" ON public.team_members FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending'::member_status);
CREATE POLICY "Users can view their own membership" ON public.team_members FOR SELECT USING (auth.uid() = user_id);

-- team_pricing
CREATE POLICY "Admins can manage team pricing" ON public.team_pricing FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- teams
CREATE POLICY "Admins can manage all teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team members can view their teams" ON public.teams FOR SELECT USING (is_team_member(auth.uid(), id));

-- user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ===================== STORAGE BUCKETS =====================
INSERT INTO storage.buckets (id, name, public) VALUES ('appeal-screenshots', 'appeal-screenshots', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('manual-request-images', 'manual-request-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-sites', 'generated-sites', true);

CREATE POLICY "Public read appeal-screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'appeal-screenshots');
CREATE POLICY "Auth upload appeal-screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'appeal-screenshots' AND auth.role() = 'authenticated');
CREATE POLICY "Public read manual-request-images" ON storage.objects FOR SELECT USING (bucket_id = 'manual-request-images');
CREATE POLICY "Auth upload manual-request-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'manual-request-images' AND auth.role() = 'authenticated');
CREATE POLICY "Public read generated-sites" ON storage.objects FOR SELECT USING (bucket_id = 'generated-sites');
CREATE POLICY "Service upload generated-sites" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-sites');
CREATE POLICY "Service update generated-sites" ON storage.objects FOR UPDATE USING (bucket_id = 'generated-sites');

-- ===================== INITIAL DATA =====================
INSERT INTO public.system_limits (id, active_generations, max_concurrent_generations, max_generations_per_user) VALUES ('global', 0, 50, 3);
INSERT INTO public.maintenance_mode (id, enabled, generation_disabled) VALUES ('global', false, false);
INSERT INTO public.referral_settings (invite_reward, milestone_reward, milestone_generations, new_user_bonus, default_max_referral_invites) VALUES (70, 70, 50, 100, 4);

-- ===================== REALTIME =====================
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appeals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_generation_jobs;

-- ===================== PG_CRON JOBS =====================
-- SELECT cron.schedule('cleanup-stale-generations', '*/30 * * * *', $$SELECT public.cleanup_stale_generations()$$);
-- SELECT cron.schedule('check-problematic-tasks', '*/30 * * * *', $$SELECT public.check_problematic_tasks()$$);

-- ===================== SECRETS (via CLI) =====================
-- supabase secrets set OPENAI_API_KEY=... V0_API_KEY=... PEXELS_API_KEY=... LOVABLE_API_KEY=... SUPER_ADMIN_EMAIL=... N8N_CALLBACK_SECRET=...

-- ===================== EDGE FUNCTIONS (via CLI) =====================
-- supabase functions deploy generate-website generate-react-website generate-php-website edit-website improve-prompt generate-vip-prompt generate-theme-prompt codex-proxy v0-proxy n8n-async-proxy n8n-callback reset-user-password verify-super-admin check-super-admin create-notification analyze-screenshot get-storage-stats generate-ai-website codex-generation-worker get-user-emails --no-verify-jwt
