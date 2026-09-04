
-- Add deleted_at column to folders and tasks for soft-delete (trash feature)
ALTER TABLE public.folders ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN deleted_at timestamptz DEFAULT NULL;
