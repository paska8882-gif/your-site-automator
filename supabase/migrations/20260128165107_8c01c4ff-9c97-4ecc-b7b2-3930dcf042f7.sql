-- Create maintenance_mode table
CREATE TABLE public.maintenance_mode (
  id text PRIMARY KEY DEFAULT 'global',
  enabled boolean NOT NULL DEFAULT false,
  message text DEFAULT 'Ведуться технічні роботи',
  support_link text DEFAULT 'https://t.me/dragonwhite7',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default row
INSERT INTO public.maintenance_mode (id, enabled, message, support_link)
VALUES ('global', false, 'Ведуться технічні роботи. Можете написати в підтримку.', 'https://t.me/dragonwhite7');

-- Enable RLS
ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;

-- Anyone can view (needed to check if maintenance mode is on)
CREATE POLICY "Anyone can view maintenance mode"
ON public.maintenance_mode FOR SELECT
USING (true);

-- Only super admins can update
CREATE POLICY "Super admins can update maintenance mode"
ON public.maintenance_mode FOR UPDATE
USING (is_super_admin(auth.uid()));