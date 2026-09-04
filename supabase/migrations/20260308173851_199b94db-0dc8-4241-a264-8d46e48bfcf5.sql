
CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view offers"
  ON public.offers FOR SELECT
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Copywriter+ can insert offers"
  ON public.offers FOR INSERT
  WITH CHECK (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role));

CREATE POLICY "Master+ can delete offers"
  ON public.offers FOR DELETE
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));
