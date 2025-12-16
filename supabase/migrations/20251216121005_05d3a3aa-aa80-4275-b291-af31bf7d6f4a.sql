-- Create invite_codes table
CREATE TABLE public.invite_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Admins can view all invite codes
CREATE POLICY "Admins can view all invite codes"
ON public.invite_codes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create invite codes
CREATE POLICY "Admins can create invite codes"
ON public.invite_codes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update invite codes
CREATE POLICY "Admins can update invite codes"
ON public.invite_codes
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can check if code exists (for registration validation)
CREATE POLICY "Anyone can validate invite codes"
ON public.invite_codes
FOR SELECT
USING (is_active = true AND used_by IS NULL);