
-- Allow selecting projects the user just created (before user_projects row exists)
DROP POLICY "Users can view their projects" ON public.projects;
CREATE POLICY "Users can view their projects"
ON public.projects FOR SELECT TO authenticated
USING (
  created_by = auth.uid() OR public.is_project_member(auth.uid(), id)
);
