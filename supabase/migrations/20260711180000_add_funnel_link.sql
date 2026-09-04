-- Funnel link for a transcription swipe.
ALTER TABLE public.swipe_transcriptions
  ADD COLUMN IF NOT EXISTS funnel_link TEXT NOT NULL DEFAULT '';
