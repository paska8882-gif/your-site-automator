import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteEditor } from "@/components/SiteEditor";
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

const Edit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isBlocked } = useAuth();
  const [generation, setGeneration] = useState<GenerationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      setIsLoading(false);
    };

    fetchGeneration();
  }, [id, user, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!generation || !generation.files_data) {
    return null;
  }

  const headerContent = (
    <div className="border-b px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => navigate("/history")}>
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
    </div>
  );

  return (
    <>
      <div className="h-screen flex flex-col bg-background">
        <SiteEditor
          generationId={id!}
          initialFiles={generation.files_data}
          aiModel={(generation.ai_model as "junior" | "senior") || "senior"}
          websiteType={(generation.website_type as "html" | "react") || "html"}
          originalPrompt={generation.prompt}
          header={headerContent}
        />
      </div>
      {isBlocked && <BlockedUserOverlay />}
    </>
  );
};

export default Edit;
