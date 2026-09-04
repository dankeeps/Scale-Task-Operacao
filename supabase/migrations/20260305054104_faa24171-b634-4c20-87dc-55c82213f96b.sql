
-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_progresso', 'concluida');

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  status task_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Members can view tasks
CREATE POLICY "Members can view tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- Copywriter+ can insert tasks
CREATE POLICY "Copywriter+ can insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role));

-- Update: master+ or own tasks for copywriter_jr
CREATE POLICY "Update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    has_project_access(auth.uid(), project_id, 'master'::project_role)
    OR (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid())
  )
  WITH CHECK (
    has_project_access(auth.uid(), project_id, 'master'::project_role)
    OR (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid())
  );

-- Delete: master+ or own tasks
CREATE POLICY "Delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (
    has_project_access(auth.uid(), project_id, 'master'::project_role)
    OR (has_project_access(auth.uid(), project_id, 'copywriter_jr'::project_role) AND created_by = auth.uid())
  );
