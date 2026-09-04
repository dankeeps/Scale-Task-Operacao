-- Chave GLOBAL do ElevenLabs, configurável pela aba de Configurações e usada por
-- todos os usuários/projetos nas transcrições. Guardada em uma tabela de linha
-- única; o valor cru só é lido pelas edge functions (service role). O cliente
-- nunca lê a chave — só grava e consulta o status (via RPCs SECURITY DEFINER).

CREATE TABLE IF NOT EXISTS public.global_settings (
  id                  TEXT PRIMARY KEY DEFAULT 'singleton',
  elevenlabs_api_key  TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,
  CONSTRAINT global_settings_singleton CHECK (id = 'singleton')
);

-- RLS ligada e SEM policies = nega todo acesso direto do cliente.
-- (service role ignora RLS; o cliente usa só as RPCs abaixo.)
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Grava a chave (qualquer usuário autenticado). Passar vazio limpa a chave.
CREATE OR REPLACE FUNCTION public.set_elevenlabs_key(_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.global_settings (id, elevenlabs_api_key, updated_at, updated_by)
  VALUES ('singleton', NULLIF(btrim(_key), ''), now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET elevenlabs_api_key = EXCLUDED.elevenlabs_api_key,
        updated_at = now(),
        updated_by = auth.uid();
END;
$$;

-- Status seguro: só diz se está setada, os últimos 4 dígitos e quando mudou.
CREATE OR REPLACE FUNCTION public.get_elevenlabs_key_status()
RETURNS TABLE(is_set BOOLEAN, hint TEXT, updated_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (gs.elevenlabs_api_key IS NOT NULL AND length(gs.elevenlabs_api_key) > 0) AS is_set,
    CASE WHEN gs.elevenlabs_api_key IS NOT NULL AND length(gs.elevenlabs_api_key) >= 4
         THEN right(gs.elevenlabs_api_key, 4) END AS hint,
    gs.updated_at
  FROM public.global_settings gs
  WHERE gs.id = 'singleton';
$$;

REVOKE ALL ON FUNCTION public.set_elevenlabs_key(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_elevenlabs_key_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_elevenlabs_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_elevenlabs_key_status() TO authenticated;
