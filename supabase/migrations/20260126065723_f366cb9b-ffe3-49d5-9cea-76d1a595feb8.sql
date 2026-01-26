-- =====================================================
-- SECURITY FIX #1: Notifications Auth Bypass
-- Replace permissive INSERT policy with service_role only
-- =====================================================

-- Drop the permissive policy that allows any authenticated user to create notifications
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;

-- Create restrictive policy - only service_role can insert (via edge functions)
CREATE POLICY "Only service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- SECURITY FIX #2: Invite Code Enumeration
-- Remove public SELECT and create secure validation RPC
-- =====================================================

-- Drop the public enumeration policy
DROP POLICY IF EXISTS "Anyone can validate invite codes" ON public.invite_codes;

-- Create a secure RPC function for invite code validation
-- This uses SECURITY DEFINER to access invite_codes without exposing all codes
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Validate code without exposing details
  SELECT id, team_id, assigned_role
  INTO v_invite
  FROM invite_codes
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND used_by IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  
  -- Return minimal info (don't expose team details or role to prevent targeting)
  RETURN jsonb_build_object(
    'valid', true,
    'has_team', v_invite.team_id IS NOT NULL
  );
END;
$$;

-- Grant execute to anon and authenticated users for registration flow
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO anon, authenticated;