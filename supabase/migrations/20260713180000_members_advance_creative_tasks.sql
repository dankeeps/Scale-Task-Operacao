-- The creative pipeline advances by having the assignee of a step conclude their
-- task, which auto-creates the next step's task. Steps can be assigned to any role
-- (especialista, editor, gestor...), but the existing "Copywriter+ can insert tasks"
-- policy blocks members below copywriter_jr from creating that next task, stalling
-- the pipeline for them.
--
-- Additive INSERT policy (OR'd with the existing one): any project member may insert
-- a task that is tied to a creative ad (ad_id set) in their own project. Standalone
-- tasks still require copywriter_jr+.
CREATE POLICY "Members can advance creative tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    ad_id IS NOT NULL
    AND public.is_project_member(auth.uid(), project_id)
  );
