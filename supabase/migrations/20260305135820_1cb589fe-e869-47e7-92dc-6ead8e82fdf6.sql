
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS offer_name text DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS link text DEFAULT '';
