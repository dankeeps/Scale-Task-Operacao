
CREATE TABLE public.swipe_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swipe_id UUID NOT NULL REFERENCES public.swipes(id) ON DELETE CASCADE,
  active_ads_count INTEGER NOT NULL DEFAULT 0,
  spy_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.swipe_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view swipe_history" ON public.swipe_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert swipe_history" ON public.swipe_history FOR INSERT TO authenticated WITH CHECK (true);
