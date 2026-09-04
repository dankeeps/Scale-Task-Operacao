
-- Allow project owners to insert members for their projects
CREATE POLICY "Owners can add members"
ON public.user_projects FOR INSERT
TO authenticated
WITH CHECK (
  public.has_project_access(auth.uid(), project_id, 'owner'::project_role)
);

-- Allow viewing all members of projects you belong to
CREATE POLICY "Members can view project members"
ON public.user_projects FOR SELECT
TO authenticated
USING (
  public.is_project_member(auth.uid(), project_id)
);

-- Allow owners to delete members from their projects
CREATE POLICY "Owners can remove members"
ON public.user_projects FOR DELETE
TO authenticated
USING (
  public.has_project_access(auth.uid(), project_id, 'owner'::project_role)
);
