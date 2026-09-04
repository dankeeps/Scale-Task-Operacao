-- ════════════════════════════════════════════════════════════════════════
-- SPY — redesenho manual (por usuário) + fim da busca automática (Apify/cron)
-- ════════════════════════════════════════════════════════════════════════
-- O Spy deixa de ser uma busca automática global (Apify + cron agendado) e
-- passa a ser MANUAL e POR USUÁRIO, alimentado pela extensão (botão ninja):
-- cada "spy capture" é um anúncio salvo por alguém, com palavra-chave, dias
-- ativo, transcrição e a contagem de anúncios ativos no momento do save.
-- O MONITORAMENTO de páginas (snapshots) é mantido.
--
-- Decisões: só no Spy (não vai pra biblioteca do Swipe), popup mínimo,
-- e "começar zerado" (apaga execuções Apify antigas + palavras-chave globais;
-- snapshots de monitoramento são preservados).

-- ── 1) Palavras-chave passam a ser POR USUÁRIO ──────────────────────────
ALTER TABLE public.spy_keywords
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 2) Nova tabela: spy_captures (o "spy" salvo pela pessoa) ─────────────
CREATE TABLE IF NOT EXISTS public.spy_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spy_page_id uuid REFERENCES public.spy_pages(id) ON DELETE SET NULL,
  page_id text,
  page_name text NOT NULL DEFAULT '',
  ad_library_url text NOT NULL DEFAULT '',
  keyword_id uuid REFERENCES public.spy_keywords(id) ON DELETE SET NULL,
  keyword_text text,                       -- snapshot da palavra pesquisada (null = orgânico)
  video_url text,
  thumbnail_url text,
  duration numeric,
  segments jsonb,                          -- transcrição (segmentos)
  days_active int,                         -- dias que o anúncio estava ativo no momento do save
  active_ads_at_capture int,               -- anúncios ativos medidos no momento do save
  potential text,                          -- classificação a partir de active_ads_at_capture
  status text NOT NULL DEFAULT 'processing', -- processing | done | error
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spy_captures_user_idx    ON public.spy_captures (user_id);
CREATE INDEX IF NOT EXISTS spy_captures_created_idx ON public.spy_captures (created_at DESC);
CREATE INDEX IF NOT EXISTS spy_captures_page_idx    ON public.spy_captures (page_id);
CREATE INDEX IF NOT EXISTS spy_captures_keyword_idx ON public.spy_captures (keyword_id);

-- updated_at automático (reusa o trigger já existente do Spy)
DROP TRIGGER IF EXISTS spy_captures_touch ON public.spy_captures;
CREATE TRIGGER spy_captures_touch
  BEFORE UPDATE ON public.spy_captures
  FOR EACH ROW EXECUTE FUNCTION public.spy_touch_updated_at();

-- ── 3) RLS ──────────────────────────────────────────────────────────────
-- Palavras-chave: cada um só enxerga/edita as suas.
ALTER TABLE public.spy_keywords ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='spy_keywords' LOOP
    EXECUTE format('DROP POLICY %I ON public.spy_keywords', p.policyname);
  END LOOP;
END $$;
CREATE POLICY spy_keywords_own_select ON public.spy_keywords
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY spy_keywords_own_insert ON public.spy_keywords
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY spy_keywords_own_update ON public.spy_keywords
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY spy_keywords_own_delete ON public.spy_keywords
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Spy captures: todos os autenticados LEEM tudo ("Todos os Spies"),
-- mas só o autor cria/edita/apaga o seu. (edge function usa service role.)
ALTER TABLE public.spy_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY spy_captures_read_all ON public.spy_captures
  FOR SELECT TO authenticated USING (true);
CREATE POLICY spy_captures_own_insert ON public.spy_captures
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY spy_captures_own_update ON public.spy_captures
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY spy_captures_own_delete ON public.spy_captures
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Realtime para a lista atualizar sozinha
ALTER TABLE public.spy_captures REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.spy_captures;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4) Desliga a busca automática (mantém o monitoramento) ──────────────
-- spy-tick só dispara a busca quando spy_settings.enabled = true; o
-- monitoramento usa monitor_enabled (independente) e continua ligado.
UPDATE public.spy_settings SET enabled = false;

-- ── 5) "Começar zerado": limpa execuções Apify antigas + keywords globais ─
-- spy_ads cai por CASCADE ao apagar spy_runs; spy_page_snapshots.run_id vira
-- NULL (ON DELETE SET NULL), então o histórico de monitoramento é preservado.
DELETE FROM public.spy_runs;
-- keywords antigas eram globais (user_id NULL) — sem dono no modelo novo.
DELETE FROM public.spy_keywords WHERE user_id IS NULL;
