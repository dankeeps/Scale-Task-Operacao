
-- Use text casting to avoid enum commit issue
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid, _min_role project_role DEFAULT 'especialista'::project_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects WHERE user_id = _user_id AND project_id = _project_id
      AND CASE _min_role::text
        WHEN 'editor' THEN role::text IN ('editor','especialista','gestor','copywriter_jr','master','owner')
        WHEN 'especialista' THEN role::text IN ('especialista','gestor','copywriter_jr','master','owner')
        WHEN 'gestor' THEN role::text IN ('gestor','copywriter_jr','master','owner')
        WHEN 'copywriter_jr' THEN role::text IN ('copywriter_jr','master','owner')
        WHEN 'master' THEN role::text IN ('master','owner')
        WHEN 'owner' THEN role::text = 'owner'
      END
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_metrics(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects 
    WHERE user_id = _user_id AND project_id = _project_id
      AND role::text IN ('owner','master','gestor')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_metrics(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects 
    WHERE user_id = _user_id AND project_id = _project_id
      AND role::text IN ('owner','master','gestor','especialista')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_project_role(_user_id uuid, _project_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role::text FROM public.user_projects WHERE user_id = _user_id AND project_id = _project_id LIMIT 1
$$;

-- Update metrics RLS
DROP POLICY IF EXISTS "Master+ can view metrics" ON public.metrics;
CREATE POLICY "Can view metrics" ON public.metrics FOR SELECT
  USING (can_view_metrics(auth.uid(), project_id));

DROP POLICY IF EXISTS "Master+ can insert metrics" ON public.metrics;
CREATE POLICY "Can insert metrics" ON public.metrics FOR INSERT
  WITH CHECK (can_manage_metrics(auth.uid(), project_id));

DROP POLICY IF EXISTS "Master+ can update metrics" ON public.metrics;
CREATE POLICY "Can update metrics" ON public.metrics FOR UPDATE
  USING (can_manage_metrics(auth.uid(), project_id))
  WITH CHECK (can_manage_metrics(auth.uid(), project_id));

DROP POLICY IF EXISTS "Master+ can delete metrics" ON public.metrics;
CREATE POLICY "Can delete metrics" ON public.metrics FOR DELETE
  USING (can_manage_metrics(auth.uid(), project_id));

-- Update metrics_extras RLS
DROP POLICY IF EXISTS "Master+ can view metrics_extras" ON public.metrics_extras;
CREATE POLICY "Can view metrics_extras" ON public.metrics_extras FOR SELECT
  USING (EXISTS (SELECT 1 FROM metrics m WHERE m.id = metrics_extras.metric_id AND can_view_metrics(auth.uid(), m.project_id)));

DROP POLICY IF EXISTS "Master+ can insert metrics_extras" ON public.metrics_extras;
CREATE POLICY "Can insert metrics_extras" ON public.metrics_extras FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM metrics m WHERE m.id = metrics_extras.metric_id AND can_manage_metrics(auth.uid(), m.project_id)));

DROP POLICY IF EXISTS "Master+ can update metrics_extras" ON public.metrics_extras;
CREATE POLICY "Can update metrics_extras" ON public.metrics_extras FOR UPDATE
  USING (EXISTS (SELECT 1 FROM metrics m WHERE m.id = metrics_extras.metric_id AND can_manage_metrics(auth.uid(), m.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM metrics m WHERE m.id = metrics_extras.metric_id AND can_manage_metrics(auth.uid(), m.project_id)));

DROP POLICY IF EXISTS "Master+ can delete metrics_extras" ON public.metrics_extras;
CREATE POLICY "Can delete metrics_extras" ON public.metrics_extras FOR DELETE
  USING (EXISTS (SELECT 1 FROM metrics m WHERE m.id = metrics_extras.metric_id AND can_manage_metrics(auth.uid(), m.project_id)));

-- Copywriter_jr can no longer delete
DROP POLICY IF EXISTS "Delete tasks" ON public.tasks;
CREATE POLICY "Delete tasks" ON public.tasks FOR DELETE
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

DROP POLICY IF EXISTS "Delete creative_ads" ON public.creative_ads;
CREATE POLICY "Delete creative_ads" ON public.creative_ads FOR DELETE
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

DROP POLICY IF EXISTS "Delete creative_documents" ON public.creative_documents;
CREATE POLICY "Delete creative_documents" ON public.creative_documents FOR DELETE
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

DROP POLICY IF EXISTS "Delete folders" ON public.folders;
CREATE POLICY "Delete folders" ON public.folders FOR DELETE
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));
