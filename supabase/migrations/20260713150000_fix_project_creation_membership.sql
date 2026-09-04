-- Fix: creating a new project broke after removing the permissive self-insert
-- policy on user_projects (security hardening). The client bootstraps a project
-- by inserting its own owner membership right after creating the project, but
-- "Owners can add members" can't apply yet (no membership exists).
--
-- Allow a user to insert ONLY their own membership, and ONLY for a project they
-- themselves created. This restores project creation without reopening the hole
-- (you still cannot join an arbitrary/other user's workspace).
CREATE POLICY "Creator can add self as owner"
  ON public.user_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  );
