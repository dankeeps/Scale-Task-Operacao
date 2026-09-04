
-- Add image_url column to projects
ALTER TABLE public.projects ADD COLUMN image_url text DEFAULT null;

-- Create storage bucket for project images
INSERT INTO storage.buckets (id, name, public) VALUES ('project-images', 'project-images', true);

-- Allow authenticated users to upload project images
CREATE POLICY "Authenticated can upload project images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-images');

-- Allow public read
CREATE POLICY "Public can view project images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-images');

-- Allow owners to delete their project images
CREATE POLICY "Authenticated can delete project images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-images');
