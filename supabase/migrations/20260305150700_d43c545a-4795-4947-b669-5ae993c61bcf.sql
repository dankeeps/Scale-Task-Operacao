ALTER TABLE public.metrics ADD COLUMN folder_id uuid REFERENCES public.folders(id) DEFAULT NULL;
ALTER TABLE public.metrics ADD COLUMN file_name text DEFAULT '' NOT NULL;