-- Ad metadata for transcriptions captured from the Meta Ad Library via the extension.
ALTER TABLE public.swipe_transcriptions
  ADD COLUMN IF NOT EXISTS ad_started_on DATE,
  ADD COLUMN IF NOT EXISTS days_running INTEGER;
