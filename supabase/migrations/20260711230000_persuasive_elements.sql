-- Persuasive elements ("Elementos Persuasivos") for the Swipe feature.
-- A reusable catalog of persuasion tags (each with an auto-assigned color) that the
-- user applies to excerpts of a transcribed swipe. Each applied excerpt is a "highlight".

CREATE TABLE public.swipe_persuasive_elements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#fcd34d',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.swipe_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transcription_id UUID NOT NULL REFERENCES public.swipe_transcriptions(id) ON DELETE CASCADE,
  element_id UUID NOT NULL REFERENCES public.swipe_persuasive_elements(id) ON DELETE CASCADE,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_swipe_highlights_transcription ON public.swipe_highlights(transcription_id);
CREATE INDEX idx_swipe_highlights_element ON public.swipe_highlights(element_id);

-- RLS: any authenticated user reads all; can insert their own.
-- Deletion is open to any authenticated user so the shared "planilha" stays maintainable by the team.
ALTER TABLE public.swipe_persuasive_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view persuasive elements" ON public.swipe_persuasive_elements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert persuasive elements" ON public.swipe_persuasive_elements FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Authenticated can delete persuasive elements" ON public.swipe_persuasive_elements FOR DELETE TO authenticated USING (true);

ALTER TABLE public.swipe_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view highlights" ON public.swipe_highlights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert highlights" ON public.swipe_highlights FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Authenticated can delete highlights" ON public.swipe_highlights FOR DELETE TO authenticated USING (true);
