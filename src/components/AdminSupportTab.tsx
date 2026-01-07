import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { MessageSquare, Send, User, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { uk, ru } from "date-fns/locale";

interface Conversation {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  last_message?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

export const AdminSupportTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const dateLocale = language === "ru" ? ru : uk;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const { data: convs, error } = await supabase
        .from("support_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Fetch user info for each conversation
      const conversationsWithUsers = await Promise.all(
        (convs || []).map(async (conv) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", conv.user_id)
            .single();

          // Get last message
          const { data: lastMsg } = await supabase
            .from("support_messages")
            .select("message")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...conv,
            user_name: profile?.display_name || t("admin.user"),
            last_message: lastMsg?.message || t("admin.supportNoMessages"),
          };
        })
      );

      setConversations(conversationsWithUsers);
    } catch (error) {
      console.error("Error fetching conversations:", error);
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
    fetchConversations();

    // Subscribe to new conversations
    const convChannel = supabase
      .channel("admin-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    fetchMessages(selectedConversation.id);

    // Subscribe to new messages
    const msgChannel = supabase
      .channel(`admin-messages-${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedConversation]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        message: newMessage.trim(),
        is_admin: true,
      });

      if (error) throw error;

      // Update conversation updated_at
      await supabase
        .from("support_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      // Create notification for user
      await supabase.from("notifications").insert({
        user_id: selectedConversation.user_id,
        title: t("admin.supportNewMessage"),
        message: newMessage.trim().substring(0, 100) + (newMessage.length > 100 ? "..." : ""),
        type: "support_message",
        data: { conversation_id: selectedConversation.id },
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: t("common.error"),
        description: t("admin.notificationError"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const updateConversationStatus = async (status: string) => {
    if (!selectedConversation) return;

    try {
      const { error } = await supabase
        .from("support_conversations")
        .update({ status })
        .eq("id", selectedConversation.id);

      if (error) throw error;

      setSelectedConversation({ ...selectedConversation, status });
      fetchConversations();

      toast({
        title: t("admin.statusUpdated"),
        description: status === "closed" ? t("admin.supportClose") : t("admin.supportReopen"),
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 h-[calc(100vh-180px)]">
      {/* Conversations list */}
      <Card className="col-span-1">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {t("admin.supportTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-250px)]">
            {loading ? (
              <div className="p-3 text-center text-muted-foreground text-xs">
                {t("common.loading")}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-3 text-center text-muted-foreground text-xs">
                {t("admin.supportNoConversations")}
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-2 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedConversation?.id === conv.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">
                      {conv.user_name}
                    </span>
                    <Badge
                      variant={conv.status === "open" ? "default" : "secondary"}
                      className="text-[10px] h-4"
                    >
                      {conv.status === "open" ? t("admin.supportOpen") : t("admin.supportClosed")}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {conv.last_message}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(conv.updated_at), "dd.MM.yy HH:mm", { locale: dateLocale })}
                  </p>
                </div>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="col-span-2">
        {selectedConversation ? (
          <>
            <CardHeader className="py-2 px-3 border-b flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <CardTitle className="text-sm">{selectedConversation.user_name}</CardTitle>
                <Badge
                  variant={selectedConversation.status === "open" ? "default" : "secondary"}
                  className="text-[10px] h-4"
                >
                  {selectedConversation.status === "open" ? t("admin.supportOpen") : t("admin.supportClosed")}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() =>
                  updateConversationStatus(
                    selectedConversation.status === "open" ? "closed" : "open"
                  )
                }
              >
                {selectedConversation.status === "open" ? (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    {t("admin.supportClose")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t("admin.supportReopen")}
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[calc(100vh-280px)]">
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-2 ${
                          msg.is_admin
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-xs">{msg.message}</p>
                        <p
                        className={`text-[10px] mt-1 ${
                            msg.is_admin ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(msg.created_at), "HH:mm", { locale: dateLocale })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-2 border-t flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t("admin.supportMessagePlaceholder")}
                  className="h-8 text-xs"
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  disabled={selectedConversation.status === "closed"}
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim() || selectedConversation.status === "closed"}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">{t("admin.supportSelectConversation")}</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
