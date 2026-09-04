-- Educacional: permitir subir uma aula do computador (vídeo em storage) além do
-- link do YouTube. youtube_url deixa de ser obrigatório; video_url guarda a URL
-- pública do vídeo enviado (bucket swipe-videos, reaproveitado — público, 1 GB).
ALTER TABLE public.educational_content
  ALTER COLUMN youtube_url DROP NOT NULL;
ALTER TABLE public.educational_content
  ADD COLUMN IF NOT EXISTS video_url text;
