-- Add vip_images column to generation_history for storing VIP manual request images
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS vip_images jsonb DEFAULT NULL;

-- Add admin_note column if not exists (for VIP request notes from buyer)
-- This column already exists based on types, but let's ensure it

COMMENT ON COLUMN public.generation_history.vip_images IS 'Array of image URLs for VIP manual requests';

-- Create storage bucket for manual request images
INSERT INTO storage.buckets (id, name, public)
VALUES ('manual-request-images', 'manual-request-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for manual request images bucket
CREATE POLICY "Anyone can view manual request images"
ON storage.objects FOR SELECT
USING (bucket_id = 'manual-request-images');

CREATE POLICY "Authenticated users can upload manual request images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'manual-request-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own manual request images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'manual-request-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);