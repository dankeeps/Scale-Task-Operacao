
-- Drop remaining policy
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

-- Drop functions that reference old enum (CASCADE ok since no policy dependencies)
DROP FUNCTION IF EXISTS public.has_project_access CASCADE;
DROP FUNCTION IF EXISTS public.is_project_member CASCADE;

-- Change enum
CREATE TYPE public.project_role_v2 AS ENUM ('owner', 'master', 'copywriter_jr', 'especialista');
ALTER TABLE public.user_projects ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_projects ALTER COLUMN role TYPE project_role_v2
  USING (CASE role::text WHEN 'owner' THEN 'owner'::project_role_v2 WHEN 'editor' THEN 'master'::project_role_v2 WHEN 'viewer' THEN 'especialista'::project_role_v2 END);
ALTER TABLE public.user_projects ALTER COLUMN role SET DEFAULT 'especialista'::project_role_v2;
DROP TYPE public.project_role;
ALTER TYPE public.project_role_v2 RENAME TO project_role;

-- Add created_by
ALTER TABLE public.creative_ads ADD COLUMN created_by uuid;
ALTER TABLE public.creative_documents ADD COLUMN created_by uuid;
