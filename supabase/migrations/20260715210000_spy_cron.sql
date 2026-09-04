-- Agendamento automático do Spy: pg_cron chama a função spy-tick a cada 10 min.
-- A spy-tick decide (no timezone/horário/dias configurados) se dispara a execução.
-- A chave x-cron-key precisa bater com o secret SPY_CRON_KEY da edge function.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- A chave do cron vive no Vault (nome 'spy_cron_key'), NUNCA no código versionado.
-- Insira-a fora do versionamento (uma vez):
--   select vault.create_secret('<SPY_CRON_KEY>', 'spy_cron_key');
CREATE OR REPLACE FUNCTION public.spy_cron_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'spy_cron_key' LIMIT 1;
  PERFORM net.http_post(
    url := 'https://smevuhbqznlnxrixcviz.supabase.co/functions/v1/spy-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', COALESCE(v_key, ''),
      -- anon key (publicável por design) apenas para passar pelo gateway das functions
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZXZ1aGJxem5sbnhyaXhjdml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzI4OTksImV4cCI6MjA5OTM0ODg5OX0.C9l4RtxSHYhPPd1kAgTTKATAGsULOeSO5AO-tfwu8qY'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- (Re)agenda a batida a cada 10 minutos.
DO $$
BEGIN
  PERFORM cron.unschedule('spy-tick-every-10min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule('spy-tick-every-10min', '*/10 * * * *', $$SELECT public.spy_cron_tick();$$);
