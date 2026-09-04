
-- Status enum for ads
CREATE TYPE public.ad_status AS ENUM (
  'enviado_gravacao',
  'enviado_analise_1',
  'enviado_edicao',
  'enviado_analise_2',
  'enviado_subir',
  'no_ar'
);

-- Remessas (batches)
CREATE TABLE public.remessas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.remessas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view remessas" ON public.remessas
  FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Users can insert remessas" ON public.remessas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'editor'));

CREATE POLICY "Users can delete remessas" ON public.remessas
  FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'editor'));

-- Formatos
CREATE TABLE public.formatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.formatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view formatos" ON public.formatos
  FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Users can insert formatos" ON public.formatos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'editor'));

CREATE POLICY "Users can delete formatos" ON public.formatos
  FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'editor'));

-- Creative documents (groups ads by remessa)
CREATE TABLE public.creative_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  remessa_id UUID REFERENCES public.remessas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.creative_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view creative_documents" ON public.creative_documents
  FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Users can insert creative_documents" ON public.creative_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'editor'));

CREATE POLICY "Users can delete creative_documents" ON public.creative_documents
  FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'editor'));

CREATE POLICY "Users can update creative_documents" ON public.creative_documents
  FOR UPDATE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'editor'))
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'editor'));

-- Creative ads (individual ads within a document)
CREATE TABLE public.creative_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.creative_documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  status ad_status NOT NULL DEFAULT 'enviado_gravacao',
  copywriter_id UUID,
  formato_id UUID REFERENCES public.formatos(id) ON DELETE SET NULL,
  validacao BOOLEAN NOT NULL DEFAULT false,
  hook_rate NUMERIC(5,2),
  hold_rate NUMERIC(5,2),
  cpm NUMERIC(10,2),
  cpc NUMERIC(10,2),
  cic NUMERIC(10,2),
  conv_checkout NUMERIC(5,2),
  texto TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.creative_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view creative_ads" ON public.creative_ads
  FOR SELECT TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'viewer'));

CREATE POLICY "Users can insert creative_ads" ON public.creative_ads
  FOR INSERT TO authenticated
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'editor'));

CREATE POLICY "Users can update creative_ads" ON public.creative_ads
  FOR UPDATE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'editor'))
  WITH CHECK (public.has_project_access(auth.uid(), project_id, 'editor'));

CREATE POLICY "Users can delete creative_ads" ON public.creative_ads
  FOR DELETE TO authenticated
  USING (public.has_project_access(auth.uid(), project_id, 'editor'));
