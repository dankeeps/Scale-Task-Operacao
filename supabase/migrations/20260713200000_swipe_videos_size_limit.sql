-- The swipe-videos bucket was created without a file_size_limit, so it inherited
-- the project's GLOBAL storage upload limit (Supabase default 50 MB). Uploading a
-- longer video (the app allows up to 200 MB client-side) returned 400 Bad Request.
--
-- Raise the bucket limit to 200 MB and restrict to common video mime types.
-- NOTE: a bucket's file_size_limit cannot exceed the project's GLOBAL upload limit.
-- If uploads still fail after this, raise the global limit in the Supabase Dashboard
-- (Storage → Settings → "Upload file size limit"); the Free plan is capped at 50 MB.
UPDATE storage.buckets
SET
  file_size_limit = 209715200, -- 200 MB
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
    'video/x-msvideo',
    'video/mpeg',
    'image/jpeg' -- poster frame uploaded alongside the video
  ]
WHERE id = 'swipe-videos';
