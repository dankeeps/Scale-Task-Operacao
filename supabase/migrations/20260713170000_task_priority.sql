-- Task priority flag. The creative auto-tasks are all created as "alta" (high),
-- shown as a red "Alta" tag in the task list. Existing/manual tasks default to
-- "normal". Values are kept as free text ('normal' | 'alta') to stay flexible.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
