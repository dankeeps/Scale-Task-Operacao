-- ── 1) Fix: biblioteca do Swipe é GLOBAL — o time pode excluir/editar, não só
--        o criador. (Antes: delete/update só com created_by = auth.uid(), o que
--        fazia a exclusão de swipes de outros falhar em silêncio e "voltar".) ──
DROP POLICY IF EXISTS "Creator can delete transcriptions" ON public.swipe_transcriptions;
DROP POLICY IF EXISTS "Creator can update transcriptions" ON public.swipe_transcriptions;
CREATE POLICY "Authenticated can delete transcriptions" ON public.swipe_transcriptions
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can update transcriptions" ON public.swipe_transcriptions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 2) Catálogo de tipos de elemento (o usuário cadastra) ───────────────
CREATE TABLE IF NOT EXISTS public.swipe_element_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.swipe_element_types ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated can view swipe_element_types" ON public.swipe_element_types
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can insert swipe_element_types" ON public.swipe_element_types
    FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can delete swipe_element_types" ON public.swipe_element_types
    FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3) Elementos persuasivos (tabela / base de argumentos) ──────────────
CREATE TABLE IF NOT EXISTS public.swipe_arguments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id uuid REFERENCES public.swipe_niches(id) ON DELETE SET NULL,
  element_id uuid REFERENCES public.swipe_element_types(id) ON DELETE SET NULL,
  argument_type text NOT NULL DEFAULT 'potencial' CHECK (argument_type IN ('validado', 'potencial')),
  argument text NOT NULL DEFAULT '',
  origin_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS swipe_arguments_niche_idx ON public.swipe_arguments (niche_id);
CREATE INDEX IF NOT EXISTS swipe_arguments_element_idx ON public.swipe_arguments (element_id);
CREATE INDEX IF NOT EXISTS swipe_arguments_created_idx ON public.swipe_arguments (created_at DESC);

ALTER TABLE public.swipe_arguments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated can view swipe_arguments" ON public.swipe_arguments
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can insert swipe_arguments" ON public.swipe_arguments
    FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can update swipe_arguments" ON public.swipe_arguments
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can delete swipe_arguments" ON public.swipe_arguments
    FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
