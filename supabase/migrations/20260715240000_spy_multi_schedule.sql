-- Permite até 3 agendamentos de busca por dia (cada um com horário + switch próprio).
-- Guardado como array JSONB: [{ "time": "HH:MM", "enabled": bool }, ...]. Os dias da
-- semana e o fuso continuam compartilhados (execution_days / timezone).
ALTER TABLE public.spy_settings
  ADD COLUMN IF NOT EXISTS execution_schedules jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migra o horário único existente para o 1º agendamento.
UPDATE public.spy_settings
SET execution_schedules = jsonb_build_array(
  jsonb_build_object('time', left(COALESCE(execution_time::text, '09:00'), 5), 'enabled', COALESCE(enabled, false))
)
WHERE execution_schedules = '[]'::jsonb OR execution_schedules IS NULL;
