-- "Tipo de edição" catalog for creative ads (project-scoped, mirrors formatos).
CREATE TABLE public.creative_edit_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creative_edit_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view edit types" ON public.creative_edit_types
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Master+ can insert edit types" ON public.creative_edit_types
  FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete edit types" ON public.creative_edit_types
  FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role));

-- Link the ad to its edit type.
ALTER TABLE public.creative_ads
  ADD COLUMN IF NOT EXISTS edit_type_id UUID REFERENCES public.creative_edit_types(id) ON DELETE SET NULL;
