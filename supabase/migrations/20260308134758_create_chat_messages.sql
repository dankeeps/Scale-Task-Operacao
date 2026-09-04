-- Recovery migration: recreate the public.chat_messages table.
-- The original CREATE TABLE migration was lost during the Lovable export,
-- leaving later migrations (e.g. the audio_url ALTER) referencing a table
-- that never got created. Schema reconstructed from src/integrations/supabase/types.ts
-- and mirrored on the chat_read_status policy pattern.

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can send chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime for the chat feature (INSERT subscriptions in the app)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
