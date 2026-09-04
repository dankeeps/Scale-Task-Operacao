
-- Categories for educational content (global)
CREATE TABLE public.educational_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.educational_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view educational_categories" ON public.educational_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert educational_categories" ON public.educational_categories
  FOR INSERT TO authenticated WITH CHECK (true);

-- Educational content (global, not project-specific)
CREATE TABLE public.educational_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.educational_categories(id) ON DELETE SET NULL,
  youtube_url TEXT NOT NULL,
  responsible_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.educational_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view educational_content" ON public.educational_content
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert educational_content" ON public.educational_content
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can delete educational_content" ON public.educational_content
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Creator can update educational_content" ON public.educational_content
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
