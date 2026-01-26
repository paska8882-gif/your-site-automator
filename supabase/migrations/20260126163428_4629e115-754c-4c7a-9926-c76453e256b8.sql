-- Add total_generation_cost column to track cumulative costs across retries
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS total_generation_cost NUMERIC DEFAULT 0;

-- Initialize total_generation_cost from existing generation_cost values
UPDATE public.generation_history 
SET total_generation_cost = COALESCE(generation_cost, 0) 
WHERE total_generation_cost IS NULL OR total_generation_cost = 0;

-- Add retry_count column for easier tracking (extracted from admin_note)
ALTER TABLE public.generation_history 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Parse existing retry counts from admin_note
UPDATE public.generation_history 
SET retry_count = COALESCE(
  (regexp_match(admin_note, 'retry:(\d+)'))[1]::INTEGER, 
  0
)
WHERE admin_note LIKE '%retry:%';

COMMENT ON COLUMN public.generation_history.total_generation_cost IS 'Cumulative AI token costs across all generation attempts (original + retries)';
COMMENT ON COLUMN public.generation_history.retry_count IS 'Number of retry attempts for this generation';