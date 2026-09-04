-- The app (useTasks, Tasks kanban advance, Criativos auto-task) references
-- tasks.ad_id everywhere, but the column was never actually created in the DB —
-- so every task insert that included ad_id was silently rejected by PostgREST.
-- Add the missing column linking a task to its creative ad.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ad_id uuid REFERENCES public.creative_ads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_ad_id ON public.tasks(ad_id);
