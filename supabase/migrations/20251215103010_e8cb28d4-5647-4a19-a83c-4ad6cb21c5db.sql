-- Create table for storing website generation history
CREATE TABLE public.generation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number SERIAL,
  prompt TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  zip_data TEXT, -- Base64 encoded ZIP file
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read and insert (since there's no auth yet)
CREATE POLICY "Anyone can view generation history" 
ON public.generation_history 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create generations" 
ON public.generation_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete generations" 
ON public.generation_history 
FOR DELETE 
USING (true);