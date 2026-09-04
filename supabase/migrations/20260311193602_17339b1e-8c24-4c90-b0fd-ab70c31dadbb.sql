
-- Table to store Meta Ads configuration per project
CREATE TABLE public.meta_ads_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_valid BOOLEAN NOT NULL DEFAULT false,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Table to store selected ad accounts
CREATE TABLE public.meta_ad_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL DEFAULT '',
  selected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, account_id)
);

-- Table to store campaigns
CREATE TABLE public.meta_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PAUSED',
  objective TEXT NOT NULL DEFAULT '',
  daily_budget NUMERIC,
  lifetime_budget NUMERIC,
  created_by UUID,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, campaign_id)
);

-- Table to store ad sets
CREATE TABLE public.meta_adsets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  adset_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PAUSED',
  daily_budget NUMERIC,
  targeting JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, adset_id)
);

-- Table to store ads
CREATE TABLE public.meta_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  adset_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PAUSED',
  creative JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, ad_id)
);

-- Enable RLS
ALTER TABLE public.meta_ads_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;

-- RLS: Only owner/master can manage Meta Ads config
CREATE POLICY "Master+ can view meta_ads_config" ON public.meta_ads_config
  FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can insert meta_ads_config" ON public.meta_ads_config
  FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can update meta_ads_config" ON public.meta_ads_config
  FOR UPDATE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role))
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete meta_ads_config" ON public.meta_ads_config
  FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

-- RLS for ad accounts
CREATE POLICY "Master+ can view meta_ad_accounts" ON public.meta_ad_accounts
  FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can insert meta_ad_accounts" ON public.meta_ad_accounts
  FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can update meta_ad_accounts" ON public.meta_ad_accounts
  FOR UPDATE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role))
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete meta_ad_accounts" ON public.meta_ad_accounts
  FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

-- RLS for campaigns
CREATE POLICY "Master+ can view meta_campaigns" ON public.meta_campaigns
  FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can insert meta_campaigns" ON public.meta_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can update meta_campaigns" ON public.meta_campaigns
  FOR UPDATE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role))
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete meta_campaigns" ON public.meta_campaigns
  FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

-- RLS for adsets
CREATE POLICY "Master+ can view meta_adsets" ON public.meta_adsets
  FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can insert meta_adsets" ON public.meta_adsets
  FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can update meta_adsets" ON public.meta_adsets
  FOR UPDATE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role))
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete meta_adsets" ON public.meta_adsets
  FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

-- RLS for ads
CREATE POLICY "Master+ can view meta_ads" ON public.meta_ads
  FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can insert meta_ads" ON public.meta_ads
  FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can update meta_ads" ON public.meta_ads
  FOR UPDATE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role))
  WITH CHECK (has_project_access(auth.uid(), project_id, 'master'::project_role));

CREATE POLICY "Master+ can delete meta_ads" ON public.meta_ads
  FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id, 'master'::project_role));
