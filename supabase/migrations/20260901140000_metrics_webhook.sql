-- Webhook de métricas: cada projeto tem um token secreto (identifica o projeto
-- no request do SaaS de tracking) e, opcionalmente, um domínio próprio só para
-- exibição da URL. O SaaS envia 1x/dia as métricas por nome do anúncio.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS metrics_webhook_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS metrics_webhook_domain TEXT;

-- Busca rápida do projeto pelo token quando o webhook é chamado.
CREATE UNIQUE INDEX IF NOT EXISTS projects_metrics_webhook_token_idx
  ON public.projects (metrics_webhook_token);
