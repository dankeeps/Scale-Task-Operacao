-- Role model v2 (2026-07-13). Five roles, reusing existing enum slots:
--   Dono                = owner        (full access)
--   Copywriter chief    = master       (full access)
--   Especialista        = especialista (full access — ELEVATED from mid-tier)
--   Copywriter research = copywriter_jr (limited: view all, edit tasks, create swipe)
--   Editor              = editor        (limited: same as research minus swipe create)
-- "gestor" is retired from the picker (nobody is assigned to it).
--
-- Because Especialista is now FULL but sits low in the has_project_access ordinal
-- hierarchy, full-access gates use an explicit helper instead of the hierarchy.

-- Elevate especialista to MASTER level inside the hierarchy so it passes every
-- has_project_access gate up to 'master' (folders, remessas, offers, formatos, …)
-- automatically — that's what "acesso total" requires. Only the 'owner' gate still
-- excludes especialista. copywriter_jr (research) and editor keep their positions.
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid, _min_role project_role DEFAULT 'especialista'::project_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects WHERE user_id = _user_id AND project_id = _project_id
      AND CASE _min_role::text
        WHEN 'editor' THEN role::text IN ('editor','especialista','gestor','copywriter_jr','master','owner')
        WHEN 'especialista' THEN role::text IN ('especialista','gestor','copywriter_jr','master','owner')
        WHEN 'gestor' THEN role::text IN ('gestor','copywriter_jr','master','owner','especialista')
        WHEN 'copywriter_jr' THEN role::text IN ('copywriter_jr','master','owner','especialista')
        WHEN 'master' THEN role::text IN ('master','owner','especialista')
        WHEN 'owner' THEN role::text = 'owner'
      END
  )
$$;

CREATE OR REPLACE FUNCTION public.is_full_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects
    WHERE user_id = _user_id AND project_id = _project_id
      AND role::text IN ('owner','master','especialista')
  )
$$;

-- Métricas: full access only (owner, master, especialista). Editor & research: none.
CREATE OR REPLACE FUNCTION public.can_view_metrics(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_full_access(_user_id, _project_id)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_metrics(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_full_access(_user_id, _project_id)
$$;

-- ---------------------------------------------------------------------------
-- TASKS: any project member can create + edit/archive; only full access can
-- permanently delete (spec: editor/research "pode criar, editar, arquivar…
-- só não excluir permanentemente").
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can insert tasks" ON public.tasks;
CREATE POLICY "Members can insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
CREATE POLICY "Members can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Delete tasks" ON public.tasks;
CREATE POLICY "Delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_full_access(auth.uid(), project_id));

-- ---------------------------------------------------------------------------
-- CRIATIVOS: all members can VIEW (existing SELECT policies stay). Only full
-- access can create/edit/delete documents and ads (limited roles are view-only).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Copywriter+ can insert creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Update creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Delete creative_ads" ON public.creative_ads;
CREATE POLICY "Full access insert creative_ads"
  ON public.creative_ads FOR INSERT TO authenticated
  WITH CHECK (public.is_full_access(auth.uid(), project_id));
CREATE POLICY "Full access update creative_ads"
  ON public.creative_ads FOR UPDATE TO authenticated
  USING (public.is_full_access(auth.uid(), project_id))
  WITH CHECK (public.is_full_access(auth.uid(), project_id));
CREATE POLICY "Full access delete creative_ads"
  ON public.creative_ads FOR DELETE TO authenticated
  USING (public.is_full_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "Copywriter+ can insert creative_documents" ON public.creative_documents;
DROP POLICY IF EXISTS "Update creative_documents" ON public.creative_documents;
DROP POLICY IF EXISTS "Delete creative_documents" ON public.creative_documents;
CREATE POLICY "Full access insert creative_documents"
  ON public.creative_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_full_access(auth.uid(), project_id));
CREATE POLICY "Full access update creative_documents"
  ON public.creative_documents FOR UPDATE TO authenticated
  USING (public.is_full_access(auth.uid(), project_id))
  WITH CHECK (public.is_full_access(auth.uid(), project_id));
CREATE POLICY "Full access delete creative_documents"
  ON public.creative_documents FOR DELETE TO authenticated
  USING (public.is_full_access(auth.uid(), project_id));
