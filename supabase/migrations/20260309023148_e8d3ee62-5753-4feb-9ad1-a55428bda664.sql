
-- Drop restrictive delete policy
DROP POLICY IF EXISTS "Creator can delete swipes" ON public.swipes;

-- Create new policy: any authenticated user can delete any swipe
CREATE POLICY "Authenticated can delete swipes"
  ON public.swipes
  FOR DELETE
  TO authenticated
  USING (true);
