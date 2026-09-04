-- Métricas financeiras do anúncio, também alimentadas pelo webhook do SaaS de
-- tracking: faturamento (front), investimento, ROAS e faturamento de backend.
ALTER TABLE public.creative_ads
  ADD COLUMN IF NOT EXISTS faturamento          NUMERIC,
  ADD COLUMN IF NOT EXISTS investimento         NUMERIC,
  ADD COLUMN IF NOT EXISTS roas                 NUMERIC,
  ADD COLUMN IF NOT EXISTS faturamento_backend  NUMERIC;
