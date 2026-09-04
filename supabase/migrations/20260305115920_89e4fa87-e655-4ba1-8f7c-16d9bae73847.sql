
-- Task comments table
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the task's project can see comments
CREATE POLICY "Members can view task comments"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
      AND is_project_member(auth.uid(), t.project_id)
    )
  );

-- Authenticated users can insert comments on tasks they can see
CREATE POLICY "Members can insert task comments"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
      AND is_project_member(auth.uid(), t.project_id)
    )
  );

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.task_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger to notify mentioned users
CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  commenter_name text;
  mentioned_id uuid;
  task_name text;
BEGIN
  SELECT full_name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT name INTO task_name FROM public.tasks WHERE id = NEW.task_id;

  FOREACH mentioned_id IN ARRAY NEW.mentioned_user_ids
  LOOP
    IF mentioned_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, title, message, task_id)
      VALUES (
        mentioned_id,
        'Você foi mencionado',
        COALESCE(commenter_name, 'Alguém') || ' mencionou você em um comentário na tarefa "' || COALESCE(task_name, 'Sem nome') || '".',
        NEW.task_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_mention
  AFTER INSERT ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_mentions();
