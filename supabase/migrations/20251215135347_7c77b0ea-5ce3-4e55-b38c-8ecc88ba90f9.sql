-- Add status and files_data columns to generation_history
ALTER TABLE public.generation_history 
ADD COLUMN status text NOT NULL DEFAULT 'pending',
ADD COLUMN files_data jsonb,
ADD COLUMN error_message text;

-- Add index for status queries
CREATE INDEX idx_generation_history_status ON public.generation_history(status);

-- Enable realtime for generation_history table
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_history;