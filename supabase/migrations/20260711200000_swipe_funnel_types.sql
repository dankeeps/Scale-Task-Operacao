-- Catalog: funnel type (registered, reusable like the other swipe catalogs).
CREATE TABLE public.swipe_funnel_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.swipe_funnel_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view swipe_funnel_types"
  ON public.swipe_funnel_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert swipe_funnel_types"
  ON public.swipe_funnel_types FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can delete swipe_funnel_types"
  ON public.swipe_funnel_types FOR DELETE TO authenticated USING (created_by = auth.uid());

ALTER TABLE public.swipe_transcriptions
  ADD COLUMN IF NOT EXISTS funnel_type_id UUID REFERENCES public.swipe_funnel_types(id) ON DELETE SET NULL;
