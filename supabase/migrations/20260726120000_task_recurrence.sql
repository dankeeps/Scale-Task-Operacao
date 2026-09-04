-- Recorrência de tarefas: ao concluir uma tarefa recorrente, o app cria
-- automaticamente a próxima ocorrência copiando todos os dados.
--   none    -> não repete (padrão)
--   weekly  -> toda semana no mesmo dia da semana (próxima = vencimento + 7 dias)
--   monthly -> todo mês no mesmo dia do mês (próxima = vencimento + 1 mês)
-- O dia da semana / dia do mês é derivado da própria data de vencimento.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_recurrence_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_recurrence_check
  CHECK (recurrence IN ('none', 'weekly', 'monthly'));
