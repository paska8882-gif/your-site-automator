-- Create storage bucket for appeal screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('appeal-screenshots', 'appeal-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to appeal-screenshots bucket
CREATE POLICY "Users can upload appeal screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'appeal-screenshots' AND auth.uid() IS NOT NULL);

-- Allow public read access to appeal screenshots
CREATE POLICY "Anyone can view appeal screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'appeal-screenshots');

-- Allow users to delete their own screenshots
CREATE POLICY "Users can delete own appeal screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'appeal-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add screenshot_url column to appeals table
ALTER TABLE public.appeals
ADD COLUMN IF NOT EXISTS screenshot_url TEXT;