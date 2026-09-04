-- Sobe o limite do bucket swipe-videos de 200 MB para 1 GB (plano Pro).
-- IMPORTANTE: o file_size_limit do bucket NÃO pode passar do limite GLOBAL de
-- upload do projeto (Dashboard → Storage → Settings → "Upload file size limit").
-- Garanta que o global esteja >= 1 GB, senão o upload ainda falha com 400/413.
UPDATE storage.buckets
SET file_size_limit = 1073741824 -- 1 GiB (1024 MB)
WHERE id = 'swipe-videos';
