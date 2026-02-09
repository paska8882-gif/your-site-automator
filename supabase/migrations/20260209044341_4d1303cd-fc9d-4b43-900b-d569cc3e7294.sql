
-- Add download_url column for direct zip download links
ALTER TABLE public.generation_history ADD COLUMN IF NOT EXISTS download_url TEXT;

-- Create storage bucket for generated site archives
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-sites', 'generated-sites', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can download (public bucket)
CREATE POLICY "Public read access for generated sites"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-sites');

-- Only service role uploads (edge functions), so no INSERT policy for anon needed
-- Service role bypasses RLS automatically
