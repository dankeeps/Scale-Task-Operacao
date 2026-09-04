
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow system inserts (via trigger with security definer)
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger function to create notification when a task is assigned
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assigner_name text;
  task_name text;
BEGIN
  -- Only notify if assigned_to is set and it's not self-assignment
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    -- Get the name of the person who created/assigned the task
    SELECT full_name INTO assigner_name FROM public.profiles WHERE id = NEW.created_by;
    task_name := COALESCE(NULLIF(NEW.name, ''), 'Sem nome');

    INSERT INTO public.notifications (user_id, title, message, task_id)
    VALUES (
      NEW.assigned_to,
      'Nova tarefa atribuída',
      COALESCE(assigner_name, 'Alguém') || ' atribuiu a tarefa "' || task_name || '" para você.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_assigned
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();
