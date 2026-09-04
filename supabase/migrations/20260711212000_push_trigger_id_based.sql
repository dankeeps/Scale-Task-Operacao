-- Switch the push trigger to an id-only, secret-free dispatch. The edge function
-- resolves the notification content server-side (service role), so no shared
-- secret lives in the database. The Authorization header carries the public
-- anon key (same one used by the frontend) purely to satisfy the API gateway.
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
