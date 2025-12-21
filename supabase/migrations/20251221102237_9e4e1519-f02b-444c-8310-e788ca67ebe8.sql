-- Add max_concurrent_generations column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN max_concurrent_generations integer NOT NULL DEFAULT 30;

-- Add a check constraint to ensure reasonable limits
ALTER TABLE public.profiles
ADD CONSTRAINT check_max_concurrent_generations 
CHECK (max_concurrent_generations >= 1 AND max_concurrent_generations <= 100);