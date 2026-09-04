
-- Step 1: Drop ALL policies that reference has_project_access or is_project_member
DROP POLICY IF EXISTS "Users can view creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Users can insert creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Users can update creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Users can delete creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Members can view creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Copywriter+ can insert creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Update creative_ads" ON public.creative_ads;
DROP POLICY IF EXISTS "Delete creative_ads" ON public.creative_ads;

DROP POLICY IF EXISTS "Users can view creative_documents" ON public.creative_documents;
DROP POLICY IF EXISTS "Users can insert creative_documents" ON public.creative_documents;
DROP POLICY IF EXISTS "Users can update creative_documents" ON public.creative_documents;
DROP POLICY IF EXISTS "Users can delete creative_documents" ON public.creative_documents;

DROP POLICY IF EXISTS "Users can view formatos" ON public.formatos;
DROP POLICY IF EXISTS "Users can insert formatos" ON public.formatos;
DROP POLICY IF EXISTS "Users can delete formatos" ON public.formatos;

DROP POLICY IF EXISTS "Users can view remessas" ON public.remessas;
DROP POLICY IF EXISTS "Users can insert remessas" ON public.remessas;
DROP POLICY IF EXISTS "Users can delete remessas" ON public.remessas;

DROP POLICY IF EXISTS "Users can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can add members" ON public.user_projects;
DROP POLICY IF EXISTS "Owners can remove members" ON public.user_projects;
DROP POLICY IF EXISTS "Members can view project members" ON public.user_projects;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.user_projects;
DROP POLICY IF EXISTS "Users can view their memberships" ON public.user_projects;
