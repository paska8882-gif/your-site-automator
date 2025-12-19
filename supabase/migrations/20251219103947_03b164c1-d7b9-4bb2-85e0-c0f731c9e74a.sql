-- Add policy for team owners to view their team's balance requests
CREATE POLICY "Team owners can view their team balance requests"
ON public.balance_requests
FOR SELECT
USING (is_team_owner(auth.uid(), team_id));