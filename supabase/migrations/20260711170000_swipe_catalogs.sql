-- Reusable catalogs for the "Criar Swipe por Transcrição" form.
-- Each is a simple lookup the user builds up over time (select existing + add new).

CREATE TABLE public.swipe_experts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.swipe_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.swipe_niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.swipe_languages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: any authenticated user reads all entries; can add their own; can remove their own.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['swipe_experts','swipe_offers','swipe_niches','swipe_languages']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "Authenticated can view %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Authenticated can insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());', t);
    EXECUTE format('CREATE POLICY "Creator can delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (created_by = auth.uid());', t);
  END LOOP;
END $$;

-- Link the transcription to the catalogs + Ad Library link.
ALTER TABLE public.swipe_transcriptions
  ADD COLUMN IF NOT EXISTS expert_id UUID REFERENCES public.swipe_experts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.swipe_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS niche_id UUID REFERENCES public.swipe_niches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS language_id UUID REFERENCES public.swipe_languages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ad_library_link TEXT NOT NULL DEFAULT '';
