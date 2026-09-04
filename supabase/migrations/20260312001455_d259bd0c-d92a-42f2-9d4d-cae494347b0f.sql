
CREATE TABLE public.meta_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  type text NOT NULL DEFAULT 'image', -- 'image' or 'video'
  name text NOT NULL DEFAULT '',
  meta_hash text, -- image hash from Meta
  meta_video_id text, -- video id from Meta
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.meta_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master+ can view meta_creatives" ON public.meta_creatives
  FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can insert meta_creatives" ON public.meta_creatives
  FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete meta_creatives" ON public.meta_creatives
  FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));
