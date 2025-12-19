-- Create balance_transactions table for tracking deposits
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

-- Enable RLS
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can view all transactions
CREATE POLICY "Admins can view all balance transactions" 
ON public.balance_transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create transactions
CREATE POLICY "Admins can create balance transactions" 
ON public.balance_transactions 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_balance_transactions_team_id ON public.balance_transactions(team_id);
CREATE INDEX idx_balance_transactions_created_at ON public.balance_transactions(created_at DESC);