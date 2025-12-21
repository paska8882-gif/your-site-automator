-- Add screenshot_urls column to store multiple screenshots as JSON array
ALTER TABLE public.appeals ADD COLUMN screenshot_urls jsonb DEFAULT '[]'::jsonb;

-- Migrate existing data from screenshot_url to screenshot_urls
UPDATE public.appeals 
SET screenshot_urls = jsonb_build_array(screenshot_url)
WHERE screenshot_url IS NOT NULL AND screenshot_url != '';

-- Comment for clarity
COMMENT ON COLUMN public.appeals.screenshot_urls IS 'Array of screenshot URLs for the appeal';