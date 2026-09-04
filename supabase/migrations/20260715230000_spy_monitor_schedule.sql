-- Agendamento próprio para o monitoramento dos favoritos (separado da busca).
-- Antes o monitoramento rodava junto com a execução da busca; agora tem horário/dias
-- independentes.
ALTER TABLE public.spy_settings
  ADD COLUMN IF NOT EXISTS monitor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monitor_time text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS monitor_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS last_monitor_at timestamptz;
