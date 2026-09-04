-- Ajustes do espião: campo "formato" (catálogo), o spy também vira um swipe,
-- e link entre o spy e a transcrição criada no Swipe.

-- ── 1) Catálogo de formatos (global, padrão dos catálogos do Swipe) ──────
CREATE TABLE IF NOT EXISTS public.swipe_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.swipe_formats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated can view swipe_formats" ON public.swipe_formats
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can insert swipe_formats" ON public.swipe_formats
    FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Creator can delete swipe_formats" ON public.swipe_formats
    FOR DELETE TO authenticated USING (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2) spy_captures: formato + link com a transcrição do Swipe ──────────
ALTER TABLE public.spy_captures
  ADD COLUMN IF NOT EXISTS format_id uuid REFERENCES public.swipe_formats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS format_text text,
  ADD COLUMN IF NOT EXISTS transcription_id uuid REFERENCES public.swipe_transcriptions(id) ON DELETE SET NULL;

-- ── 3) swipe_transcriptions: carrega o formato (opcional) ───────────────
ALTER TABLE public.swipe_transcriptions
  ADD COLUMN IF NOT EXISTS format_id uuid REFERENCES public.swipe_formats(id) ON DELETE SET NULL;
