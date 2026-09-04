-- ============================================================================
-- SPY feature — schema (Etapa 2)
-- Global / single-tenant (decisão do usuário): sem project_id. Qualquer usuário
-- autenticado lê/escreve (RLS = authenticated). As edge functions gravam com a
-- service role (que ignora RLS). Tokens Apify/Browserless NÃO ficam aqui — vão
-- como secrets do backend; aqui só config não-sensível.
-- ============================================================================

-- Toca updated_at automaticamente.
CREATE OR REPLACE FUNCTION public.spy_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------------------------------------------------------------------------
-- spy_settings (singleton: uma linha global de configuração)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,           -- execução automática
  execution_time time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  execution_days int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Dom .. 6=Sáb (JS getDay)
  -- Apify (config não-secreta; token é secret do backend)
  apify_endpoint text,
  apify_actor_id text,
  apify_task_id text,
  results_default_limit int NOT NULL DEFAULT 10,
  -- Browserless (config não-secreta; token é secret do backend)
  browserless_url text,
  -- Fila / requisições
  request_timeout int NOT NULL DEFAULT 120,          -- segundos
  max_retries int NOT NULL DEFAULT 3,
  request_interval int NOT NULL DEFAULT 2,           -- segundos entre consultas
  concurrency int NOT NULL DEFAULT 1,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- spy_keywords
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spy_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  results_limit int NOT NULL DEFAULT 10,
  execution_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spy_keywords_order ON public.spy_keywords (is_active, execution_order);

-- ---------------------------------------------------------------------------
-- spy_runs (uma execução completa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spy_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
    -- pending | running | keywords | pages | monitoring | done | done_with_errors | failed
  started_at timestamptz,
  finished_at timestamptz,
  trigger_type text NOT NULL DEFAULT 'manual',       -- scheduled | manual
  total_keywords int NOT NULL DEFAULT 0,
  processed_keywords int NOT NULL DEFAULT 0,
  total_ads int NOT NULL DEFAULT 0,
  total_pages int NOT NULL DEFAULT 0,
  total_success int NOT NULL DEFAULT 0,
  total_errors int NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spy_runs_created ON public.spy_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spy_runs_status ON public.spy_runs (status);

-- ---------------------------------------------------------------------------
-- spy_ads (anúncios encontrados pela Apify)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spy_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.spy_runs(id) ON DELETE CASCADE,
  keyword_id uuid REFERENCES public.spy_keywords(id) ON DELETE SET NULL,
  external_ad_id text,
  page_id text,
  page_name text,
  ad_library_url text,
  ad_text text,
  creative_url text,
  image_url text,
  video_url text,
  cta text,
  ad_started_at text,                                -- data de início (bruta, FB varia)
  collected_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spy_ads_run ON public.spy_ads (run_id);
CREATE INDEX IF NOT EXISTS idx_spy_ads_page ON public.spy_ads (page_id);
CREATE INDEX IF NOT EXISTS idx_spy_ads_keyword ON public.spy_ads (keyword_id);
-- Evita salvar o mesmo anúncio duas vezes na mesma execução.
CREATE UNIQUE INDEX IF NOT EXISTS uq_spy_ads_run_extid
  ON public.spy_ads (run_id, external_ad_id) WHERE external_ad_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- spy_pages (página única; page_id global)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spy_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL UNIQUE,
  page_name text,
  ad_library_url text,
  current_active_ads int,
  current_potential text,                            -- key da faixa (low/medium/high/...)
  last_checked_at timestamptz,
  is_favorite boolean NOT NULL DEFAULT false,
  monitoring_enabled boolean NOT NULL DEFAULT false,
  favorited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spy_pages_favorite ON public.spy_pages (is_favorite) WHERE is_favorite;
CREATE INDEX IF NOT EXISTS idx_spy_pages_monitor ON public.spy_pages (monitoring_enabled) WHERE monitoring_enabled;

-- ---------------------------------------------------------------------------
-- spy_page_snapshots (histórico das medições)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spy_page_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spy_page_id uuid NOT NULL REFERENCES public.spy_pages(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.spy_runs(id) ON DELETE SET NULL,
  active_ads int,
  potential text,
  difference_from_previous int,
  status text NOT NULL DEFAULT 'success',            -- success | error
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spy_snap_page_time ON public.spy_page_snapshots (spy_page_id, checked_at DESC);

-- ---------------------------------------------------------------------------
-- spy_potential_ranges (faixas de classificação)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spy_potential_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,                                 -- low | medium | high (identificador estável)
  name text NOT NULL,
  minimum_ads int NOT NULL,
  maximum_ads int NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['spy_settings','spy_keywords','spy_pages','spy_potential_ranges'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_touch ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.spy_touch_updated_at()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: global single-tenant → qualquer usuário autenticado. Edge functions
-- usam service role (ignora RLS).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'spy_settings','spy_keywords','spy_runs','spy_ads','spy_pages',
    'spy_page_snapshots','spy_potential_ranges'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "spy authenticated all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "spy authenticated all" ON public.%I
                    FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------
-- Configuração singleton (só cria se ainda não existir nenhuma).
INSERT INTO public.spy_settings (enabled)
SELECT false WHERE NOT EXISTS (SELECT 1 FROM public.spy_settings);

-- Faixas padrão de classificação.
INSERT INTO public.spy_potential_ranges (key, name, minimum_ads, maximum_ads, color, is_active)
SELECT * FROM (VALUES
  ('low',    'Baixo potencial', 1,  10,     '#64748b', true),
  ('medium', 'Médio potencial', 11, 40,     '#f59e0b', true),
  ('high',   'Alto potencial',  41, 999999, '#10b981', true)
) AS v(key, name, minimum_ads, maximum_ads, color, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.spy_potential_ranges);
