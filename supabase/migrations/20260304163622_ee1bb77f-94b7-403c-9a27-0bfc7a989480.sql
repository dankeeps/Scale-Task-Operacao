
CREATE POLICY "Owners can update projects"
ON public.projects FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
