-- Web Push: store device subscriptions and fire a push whenever a notification row is created.

CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions (select)"
  ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own push subscriptions (insert)"
  ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own push subscriptions (update)"
  ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own push subscriptions (delete)"
  ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Async HTTP from Postgres to the edge function.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- On every new notification, ask the send-push function to deliver it.
-- We pass only the notification id; the function resolves the real content
-- server-side, so no secret is needed here (the Authorization value below is
-- the public anon key, the same one shipped in the frontend bundle).
CREATE OR REPLACE FUNCTION public.on_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://smevuhbqznlnxrixcviz.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZXZ1aGJxem5sbnhyaXhjdml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzI4OTksImV4cCI6MjA5OTM0ODg5OX0.C9l4RtxSHYhPPd1kAgTTKATAGsULOeSO5AO-tfwu8qY'
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_notification_created_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.on_notification_push();
