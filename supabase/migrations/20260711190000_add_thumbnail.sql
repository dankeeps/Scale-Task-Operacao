-- Poster/thumbnail captured from the uploaded video, shown on the swipe card.
ALTER TABLE public.swipe_transcriptions
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NOT NULL DEFAULT '';
