import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, User, Bot, Crown, Zap } from "lucide-react";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EditChatProps {
  generationId: string;
  files: GeneratedFile[];
  aiModel: "junior" | "senior";
  websiteType: "html" | "react";
  originalPrompt: string;
  onFilesUpdate: (files: GeneratedFile[]) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

export function EditChat({
  generationId,
  files,
  aiModel: initialAiModel,
  websiteType,
  originalPrompt,
  onFilesUpdate,
  isEditing,
  setIsEditing,
}: EditChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState<"junior" | "senior">(initialAiModel);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isEditing) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsEditing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Потрібна авторизація");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-website`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            generationId,
            editRequest: userMessage,
            currentFiles: files,
            aiModel: selectedAiModel,
            websiteType,
            originalPrompt,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.files) {
        onFilesUpdate(data.files);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message || "Готово! Зміни застосовано.",
          },
        ]);

        toast({
          title: "Успішно",
          description: "Сайт оновлено",
        });
      } else {
        throw new Error(data.error || "Невідома помилка");
      }
    } catch (error) {
      console.error("Edit error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Помилка: ${error instanceof Error ? error.message : "Невідома помилка"}`,
        },
      ]);
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Невідома помилка",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2">
          <Select 
            value={selectedAiModel} 
            onValueChange={(v) => setSelectedAiModel(v as "junior" | "senior")}
            disabled={isEditing}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="senior">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Senior AI
                </div>
              </SelectItem>
              <SelectItem value="junior">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  Junior AI
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {websiteType === "react" ? "React" : "HTML/CSS"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Опишіть які зміни потрібно внести в сайт</p>
              <p className="text-xs mt-1">
                Наприклад: "Зміни колір кнопок на синій", "Додай секцію FAQ"
              </p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`rounded-lg px-4 py-2 max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {isEditing && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Редагую сайт...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Опишіть зміни..."
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isEditing}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isEditing}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {isEditing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
