
-- Add audio_url column to task_comments
ALTER TABLE public.task_comments ADD COLUMN audio_url text DEFAULT NULL;

-- Create storage bucket for task audio comments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-audio', 'task-audio', true);

-- Allow authenticated users to upload to task-audio bucket
CREATE POLICY "Authenticated can upload task audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-audio');

-- Allow anyone to read task audio
CREATE POLICY "Public can read task audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-audio');

-- Allow users to delete their own audio
CREATE POLICY "Users can delete own task audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
