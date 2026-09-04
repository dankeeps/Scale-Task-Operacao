-- Let the workspace OWNER clear a project's chat (delete any message in it),
-- in addition to the existing "delete your own message" policy.
CREATE POLICY "Owners can delete project chat"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'owner'::project_role));
