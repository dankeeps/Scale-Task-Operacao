
-- Create storage bucket for swipe images
INSERT INTO storage.buckets (id, name, public) VALUES ('swipe-images', 'swipe-images', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated can upload swipe images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'swipe-images');

-- Allow public read
CREATE POLICY "Public can view swipe images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'swipe-images');

-- Allow creator to delete their uploads
CREATE POLICY "Authenticated can delete own swipe images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'swipe-images');
