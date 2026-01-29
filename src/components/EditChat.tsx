import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, User, Bot, Crown, Zap, X, Clock } from "lucide-react";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  currentPage?: string;
}

const PROGRESS_STAGES = [
  { time: 0, text: "Аналізую запит..." },
  { time: 3000, text: "Вибираю релевантні файли..." },
  { time: 6000, text: "Редагую код..." },
  { time: 15000, text: "AI обробляє зміни..." },
  { time: 30000, text: "Це займає більше часу, ніж зазвичай..." },
  { time: 60000, text: "Все ще працюю... Складний запит." },
];

export function EditChat({
  generationId,
  files,
  aiModel: initialAiModel,
  websiteType,
  originalPrompt,
  onFilesUpdate,
  isEditing,
  setIsEditing,
  currentPage,
}: EditChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState<"junior" | "senior">(initialAiModel);
  const [progressText, setProgressText] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  // Load messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`edit-chat-${generationId}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {}
    }
  }, [generationId]);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`edit-chat-${generationId}`, JSON.stringify(messages));
    }
  }, [messages, generationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Progress and elapsed time tracking
  useEffect(() => {
    if (isEditing) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      
      // Update elapsed time every second
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedTime(elapsed);
        
        // Update progress text based on elapsed time
        const stage = [...PROGRESS_STAGES].reverse().find(s => elapsed >= s.time);
        if (stage) {
          setProgressText(stage.text);
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setProgressText("");
      setElapsedTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isEditing]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsEditing(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Запит скасовано." },
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || isEditing) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsEditing(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Потрібна авторизація");
      }

      // Client-side timeout (150 seconds)
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, 150000);

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
            currentPage: currentPage || "index.html",
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.files) {
        onFilesUpdate(data.files);
        
        const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
        
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${data.message || "Готово! Зміни застосовано."}\n⏱️ Час: ${timeSpent}с`,
          },
        ]);

        toast({
          title: "Успішно",
          description: `Сайт оновлено за ${timeSpent}с`,
        });
      } else {
        throw new Error(data.error || "Невідома помилка");
      }
    } catch (error) {
      console.error("Edit error:", error);
      
      let errorMessage = "Невідома помилка";
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "Запит скасовано або час очікування вичерпано";
        } else {
          errorMessage = error.message;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Помилка: ${errorMessage}`,
        },
      ]);
      toast({
        title: "Помилка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      abortControllerRef.current = null;
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}с`;
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
              <div className="bg-muted rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{progressText || "Редагую сайт..."}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(elapsedTime)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3 mr-1" />
                  Скасувати
                </Button>
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
