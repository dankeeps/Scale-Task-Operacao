
-- Allow owners to delete their projects
CREATE POLICY "Owners can delete projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create a function to clean up all project-related data before deletion
CREATE OR REPLACE FUNCTION public.delete_project_cascade(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify the caller is the owner
  IF NOT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the project owner can delete this project';
  END IF;

  -- Delete related data in correct order (children first)
  DELETE FROM public.task_comments WHERE task_id IN (SELECT id FROM public.tasks WHERE project_id = _project_id);
  DELETE FROM public.notifications WHERE task_id IN (SELECT id FROM public.tasks WHERE project_id = _project_id);
  DELETE FROM public.creative_ads WHERE project_id = _project_id;
  DELETE FROM public.creative_documents WHERE project_id = _project_id;
  DELETE FROM public.metrics_extras WHERE metric_id IN (SELECT id FROM public.metrics WHERE project_id = _project_id);
  DELETE FROM public.metrics WHERE project_id = _project_id;
  DELETE FROM public.tasks WHERE project_id = _project_id;
  DELETE FROM public.flow_instances WHERE project_id = _project_id;
  DELETE FROM public.chat_messages WHERE project_id = _project_id;
  DELETE FROM public.chat_read_status WHERE project_id = _project_id;
  DELETE FROM public.folders WHERE project_id = _project_id;
  DELETE FROM public.formatos WHERE project_id = _project_id;
  DELETE FROM public.remessas WHERE project_id = _project_id;
  DELETE FROM public.offers WHERE project_id = _project_id;
  DELETE FROM public.activity_log WHERE project_id = _project_id;
  DELETE FROM public.user_projects WHERE project_id = _project_id;
  DELETE FROM public.projects WHERE id = _project_id;
END;
$$;
