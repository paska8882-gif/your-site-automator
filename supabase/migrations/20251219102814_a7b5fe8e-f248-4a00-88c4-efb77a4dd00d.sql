-- Create feedback table
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can create feedback
CREATE POLICY "Users can create feedback" 
ON public.feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback" 
ON public.feedback 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update feedback (mark as read)
CREATE POLICY "Admins can update feedback" 
ON public.feedback 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback" 
ON public.feedback 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Anyone can view active quotes
CREATE POLICY "Anyone can view active quotes" 
ON public.quotes 
FOR SELECT 
USING (is_active = true);

-- Admins can manage all quotes
CREATE POLICY "Admins can manage quotes" 
ON public.quotes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default quotes
INSERT INTO public.quotes (text, author, created_by) VALUES
('Код — це поезія, яку розуміють машини', 'Генератор мудростей v2.0', '00000000-0000-0000-0000-000000000000'),
('Найкращий код — той, який не потрібно писати', 'Лінивий програміст', '00000000-0000-0000-0000-000000000000'),
('Спочатку вирішуй проблему, потім пиши код', 'Джон Джонсон', '00000000-0000-0000-0000-000000000000'),
('Простота — передумова надійності', 'Едсгер Дейкстра', '00000000-0000-0000-0000-000000000000'),
('Працюючий код завжди кращий за ідеальний, якого немає', 'Прагматичний розробник', '00000000-0000-0000-0000-000000000000');