-- Catálogo "Método de Copy" para o anúncio criativo (lista gerenciável por
-- projeto, espelha creative_avatars/creative_edit_types) + link no anúncio.

CREATE TABLE IF NOT EXISTS public.creative_copy_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creative_copy_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view copy methods" ON public.creative_copy_methods
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Master+ can insert copy methods" ON public.creative_copy_methods
  FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete copy methods" ON public.creative_copy_methods
  FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role));

ALTER TABLE public.creative_ads
  ADD COLUMN IF NOT EXISTS copy_method_id UUID REFERENCES public.creative_copy_methods(id) ON DELETE SET NULL;
