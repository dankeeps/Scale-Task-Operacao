-- Novos campos do anúncio criativo + catálogo de Avatares (personas).
-- Avatar = lista gerenciável por projeto (espelha creative_edit_types/formatos).

-- 1) Catálogo de avatares (personas), escopo de projeto.
CREATE TABLE IF NOT EXISTS public.creative_avatars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creative_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view avatars" ON public.creative_avatars
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Master+ can insert avatars" ON public.creative_avatars
  FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete avatars" ON public.creative_avatars
  FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role));

-- 2) Campos novos no anúncio. (edit_type_id e texto continuam no banco, só saem da UI.)
ALTER TABLE public.creative_ads
  ADD COLUMN IF NOT EXISTS briefing        TEXT,
  ADD COLUMN IF NOT EXISTS avatar_id       UUID REFERENCES public.creative_avatars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referencia      TEXT,
  ADD COLUMN IF NOT EXISTS notas_editor    TEXT,
  ADD COLUMN IF NOT EXISTS notas_gravacao  TEXT,
  ADD COLUMN IF NOT EXISTS retencao_1min   NUMERIC,
  ADD COLUMN IF NOT EXISTS retencao_pitch  NUMERIC,
  ADD COLUMN IF NOT EXISTS conversao_vsl   NUMERIC;
