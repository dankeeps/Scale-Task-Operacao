
-- Flows table (templates)
CREATE TABLE public.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view flows" ON public.flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert flows" ON public.flows FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can update flows" ON public.flows FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can delete flows" ON public.flows FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Flow steps table
CREATE TABLE public.flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_number int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view flow_steps" ON public.flow_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert flow_steps" ON public.flow_steps FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.flows WHERE id = flow_steps.flow_id AND created_by = auth.uid()));
CREATE POLICY "Creator can update flow_steps" ON public.flow_steps FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.flows WHERE id = flow_steps.flow_id AND created_by = auth.uid()));
CREATE POLICY "Creator can delete flow_steps" ON public.flow_steps FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.flows WHERE id = flow_steps.flow_id AND created_by = auth.uid()));

-- Flow instances (when a flow is started on a project)
CREATE TABLE public.flow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  current_step_index int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view flow_instances" ON public.flow_instances FOR SELECT TO authenticated USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert flow_instances" ON public.flow_instances FOR INSERT TO authenticated WITH CHECK (is_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "Members can update flow_instances" ON public.flow_instances FOR UPDATE TO authenticated USING (is_project_member(auth.uid(), project_id));
CREATE POLICY "Creator can delete flow_instances" ON public.flow_instances FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Add flow_instance_id to tasks
ALTER TABLE public.tasks ADD COLUMN flow_instance_id uuid REFERENCES public.flow_instances(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN flow_step_index int;
