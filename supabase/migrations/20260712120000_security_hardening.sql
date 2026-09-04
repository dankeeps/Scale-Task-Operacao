-- Security hardening pass.
-- 1) CRITICAL: remove the permissive self-insert policy on user_projects.
--    Because permissive policies are OR-combined, "Users can insert their own
--    memberships" (WITH CHECK user_id = auth.uid()) let ANY authenticated user
--    add themselves to ANY project with ANY role (owner) — full cross-tenant
--    takeover. Signup memberships are created by the SECURITY DEFINER trigger,
--    so this policy is not needed. Members are added via "Owners can add members".
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.user_projects;

-- 2) profiles: stop leaking every user's data (incl. telegram_chat_id) to all
--    authenticated users. Restrict SELECT to yourself + people who share a
--    workspace with you. Uses a SECURITY DEFINER helper to avoid RLS recursion.
CREATE OR REPLACE FUNCTION public.shares_project(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_projects up1
    JOIN public.user_projects up2 ON up1.project_id = up2.project_id
    WHERE up1.user_id = _a AND up2.user_id = _b
  )
$$;

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "View own or co-member profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.shares_project(auth.uid(), id));
