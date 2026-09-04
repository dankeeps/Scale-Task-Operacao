-- Habilita realtime nas tabelas do Spy para que a UI (barra de execução, tabela
-- de resultados, favoritos, gráfico) atualize ao vivo sem precisar dar F5.
-- Sem isso os postgres_changes nunca disparam.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['spy_runs','spy_pages','spy_page_snapshots','spy_settings']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- já está na publicação
    END;
    -- REPLICA IDENTITY FULL: garante que os eventos de UPDATE tragam a linha completa.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
