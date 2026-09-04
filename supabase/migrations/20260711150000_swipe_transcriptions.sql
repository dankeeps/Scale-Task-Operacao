-- Swipe by transcription: stores an uploaded video and its time-synced transcript.
-- Segments are subtitle-style chunks produced from ElevenLabs word timestamps:
--   [{ "text": string, "start": number, "end": number }, ...]

CREATE TABLE public.swipe_transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  duration DOUBLE PRECISION,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.swipe_transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view transcriptions"
  ON public.swipe_transcriptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert transcriptions"
  ON public.swipe_transcriptions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update transcriptions"
  ON public.swipe_transcriptions FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can delete transcriptions"
  ON public.swipe_transcriptions FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Public bucket for the uploaded videos (needed so the edge function and the
-- player can read them by public URL).
INSERT INTO storage.buckets (id, name, public) VALUES ('swipe-videos', 'swipe-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload swipe videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'swipe-videos');

CREATE POLICY "Public can view swipe videos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'swipe-videos');

CREATE POLICY "Authenticated can delete swipe videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'swipe-videos');
