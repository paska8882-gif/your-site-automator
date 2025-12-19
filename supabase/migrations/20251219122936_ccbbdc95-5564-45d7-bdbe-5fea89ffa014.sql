-- Функція для реєстрації користувача з інвайт-кодом
-- Виконується з правами definer, обходячи RLS
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
  -- Знаходимо інвайт-код
  SELECT id, team_id, assigned_role, is_active, used_by
  INTO v_invite
  FROM invite_codes
  WHERE code = UPPER(p_invite_code)
    AND is_active = true
    AND used_by IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or used invite code');
  END IF;
  
  -- Позначаємо код як використаний
  UPDATE invite_codes
  SET used_by = p_user_id,
      used_at = NOW()
  WHERE id = v_invite.id;
  
  -- Якщо код прив'язаний до команди, додаємо користувача
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

-- Дозволяємо authenticated користувачам викликати функцію
GRANT EXECUTE ON FUNCTION public.register_with_invite_code(TEXT, UUID) TO authenticated;