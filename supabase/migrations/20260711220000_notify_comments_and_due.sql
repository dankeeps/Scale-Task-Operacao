-- Two new notification sources. Both are strictly scoped to the person involved
-- (the task's assignee), and reuse the notifications table so push fires automatically.

-- 1) New comment on a task → notify the ASSIGNEE only.
--    Skips: the comment author, and anyone already @mentioned (the existing
--    notify_comment_mentions trigger already covers mentions).
CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assigned uuid;
  v_task_name text;
  v_commenter text;
BEGIN
  SELECT assigned_to, COALESCE(NULLIF(name, ''), 'Sem nome')
    INTO v_assigned, v_task_name
    FROM public.tasks
    WHERE id = NEW.task_id;

  IF v_assigned IS NOT NULL
     AND v_assigned <> NEW.user_id
     AND NOT (v_assigned = ANY (COALESCE(NEW.mentioned_user_ids, ARRAY[]::uuid[]))) THEN
    SELECT full_name INTO v_commenter FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.notifications (user_id, title, message, task_id)
    VALUES (
      v_assigned,
      'Novo comentário',
      COALESCE(v_commenter, 'Alguém') || ' comentou na sua tarefa "' || v_task_name || '".',
      NEW.task_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_comment_notify ON public.task_comments;
CREATE TRIGGER on_task_comment_notify
  AFTER INSERT ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_comment();

-- 2) Due date approaching (today / tomorrow) → notify the ASSIGNEE only.
--    Runs once a day; only active tasks (not done / archived / deleted).
CREATE OR REPLACE FUNCTION public.notify_due_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_when text;
BEGIN
  FOR r IN
    SELECT t.id, t.assigned_to, COALESCE(NULLIF(t.name, ''), 'Sem nome') AS name, t.due_date
    FROM public.tasks t
    WHERE t.assigned_to IS NOT NULL
      AND t.deleted_at IS NULL
      AND t.status IN ('pendente', 'em_progresso')
      AND t.due_date IS NOT NULL
      AND t.due_date::date IN (CURRENT_DATE, CURRENT_DATE + 1)
  LOOP
    v_when := CASE WHEN r.due_date::date = CURRENT_DATE THEN 'vence hoje' ELSE 'vence amanhã' END;

    -- Don't send the same reminder twice in one day.
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.assigned_to
        AND n.task_id = r.id
        AND n.title = 'Prazo chegando'
        AND n.message LIKE '%' || v_when || '%'
        AND n.created_at::date = CURRENT_DATE
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, task_id)
      VALUES (
        r.assigned_to,
        'Prazo chegando',
        'A tarefa "' || r.name || '" ' || v_when || '.',
        r.id
      );
    END IF;
  END LOOP;
END;
$$;

-- Schedule it daily at 12:00 UTC (~09:00 no horário de Brasília).
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('notify-due-tasks-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule('notify-due-tasks-daily', '0 12 * * *', $$SELECT public.notify_due_tasks();$$);
