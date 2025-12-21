-- Create priority enum
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Add priority column to admin_tasks
ALTER TABLE public.admin_tasks 
ADD COLUMN priority task_priority NOT NULL DEFAULT 'medium';