-- Allow admins to update all generations (for manual request completion)
CREATE POLICY "Admins can update all generations"
ON generation_history
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));