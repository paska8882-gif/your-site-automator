-- Add color_scheme and layout_style fields to generation_history
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS color_scheme TEXT,
ADD COLUMN IF NOT EXISTS layout_style TEXT;

COMMENT ON COLUMN public.generation_history.color_scheme IS 'Selected color scheme used for generation (e.g., ocean, forest, royal)';
COMMENT ON COLUMN public.generation_history.layout_style IS 'Selected layout style used for generation (e.g., classic, asymmetric, minimalist)';