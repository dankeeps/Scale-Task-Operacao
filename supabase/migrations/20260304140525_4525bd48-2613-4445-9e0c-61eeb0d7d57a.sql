
-- Reusable function: check if a user has access to a project (with optional role check)
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID, _project_id UUID, _min_role project_role DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND (
        CASE _min_role
          WHEN 'viewer' THEN role IN ('viewer', 'editor', 'owner')
          WHEN 'editor' THEN role IN ('editor', 'owner')
          WHEN 'owner' THEN role = 'owner'
        END
      )
  )
$$;
