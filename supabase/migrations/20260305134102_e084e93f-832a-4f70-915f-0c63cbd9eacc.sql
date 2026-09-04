
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  color TEXT NOT NULL DEFAULT '#f97316'
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view folders" ON public.folders
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Copywriter+ can insert folders" ON public.folders
  FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role));

CREATE POLICY "Update folders" ON public.folders
  FOR UPDATE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role) OR (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()))
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role) OR (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()));

CREATE POLICY "Delete folders" ON public.folders
  FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role) OR (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()));
