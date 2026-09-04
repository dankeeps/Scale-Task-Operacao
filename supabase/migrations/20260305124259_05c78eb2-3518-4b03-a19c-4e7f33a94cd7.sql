
CREATE TABLE public.swipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_name TEXT NOT NULL,
  library_link TEXT NOT NULL DEFAULT '',
  site_url TEXT NOT NULL DEFAULT '',
  active_ads_count INTEGER NOT NULL DEFAULT 0,
  niche TEXT NOT NULL DEFAULT '',
  spy_date DATE,
  swipe_link TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view swipes" ON public.swipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert swipes" ON public.swipes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can delete swipes" ON public.swipes FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Creator can update swipes" ON public.swipes FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
