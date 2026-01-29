import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, User, Bot, Crown, Zap, X, Clock, MousePointer2, Undo2, ImagePlus, Check, RefreshCw } from "lucide-react";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  isAnalysis?: boolean;
  analysisActions?: {
    onImplement: () => void;
    onRegenerate: () => void;
  };
}

interface SelectedElement {
  tag: string;
  classes: string[];
  id: string | null;
  text: string;
  selector: string;
}

interface EditChatProps {
  generationId: string;
  files: GeneratedFile[];
  aiModel: "junior" | "senior";
  websiteType: "html" | "react";
  originalPrompt: string;
  onFilesUpdate: (files: GeneratedFile[], description?: string) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  currentPage?: string;
  isSelectMode: boolean;
  setIsSelectMode: (mode: boolean) => void;
  selectedElements: SelectedElement[];
  clearSelectedElements: () => void;
  removeSelectedElement: (index: number) => void;
  canUndo: boolean;
  onUndo: () => void;
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
  isSelectMode,
  setIsSelectMode,
  selectedElements,
  clearSelectedElements,
  removeSelectedElement,
  canUndo,
  onUndo,
}: EditChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState<"junior" | "senior">(initialAiModel);
  const [progressText, setProgressText] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setIsAnalyzing(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Запит скасовано." },
    ]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Файл занадто великий",
        description: "Максимальний розмір 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Ctrl+V paste for images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "Файл занадто великий",
            description: "Максимум 5MB",
            variant: "destructive",
          });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          setUploadedImage(reader.result as string);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  // Handle drag-and-drop for images
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Файл занадто великий",
        description: "Максимум 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the element itself, not a child
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyzeScreenshot = async () => {
    if (!uploadedImage) return;

    setIsAnalyzing(true);
    const userDescription = input.trim();
    
    // Add user message with image
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userDescription || "Проаналізуй цей скріншот",
        imageUrl: uploadedImage,
      },
    ]);
    setInput("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Не авторизовано");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-screenshot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageBase64: uploadedImage,
            description: userDescription,
            currentFiles: files,
            websiteType,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.analysis) {
        setPendingAnalysis(data.analysis);
        
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.analysis,
            isAnalysis: true,
          },
        ]);
      } else {
        throw new Error(data.error || "Не вдалося проаналізувати");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      const errorMessage = error instanceof Error ? error.message : "Невідома помилка";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Помилка аналізу: ${errorMessage}` },
      ]);
      toast({
        title: "Помилка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      clearUploadedImage();
    }
  };

  const handleImplementAnalysis = async () => {
    if (!pendingAnalysis) return;
    
    // Use the analysis as the edit request
    setInput(`На основі аналізу скріншоту, виправ наступні проблеми:\n${pendingAnalysis}`);
    setPendingAnalysis(null);
    
    // Trigger send after state update
    setTimeout(() => {
      const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement;
      sendButton?.click();
    }, 100);
  };

  const handleRegenerateAnalysis = () => {
    setPendingAnalysis(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Завантажте новий скріншот для повторного аналізу." },
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || isEditing) return;

    const userMessage = input.trim();
    
    // Build context-enriched message if elements are selected
    let enrichedMessage = userMessage;
    if (selectedElements.length > 0) {
      const elementsDescription = selectedElements.map((el, i) => {
        const desc = [
          `<${el.tag}>`,
          el.id ? `#${el.id}` : null,
          el.classes.length > 0 ? `.${el.classes.slice(0, 2).join(".")}` : null,
          el.text ? `"${el.text.slice(0, 40)}${el.text.length > 40 ? "..." : ""}"` : null,
        ].filter(Boolean).join(" ");
        return `${i + 1}. ${desc} [${el.selector}]`;
      }).join("\n");
      
      enrichedMessage = `[Вибрані елементи (${selectedElements.length}):\n${elementsDescription}]\n\n${userMessage}`;
    }

    setInput("");
    clearSelectedElements();
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
            editRequest: enrichedMessage,
            currentFiles: files,
            aiModel: selectedAiModel,
            websiteType,
            originalPrompt,
            currentPage: currentPage || "index.html",
            selectedElements: selectedElements.length > 0 ? selectedElements : undefined,
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
        // Pass the user message as description for history
        onFilesUpdate(data.files, userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : ""));
        
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
              <p className="text-sm">Опиши зміни або Ctrl+V скрін</p>
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
                {/* Show image if present */}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Скріншот"
                    className="max-w-full max-h-[200px] rounded-md mb-2 object-contain"
                  />
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                
                {/* Action buttons for analysis messages */}
                {msg.isAnalysis && pendingAnalysis && idx === messages.length - 1 && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button
                      size="sm"
                      onClick={handleImplementAnalysis}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Впровадити
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerateAnalysis}
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Новий аналіз
                    </Button>
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {(isEditing || isAnalyzing) && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    {isAnalyzing ? "Аналізую скріншот..." : (progressText || "Редагую сайт...")}
                  </span>
                </div>
                {!isAnalyzing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(elapsedTime)}</span>
                  </div>
                )}
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
      <div className="p-4 border-t space-y-3">
        {/* Selected elements indicator */}
        {selectedElements.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary flex items-center gap-1">
                <MousePointer2 className="h-3 w-3" />
                Вибрано: {selectedElements.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs px-1.5"
                onClick={clearSelectedElements}
              >
                Очистити все
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
              {selectedElements.map((el, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs"
                >
                  <span className="font-mono text-primary">&lt;{el.tag}&gt;</span>
                  {el.text && (
                    <span className="text-muted-foreground truncate max-w-[100px]">
                      "{el.text.slice(0, 20)}{el.text.length > 20 ? "..." : ""}"
                    </span>
                  )}
                  <button
                    onClick={() => removeSelectedElement(idx)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uploaded image preview */}
        {uploadedImage && (
          <div className="relative inline-block">
            <img
              src={uploadedImage}
              alt="Скріншот для аналізу"
              className="max-h-[100px] rounded-md border"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
              onClick={clearUploadedImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant={isSelectMode ? "default" : "outline"}
              size="icon"
              className="h-[29px] w-[44px]"
              onClick={() => setIsSelectMode(!isSelectMode)}
              disabled={isEditing || isAnalyzing}
              title={isSelectMode ? "Вийти з режиму вибору" : "Вибрати елемент на сторінці"}
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-[29px] w-[44px]"
              onClick={onUndo}
              disabled={isEditing || isAnalyzing || !canUndo}
              title="Відкат до попередньої версії"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Image upload button */}
          <div className="flex flex-col gap-1 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              variant={uploadedImage ? "default" : "outline"}
              size="icon"
              className="h-[60px] w-[44px]"
              onClick={() => fileInputRef.current?.click()}
              disabled={isEditing || isAnalyzing}
              title="Завантажити скріншот для аналізу"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </div>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            placeholder={
              isDraggingOver
                ? "📷 Відпусти щоб завантажити"
                : uploadedImage
                  ? "Опиши проблему..."
                  : selectedElements.length > 0
                    ? `Що зробити з ${selectedElements.length} ел.?`
                    : "Зміни / Ctrl+V / перетягни скрін"
            }
            className={`min-h-[60px] max-h-[120px] resize-none transition-all duration-200 ${
              isDraggingOver 
                ? "border-2 border-dashed border-primary bg-primary/5 ring-2 ring-primary/20" 
                : ""
            }`}
            disabled={isEditing || isAnalyzing}
          />
          
          {/* Send or Analyze button */}
          {uploadedImage ? (
            <Button
              onClick={handleAnalyzeScreenshot}
              disabled={isAnalyzing}
              size="icon"
              className="h-[60px] w-[60px] bg-amber-500 hover:bg-amber-600"
              title="Проаналізувати скріншот"
            >
              {isAnalyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </Button>
          ) : (
            <Button
              data-send-button
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
          )}
        </div>

        {isSelectMode && (
          <p className="text-xs text-center text-muted-foreground animate-pulse">
            Клікніть на елемент у превʼю щоб вибрати його
          </p>
        )}
      </div>
    </div>
  );
}
