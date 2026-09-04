
-- Metrics table
CREATE TABLE public.metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  investimento NUMERIC DEFAULT 0,
  faturamento NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  conversao_pv NUMERIC DEFAULT 0,
  conv_checkout NUMERIC DEFAULT 0,
  body_conv NUMERIC DEFAULT 0,
  connect_rate NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  custo_por_ic NUMERIC DEFAULT 0,
  hook_rate NUMERIC DEFAULT 0,
  hold_rate NUMERIC DEFAULT 0,
  play_rate NUMERIC DEFAULT 0,
  retencao_primeiro_minuto NUMERIC DEFAULT 0,
  retencao_pitch NUMERIC DEFAULT 0,
  conversao_vturb NUMERIC DEFAULT 0
);

-- Upsells/Downsells dynamic entries
CREATE TABLE public.metrics_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_id UUID NOT NULL REFERENCES public.metrics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('upsell', 'downsell')),
  order_number INT NOT NULL DEFAULT 1,
  value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_extras ENABLE ROW LEVEL SECURITY;

-- RLS for metrics: only master+ can view metrics
CREATE POLICY "Master+ can view metrics"
ON public.metrics FOR SELECT TO authenticated
USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can insert metrics"
ON public.metrics FOR INSERT TO authenticated
WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can update metrics"
ON public.metrics FOR UPDATE TO authenticated
USING (has_project_access(auth.uid(), project_id, 'master'::project_role))
WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete metrics"
ON public.metrics FOR DELETE TO authenticated
USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

-- RLS for metrics_extras: inherit from metrics via subquery
CREATE POLICY "Master+ can view metrics_extras"
ON public.metrics_extras FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.metrics m WHERE m.id = metric_id AND has_project_access(auth.uid(), m.project_id, 'master'::project_role)));

CREATE POLICY "Master+ can insert metrics_extras"
ON public.metrics_extras FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.metrics m WHERE m.id = metric_id AND has_project_access(auth.uid(), m.project_id, 'master'::project_role)));

CREATE POLICY "Master+ can update metrics_extras"
ON public.metrics_extras FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.metrics m WHERE m.id = metric_id AND has_project_access(auth.uid(), m.project_id, 'master'::project_role)))
WITH CHECK (EXISTS (SELECT 1 FROM public.metrics m WHERE m.id = metric_id AND has_project_access(auth.uid(), m.project_id, 'master'::project_role)));

CREATE POLICY "Master+ can delete metrics_extras"
ON public.metrics_extras FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.metrics m WHERE m.id = metric_id AND has_project_access(auth.uid(), m.project_id, 'master'::project_role)));
