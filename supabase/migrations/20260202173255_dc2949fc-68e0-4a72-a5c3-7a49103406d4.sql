-- Create table for async AI generation jobs
CREATE TABLE public.ai_generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  domain TEXT NOT NULL,
  geo TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  theme TEXT,
  keywords TEXT,
  prohibited_words TEXT,
  technical_prompt TEXT,
  files_data JSONB,
  validation JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own jobs"
ON public.ai_generation_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create their own jobs"
ON public.ai_generation_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow service role to update (for edge function)
CREATE POLICY "Service role can update jobs"
ON public.ai_generation_jobs
FOR UPDATE
USING (true);

-- Index for faster status queries
CREATE INDEX idx_ai_generation_jobs_user_status ON public.ai_generation_jobs(user_id, status);
CREATE INDEX idx_ai_generation_jobs_created_at ON public.ai_generation_jobs(created_at DESC);