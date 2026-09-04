
-- Replace permissive insert policy with a restrictive one
-- Only the trigger (SECURITY DEFINER) actually inserts, but we need a policy for RLS
DROP POLICY "System can insert notifications" ON public.notifications;

-- Users can only insert notifications for themselves (covers edge cases)
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
