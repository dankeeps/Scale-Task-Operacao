
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- User-project junction with roles
CREATE TYPE public.project_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE public.user_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  role project_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- Security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- RLS policies for projects
CREATE POLICY "Users can view their projects"
ON public.projects FOR SELECT TO authenticated
USING (public.is_project_member(auth.uid(), id));

CREATE POLICY "Users can create projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- RLS policies for user_projects
CREATE POLICY "Users can view their memberships"
ON public.user_projects FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own memberships"
ON public.user_projects FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Auto-create project on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_project_id UUID;
  project_name TEXT;
BEGIN
  project_name := split_part(NEW.email, '@', 1);
  INSERT INTO public.projects (name, created_by) VALUES (project_name, NEW.id) RETURNING id INTO new_project_id;
  INSERT INTO public.user_projects (user_id, project_id, role) VALUES (NEW.id, new_project_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_project
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_project();
