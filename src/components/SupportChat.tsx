import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  status: string;
}

export const SupportChat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchOrCreateConversation = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Try to find existing conversation
      const { data: existing, error: fetchError } = await supabase
        .from("support_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        setConversation(existing);
        await fetchMessages(existing.id);
      } else {
        // Create new conversation
        const { data: newConv, error: createError } = await supabase
          .from("support_conversations")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        setConversation(newConv);
      }
    } catch (error: any) {
      // If no conversation found, create one when user sends first message
      if (error.code === "PGRST116") {
        setConversation(null);
      } else {
        console.error("Error with conversation:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchOrCreateConversation();
    }
  }, [open, user]);

  useEffect(() => {
    if (!conversation) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`support-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      let convId = conversation?.id;

      // Create conversation if doesn't exist
      if (!convId) {
        const { data: newConv, error: createError } = await supabase
          .from("support_conversations")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        convId = newConv.id;
        setConversation(newConv);
      }

      const { error } = await supabase.from("support_messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        message: newMessage.trim(),
        is_admin: false,
      });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from("support_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося надіслати повідомлення",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-foreground">
          <MessageCircle className="h-4 w-4 mr-1" />
          Підтримка
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="p-3 border-b">
          <SheetTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Чат з підтримкою
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-3">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-8">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Напишіть нам, і ми відповімо якнайшвидше!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-2 ${
                          msg.is_admin
                            ? "bg-muted"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {msg.is_admin && (
                          <p className="text-[10px] font-medium mb-0.5 text-muted-foreground">
                            Підтримка
                          </p>
                        )}
                        <p className="text-xs">{msg.message}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.is_admin ? "text-muted-foreground" : "text-primary-foreground/70"
                          }`}
                        >
                          {format(new Date(msg.created_at), "HH:mm", { locale: uk })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Напишіть повідомлення..."
                className="h-9 text-sm"
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              />
              <Button
                size="sm"
                className="h-9"
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
