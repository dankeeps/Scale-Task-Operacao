
-- Recreate functions
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_projects WHERE user_id = _user_id AND project_id = _project_id)
$$;

CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid, _min_role project_role DEFAULT 'especialista'::project_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects WHERE user_id = _user_id AND project_id = _project_id
      AND CASE _min_role
        WHEN 'especialista' THEN role IN ('especialista','copywriter_jr','master','owner')
        WHEN 'copywriter_jr' THEN role IN ('copywriter_jr','master','owner')
        WHEN 'master' THEN role IN ('master','owner')
        WHEN 'owner' THEN role = 'owner'
      END
  )
$$;

CREATE OR REPLACE FUNCTION public.get_project_role(_user_id uuid, _project_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT role::text FROM public.user_projects WHERE user_id = _user_id AND project_id = _project_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_project_id UUID; project_name TEXT;
BEGIN
  project_name := split_part(NEW.email, '@', 1);
  INSERT INTO public.projects (name, created_by) VALUES (project_name, NEW.id) RETURNING id INTO new_project_id;
  INSERT INTO public.user_projects (user_id, project_id, role) VALUES (NEW.id, new_project_id, 'owner');
  RETURN NEW;
END;
$$;

-- ALL policies
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can view their projects" ON public.projects FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_project_member(auth.uid(), id));

CREATE POLICY "Members can view project members" ON public.user_projects FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Users can insert their own memberships" ON public.user_projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can add members" ON public.user_projects FOR INSERT TO authenticated WITH CHECK (public.has_project_access(auth.uid(), project_id, 'owner'::project_role));
CREATE POLICY "Owners can remove members" ON public.user_projects FOR DELETE TO authenticated USING (public.has_project_access(auth.uid(), project_id, 'owner'::project_role));

CREATE POLICY "Members can view creative_ads" ON public.creative_ads FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Copywriter+ can insert creative_ads" ON public.creative_ads FOR INSERT TO authenticated WITH CHECK (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role));
CREATE POLICY "Update creative_ads" ON public.creative_ads FOR UPDATE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role) OR (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()))
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'master'::project_role) OR (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()));
CREATE POLICY "Delete creative_ads" ON public.creative_ads FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role) OR (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()));

CREATE POLICY "Members can view creative_documents" ON public.creative_documents FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Copywriter+ can insert creative_documents" ON public.creative_documents FOR INSERT TO authenticated WITH CHECK (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role));
CREATE POLICY "Update creative_documents" ON public.creative_documents FOR UPDATE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role) OR (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()))
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'master'::project_role) OR (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()));
CREATE POLICY "Delete creative_documents" ON public.creative_documents FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role) OR (public.has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid()));

CREATE POLICY "Members can view formatos" ON public.formatos FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Master+ can insert formatos" ON public.formatos FOR INSERT TO authenticated WITH CHECK (public.has_project_access(auth.uid(), project_id, 'master'::project_role));
CREATE POLICY "Master+ can delete formatos" ON public.formatos FOR DELETE TO authenticated USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Members can view remessas" ON public.remessas FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "Master+ can insert remessas" ON public.remessas FOR INSERT TO authenticated WITH CHECK (public.has_project_access(auth.uid(), project_id, 'master'::project_role));
CREATE POLICY "Master+ can delete remessas" ON public.remessas FOR DELETE TO authenticated USING (public.has_project_access(auth.uid(), project_id, 'master'::project_role));
