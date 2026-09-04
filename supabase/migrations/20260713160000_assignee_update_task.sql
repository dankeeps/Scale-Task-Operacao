-- Let the person a task is assigned to update it (e.g. change status / mark done),
-- regardless of who created it. This fixes editors (and any member) not being able
-- to advance their own assigned tasks. WITH CHECK keeps assigned_to as themselves,
-- so they can't reassign the task to someone else.
CREATE POLICY "Assignee can update their task"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());
