import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditChat } from "@/components/EditChat";
import { EditPreview } from "@/components/EditPreview";
import { BlockedUserOverlay } from "@/components/BlockedUserOverlay";
import { GeneratedFile } from "@/lib/websiteGenerator";

interface GenerationData {
  id: string;
  number: number;
  prompt: string;
  language: string;
  files_data: GeneratedFile[] | null;
  ai_model: string | null;
  website_type: string | null;
  status: string;
}

interface SelectedElement {
  tag: string;
  classes: string[];
  id: string | null;
  text: string;
  selector: string;
}

const Edit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isBlocked } = useAuth();
  const [generation, setGeneration] = useState<GenerationData | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);

  const handleElementSelected = (element: SelectedElement) => {
    setSelectedElements(prev => {
      // Check if element already selected (by selector)
      const existingIndex = prev.findIndex(el => el.selector === element.selector);
      if (existingIndex >= 0) {
        // Remove if already selected
        return prev.filter((_, i) => i !== existingIndex);
      }
      // Add new element
      return [...prev, element];
    });
    // Don't exit select mode - allow multi-selection
  };

  const clearSelectedElements = () => {
    setSelectedElements([]);
  };

  const removeSelectedElement = (index: number) => {
    setSelectedElements(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);


  useEffect(() => {
    if (!id || !user) return;

    const fetchGeneration = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("generation_history")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("Error fetching generation:", error);
        navigate("/");
        return;
      }

      const typedData: GenerationData = {
        ...data,
        files_data: data.files_data as unknown as GeneratedFile[] | null,
      };

      setGeneration(typedData);
      if (typedData.files_data) {
        setFiles(typedData.files_data);
        const indexFile = typedData.files_data.find(f => f.path === "index.html");
        setSelectedFile(indexFile || typedData.files_data[0]);
      }
      setIsLoading(false);
    };

    fetchGeneration();
  }, [id, user, navigate]);

  const handleFilesUpdate = (newFiles: GeneratedFile[]) => {
    setFiles(newFiles);
    // Update selected file if it was modified
    if (selectedFile) {
      const updatedSelected = newFiles.find(f => f.path === selectedFile.path);
      if (updatedSelected) {
        setSelectedFile(updatedSelected);
      }
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!generation) {
    return null;
  }

  return (
    <>
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <div className="h-4 w-px bg-border" />
            <span className="font-medium">
              Редагування #{generation.number}
            </span>
            <span className="text-sm text-muted-foreground hidden sm:block">
              {generation.language.toUpperCase()}
            </span>
          </div>
          {isEditing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Редагування...
            </div>
          )}
        </div>

        {/* Main content - split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat panel */}
          <div className="w-[400px] border-r flex flex-col shrink-0">
            <EditChat
              generationId={id!}
              files={files}
              aiModel={(generation.ai_model as "junior" | "senior") || "senior"}
              websiteType={(generation.website_type as "html" | "react") || "html"}
              originalPrompt={generation.prompt}
              onFilesUpdate={handleFilesUpdate}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              currentPage={selectedFile?.path || "index.html"}
              isSelectMode={isSelectMode}
              setIsSelectMode={setIsSelectMode}
              selectedElements={selectedElements}
              clearSelectedElements={clearSelectedElements}
              removeSelectedElement={removeSelectedElement}
            />
          </div>

          {/* Preview panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <EditPreview
              files={files}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              onFilesUpdate={handleFilesUpdate}
              websiteType={generation.website_type || undefined}
              isSelectMode={isSelectMode}
              onElementSelected={handleElementSelected}
            />
          </div>
        </div>
      </div>
      {isBlocked && <BlockedUserOverlay />}
    </>
  );
};

export default Edit;
