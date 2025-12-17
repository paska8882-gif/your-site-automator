import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, Loader2 } from "lucide-react";

interface UserOption {
  user_id: string;
  display_name: string | null;
}

export const AdminNotificationsManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .order("display_name");

        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setFetchingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const sendNotification = async () => {
    if (!selectedUserId || !title.trim() || !message.trim()) {
      toast({
        title: "Помилка",
        description: "Заповніть всі поля",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: selectedUserId,
        title: title.trim(),
        message: message.trim(),
        type: "admin_message",
      });

      if (error) throw error;

      toast({
        title: "Успішно",
        description: "Сповіщення надіслано",
      });

      setTitle("");
      setMessage("");
      setSelectedUserId("");
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося надіслати сповіщення",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendToAll = async () => {
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Помилка",
        description: "Заповніть заголовок та повідомлення",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const notifications = users.map((user) => ({
        user_id: user.user_id,
        title: title.trim(),
        message: message.trim(),
        type: "admin_broadcast",
      }));

      const { error } = await supabase.from("notifications").insert(notifications);

      if (error) throw error;

      toast({
        title: "Успішно",
        description: `Сповіщення надіслано ${users.length} користувачам`,
      });

      setTitle("");
      setMessage("");
    } catch (error) {
      console.error("Error sending broadcast:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося надіслати сповіщення",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Bell className="h-4 w-4" />
          Надіслати сповіщення
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Користувач</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={fetchingUsers ? "Завантаження..." : "Виберіть користувача"} />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.user_id} value={user.user_id} className="text-xs">
                  {user.display_name || "Без імені"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Заголовок</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок сповіщення"
            className="h-8 text-xs"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Повідомлення</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Текст сповіщення"
            className="text-xs min-h-[80px]"
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={sendNotification}
            disabled={loading || !selectedUserId}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Send className="h-3 w-3 mr-1" />
            )}
            Надіслати
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={sendToAll}
            disabled={loading}
          >
            Всім користувачам
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
