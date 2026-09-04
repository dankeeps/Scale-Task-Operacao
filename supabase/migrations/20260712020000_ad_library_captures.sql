-- Ads captured from the Meta Ad Library via the ScaleTask Chrome extension.
CREATE TABLE public.ad_library_captures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  offer_name TEXT NOT NULL DEFAULT '',
  expert_name TEXT NOT NULL DEFAULT '',
  library_url TEXT NOT NULL DEFAULT '',
  ad_started_on DATE,          -- "Veiculação iniciada em"
  days_running INTEGER,        -- start date -> capture day
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_library_captures_project ON public.ad_library_captures(project_id);

ALTER TABLE public.ad_library_captures ENABLE ROW LEVEL SECURITY;

-- Members of the project can view and add captures; only the author can delete.
CREATE POLICY "Members can view captures" ON public.ad_library_captures
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can insert captures" ON public.ad_library_captures
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Author can delete captures" ON public.ad_library_captures
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
