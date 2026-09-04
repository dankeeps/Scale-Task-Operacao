-- Per-account theme preference (syncs across devices).
-- Add the column WITHOUT backfilling existing rows (they stay NULL → app keeps
-- their current/local choice), then set DEFAULT 'light' so NEW users (profile
-- created by the handle_new_user_profile trigger) start in light mode.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE public.profiles ALTER COLUMN theme SET DEFAULT 'light';
