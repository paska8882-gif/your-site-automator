import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Check, Mail, MailOpen } from "lucide-react";
import { format } from "date-fns";
import { uk, ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface Feedback {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  user_email?: string;
}

export function AdminFeedbackTab() {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  
  const dateLocale = language === "ru" ? ru : uk;

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user emails
      const userIds = [...new Set(data?.map(f => f.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const emailMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setFeedback(
        (data || []).map(f => ({
          ...f,
          user_email: emailMap.get(f.user_id) || t("admin.feedbackUnknown"),
        }))
      );
    } catch (error) {
      console.error("Error fetching feedback:", error);
      toast({
        title: t("common.error"),
        description: t("admin.feedbackError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const toggleRead = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("feedback")
        .update({ is_read: !currentState })
        .eq("id", id);

      if (error) throw error;

      setFeedback(prev =>
        prev.map(f => (f.id === id ? { ...f, is_read: !currentState } : f))
      );
    } catch (error) {
      console.error("Error updating feedback:", error);
      toast({
        title: t("common.error"),
        description: t("admin.feedbackUpdateError"),
        variant: "destructive",
      });
    }
  };

  const deleteFeedback = async (id: string) => {
    try {
      const { error } = await supabase.from("feedback").delete().eq("id", id);

      if (error) throw error;

      setFeedback(prev => prev.filter(f => f.id !== id));
      toast({ title: t("admin.feedbackDeleteSuccess") });
    } catch (error) {
      console.error("Error deleting feedback:", error);
      toast({
        title: t("common.error"),
        description: t("admin.feedbackDeleteError"),
        variant: "destructive",
      });
    }
  };

  const unreadCount = feedback.filter(f => !f.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t("admin.feedbackTitle")}{" "}
          {unreadCount > 0 && (
            <span className="text-sm text-muted-foreground">
              ({unreadCount} {t("admin.feedbackNew")})
            </span>
          )}
        </h2>
        <Button variant="outline" size="sm" onClick={fetchFeedback}>
          {t("admin.feedbackRefresh")}
        </Button>
      </div>

      {feedback.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("admin.feedbackEmpty")}
        </div>
      ) : (
        <div className="space-y-2">
          {feedback.map(f => (
            <div
              key={f.id}
              className={`border rounded-lg p-3 ${
                f.is_read ? "bg-muted/30" : "bg-background border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span className="font-medium">{f.user_email}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(f.created_at), "dd MMM yyyy, HH:mm", {
                        locale: dateLocale,
                      })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{f.message}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleRead(f.id, f.is_read)}
                    title={f.is_read ? t("admin.feedbackMarkUnread") : t("admin.feedbackMarkRead")}
                  >
                    {f.is_read ? (
                      <MailOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Mail className="h-3.5 w-3.5 text-primary" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteFeedback(f.id)}
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
