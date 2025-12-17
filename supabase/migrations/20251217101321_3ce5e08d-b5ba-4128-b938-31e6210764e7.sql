-- Create support conversations table
CREATE TABLE public.support_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_conversations
CREATE POLICY "Users can view their own conversations"
ON public.support_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
ON public.support_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
ON public.support_conversations FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update conversations"
ON public.support_conversations FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for support_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.support_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.support_conversations 
  WHERE id = conversation_id AND user_id = auth.uid()
));

CREATE POLICY "Users can send messages in their conversations"
ON public.support_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.support_conversations 
  WHERE id = conversation_id AND user_id = auth.uid()
) AND is_admin = false);

CREATE POLICY "Admins can view all messages"
ON public.support_messages FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can send messages"
ON public.support_messages FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_admin = true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Trigger for updated_at
CREATE TRIGGER update_support_conversations_updated_at
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();