-- Make team_id nullable in appeals table
ALTER TABLE public.appeals ALTER COLUMN team_id DROP NOT NULL;