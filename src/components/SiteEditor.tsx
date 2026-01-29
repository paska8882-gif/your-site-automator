import { useState, useCallback, useEffect } from "react";
import { EditChat } from "@/components/EditChat";
import { EditPreview } from "@/components/EditPreview";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SelectedElement {
  tag: string;
  classes: string[];
  id: string | null;
  text: string;
  selector: string;
}

interface HistoryEntry {
  files: GeneratedFile[];
  timestamp: number;
  description: string;
}

interface SiteEditorProps {
  generationId: string;
  initialFiles: GeneratedFile[];
  aiModel: "junior" | "senior";
  websiteType: "html" | "react";
  originalPrompt: string;
  onFilesChange?: (files: GeneratedFile[]) => void;
  header?: React.ReactNode;
  className?: string;
}

const MAX_HISTORY = 10;

export function SiteEditor({
  generationId,
  initialFiles,
  aiModel,
  websiteType,
  originalPrompt,
  onFilesChange,
  header,
  className = "",
}: SiteEditorProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<GeneratedFile[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  
  // History state for undo functionality
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Initialize selected file
  useEffect(() => {
    if (initialFiles.length > 0 && !selectedFile) {
      const indexFile = initialFiles.find(f => f.path === "index.html");
      setSelectedFile(indexFile || initialFiles[0]);
    }
  }, [initialFiles, selectedFile]);

  // Sync files when initialFiles change
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const handleElementSelected = (element: SelectedElement) => {
    setSelectedElements(prev => {
      const existingIndex = prev.findIndex(el => el.selector === element.selector);
      if (existingIndex >= 0) {
        return prev.filter((_, i) => i !== existingIndex);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, element];
    });
  };

  const clearSelectedElements = () => {
    setSelectedElements([]);
  };

  const removeSelectedElement = (index: number) => {
    setSelectedElements(prev => prev.filter((_, i) => i !== index));
  };

  // Save current state to history before update
  const saveToHistory = useCallback((currentFiles: GeneratedFile[], description: string) => {
    setHistory(prev => {
      const newEntry: HistoryEntry = {
        files: currentFiles,
        timestamp: Date.now(),
        description,
      };
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY);
      return updated;
    });
    setCanUndo(true);
  }, []);

  // Undo to previous state
  const handleUndo = useCallback(async () => {
    if (history.length === 0) return;

    const [lastState, ...remaining] = history;
    
    // Restore files
    setFiles(lastState.files);
    onFilesChange?.(lastState.files);
    
    // Update selected file
    if (selectedFile) {
      const updatedSelected = lastState.files.find(f => f.path === selectedFile.path);
      if (updatedSelected) {
        setSelectedFile(updatedSelected);
      }
    }

    // Save to database
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      lastState.files.forEach((file) => zip.file(file.path, file.content));
      const zipBase64 = await zip.generateAsync({ type: "base64" });

      await supabase
        .from("generation_history")
        .update({
          files_data: JSON.parse(JSON.stringify(lastState.files)),
          zip_data: zipBase64,
        })
        .eq("id", generationId);

      toast({
        title: "Відкат виконано",
        description: `Повернено до: ${lastState.description}`,
      });
    } catch (error) {
      console.error("Undo save error:", error);
      toast({
        title: "Помилка збереження",
        description: "Стан відновлено локально, але не збережено в базу",
        variant: "destructive",
      });
    }

    setHistory(remaining);
    setCanUndo(remaining.length > 0);
  }, [history, selectedFile, generationId, toast, onFilesChange]);

  const handleFilesUpdate = useCallback((newFiles: GeneratedFile[], description?: string) => {
    // Save current state to history before applying new changes
    if (files.length > 0) {
      saveToHistory(files, description || "Попередня версія");
    }
    
    setFiles(newFiles);
    onFilesChange?.(newFiles);
    
    // Update selected file if it was modified
    if (selectedFile) {
      const updatedSelected = newFiles.find(f => f.path === selectedFile.path);
      if (updatedSelected) {
        setSelectedFile(updatedSelected);
      }
    }
  }, [files, selectedFile, saveToHistory, onFilesChange]);

  if (initialFiles.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {header}
      
      {/* Main content - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="w-[400px] border-r flex flex-col shrink-0">
          <EditChat
            generationId={generationId}
            files={files}
            aiModel={aiModel}
            websiteType={websiteType}
            originalPrompt={originalPrompt}
            onFilesUpdate={handleFilesUpdate}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            currentPage={selectedFile?.path || "index.html"}
            isSelectMode={isSelectMode}
            setIsSelectMode={setIsSelectMode}
            selectedElements={selectedElements}
            clearSelectedElements={clearSelectedElements}
            removeSelectedElement={removeSelectedElement}
            canUndo={canUndo}
            onUndo={handleUndo}
          />
        </div>

        {/* Preview panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditPreview
            files={files}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            onFilesUpdate={handleFilesUpdate}
            websiteType={websiteType}
            isSelectMode={isSelectMode}
            onElementSelected={handleElementSelected}
            selectedElements={selectedElements}
          />
        </div>
      </div>
    </div>
  );
}
