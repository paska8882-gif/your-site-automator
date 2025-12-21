import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, MessageCircle, Send, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  changer_profile?: { display_name: string | null };
}

interface Comment {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_profile?: { display_name: string | null };
}

interface TaskDetailsDialogProps {
  taskId: string | null;
  taskTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  todo: "До виконання",
  in_progress: "В процесі",
  done: "Виконано",
  problematic: "Проблемні",
};

const statusColors: Record<string, string> = {
  todo: "bg-slate-600 text-white",
  in_progress: "bg-blue-700 text-white",
  done: "bg-emerald-600 text-white",
  problematic: "bg-red-600 text-white",
};

export const TaskDetailsDialog = ({ taskId, taskTitle, isOpen, onClose }: TaskDetailsDialogProps) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!taskId) return;
    setLoading(true);

    try {
      // Fetch status history
      const { data: historyData, error: historyError } = await supabase
        .from("task_status_history")
        .select("*")
        .eq("task_id", taskId)
        .order("changed_at", { ascending: true });

      if (historyError) throw historyError;

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      // Get unique user IDs
      const userIds = [
        ...new Set([
          ...(historyData || []).map(h => h.changed_by),
          ...(commentsData || []).map(c => c.user_id)
        ])
      ];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setHistory((historyData || []).map(h => ({
        ...h,
        changer_profile: profilesMap.get(h.changed_by)
      })));

      setComments((commentsData || []).map(c => ({
        ...c,
        user_profile: profilesMap.get(c.user_id)
      })));

    } catch (error) {
      console.error("Error fetching task details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchData();
    }
  }, [isOpen, taskId]);

  // Subscribe to comments realtime
  useEffect(() => {
    if (!isOpen || !taskId) return;

    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        async (payload) => {
          const newComment = payload.new as Comment;
          
          // Fetch profile for new comment
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .eq("user_id", newComment.user_id)
            .maybeSingle();

          setComments(prev => [...prev, {
            ...newComment,
            user_profile: profile || undefined
          }]);

          // Scroll to bottom
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, taskId]);

  const sendComment = async () => {
    if (!newComment.trim() || !taskId || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        user_id: user.id,
        message: newComment.trim()
      });

      if (error) throw error;
      setNewComment("");
    } catch (error) {
      console.error("Error sending comment:", error);
      toast({ title: "Помилка", description: "Не вдалося надіслати коментар", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendComment();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">{taskTitle}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="comments" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="comments" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Коментарі ({comments.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Історія ({history.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="mt-4">
            <div className="flex flex-col h-[400px]">
              <ScrollArea className="flex-1 pr-4">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <span className="text-muted-foreground">Завантаження...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <span className="text-muted-foreground">Немає коментарів</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => {
                      const isOwn = comment.user_id === user?.id;
                      return (
                        <div
                          key={comment.id}
                          className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {comment.user_profile?.display_name || "Невідомий"}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              {format(new Date(comment.created_at), "dd.MM HH:mm", { locale: uk })}
                            </span>
                          </div>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{comment.message}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={scrollRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Напишіть коментар..."
                  disabled={sending}
                  className="flex-1"
                />
                <Button onClick={sendComment} disabled={sending || !newComment.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-muted-foreground">Завантаження...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-muted-foreground">Немає історії змін</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {item.changer_profile?.display_name || "Невідомий"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.changed_at), "dd.MM.yyyy HH:mm", { locale: uk })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.old_status && (
                            <>
                              <Badge className={`text-xs ${statusColors[item.old_status]}`}>
                                {statusLabels[item.old_status]}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge className={`text-xs ${statusColors[item.new_status]}`}>
                            {statusLabels[item.new_status]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
