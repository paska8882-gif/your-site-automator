
-- Create enum for admin task statuses
CREATE TYPE public.admin_task_status AS ENUM ('todo', 'in_progress', 'done');

-- Create admin_tasks table
CREATE TABLE public.admin_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status admin_task_status NOT NULL DEFAULT 'todo',
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL,
  created_by UUID NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;

-- Admins can view all tasks
CREATE POLICY "Admins can view all tasks"
ON public.admin_tasks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create tasks
CREATE POLICY "Admins can create tasks"
ON public.admin_tasks
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update tasks
CREATE POLICY "Admins can update tasks"
ON public.admin_tasks
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete tasks
CREATE POLICY "Admins can delete tasks"
ON public.admin_tasks
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for admin_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_tasks;
