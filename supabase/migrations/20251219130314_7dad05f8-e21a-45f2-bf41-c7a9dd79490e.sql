-- Create payment_addresses table
CREATE TABLE public.payment_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL UNIQUE,
  address text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create payment_address_history table
CREATE TABLE public.payment_address_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  old_address text,
  new_address text NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_address_history ENABLE ROW LEVEL SECURITY;

-- Create function to check super_admin role
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

-- RLS policies for payment_addresses
CREATE POLICY "Anyone can view active payment addresses"
ON public.payment_addresses
FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins can manage payment addresses"
ON public.payment_addresses
FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS policies for payment_address_history
CREATE POLICY "Super admins can view payment history"
ON public.payment_address_history
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert payment history"
ON public.payment_address_history
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Insert default addresses
INSERT INTO public.payment_addresses (network, address) VALUES
  ('TRC20 (USDT)', 'TDdkv5moLsjkjtL5pUXsgDZ79HGYB8k2kS'),
  ('ERC20 (USDT)', '0x5fda65463736a538b29055eee3fdf3920f9ea3e2'),
  ('BTC', ''),
  ('ETH', '');