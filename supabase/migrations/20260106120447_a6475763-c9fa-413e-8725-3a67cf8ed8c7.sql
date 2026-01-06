-- Add geo/country column to generation_history table
ALTER TABLE public.generation_history 
ADD COLUMN geo TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.generation_history.geo IS 'Geographic location/country selected for the generated website';