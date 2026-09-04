-- Grants de nível de tabela para os papéis do Supabase (a segurança real é a RLS,
-- habilitada nas tabelas). Sem isso, toda operação DML dá "permission denied for
-- table ...". O Supabase hospedado aplica esses grants por padrão; aqui deixamos
-- explícito para o repo ser autossuficiente (Supabase local / novos projetos).
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- Tabelas/sequências/rotinas futuras herdam os mesmos grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON ROUTINES TO authenticated, service_role;
