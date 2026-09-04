
-- Add directors_only column to tasks table
ALTER TABLE public.tasks ADD COLUMN directors_only boolean NOT NULL DEFAULT false;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;

-- Create new SELECT policy that hides directors_only tasks from non-owner/master
CREATE POLICY "Members can view tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    is_project_member(auth.uid(), project_id)
    AND (
      directors_only = false
      OR has_project_access(auth.uid(), project_id, 'master'::project_role)
    )
  );
