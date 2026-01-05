-- Add is_favorite column to generation_spends table
ALTER TABLE public.generation_spends 
ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;