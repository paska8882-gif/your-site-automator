
-- Create credit_transactions table to track all credit-based operations
CREATE TABLE public.credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL,
  generation_id uuid NULL REFERENCES public.generation_history(id) ON DELETE SET NULL,
  type text NOT NULL, -- 'credit_used', 'credit_repaid', 'credit_limit_change'
  amount numeric NOT NULL, -- positive = debt added, negative = debt repaid
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  credit_limit numeric NOT NULL,
  is_on_credit boolean NOT NULL DEFAULT false, -- true if balance was negative when transaction occurred
  note text NULL,
  created_by uuid NULL, -- admin who created (for manual adjustments)
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups by team
CREATE INDEX idx_credit_transactions_team_id ON public.credit_transactions(team_id);
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(team_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all credit transactions
CREATE POLICY "Admins can view all credit transactions"
ON public.credit_transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert credit transactions"
ON public.credit_transactions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert (for edge functions using service role key)
CREATE POLICY "Service role can insert credit transactions"
ON public.credit_transactions
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Team owners can view their team's credit transactions
CREATE POLICY "Team owners can view their team credit transactions"
ON public.credit_transactions
FOR SELECT
USING (is_team_owner(auth.uid(), team_id));
