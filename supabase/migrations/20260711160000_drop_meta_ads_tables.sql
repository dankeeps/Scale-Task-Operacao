-- Remove the Meta Ads feature tables. The Meta Ads integration was deleted from
-- the app; these tables are no longer used. CASCADE clears any dependent objects.

DROP TABLE IF EXISTS public.meta_creatives CASCADE;
DROP TABLE IF EXISTS public.meta_ads CASCADE;
DROP TABLE IF EXISTS public.meta_adsets CASCADE;
DROP TABLE IF EXISTS public.meta_campaigns CASCADE;
DROP TABLE IF EXISTS public.meta_ad_accounts CASCADE;
DROP TABLE IF EXISTS public.meta_ads_config CASCADE;
