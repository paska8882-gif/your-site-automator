import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Code, FileCode, FileText, File, ChevronRight } from "lucide-react";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { cn } from "@/lib/utils";

interface EditPreviewProps {
  files: GeneratedFile[];
  selectedFile: GeneratedFile | null;
  onSelectFile: (file: GeneratedFile) => void;
}

function getFileIcon(path: string) {
  if (path.endsWith(".html")) return <FileCode className="h-4 w-4 text-orange-500" />;
  if (path.endsWith(".css")) return <FileCode className="h-4 w-4 text-blue-500" />;
  if (path.endsWith(".js") || path.endsWith(".jsx")) return <FileCode className="h-4 w-4 text-yellow-500" />;
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return <FileCode className="h-4 w-4 text-blue-400" />;
  if (path.endsWith(".json")) return <FileText className="h-4 w-4 text-green-500" />;
  if (path.endsWith(".toml") || path.endsWith(".txt")) return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export function EditPreview({ files, selectedFile, onSelectFile }: EditPreviewProps) {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const getCssFile = () => {
    return files.find((f) => f.path === "styles.css");
  };

  const getPreviewContent = () => {
    if (!selectedFile) return "";
    if (!selectedFile.path.endsWith(".html")) return selectedFile.content;

    let html = selectedFile.content;
    const cssFile = getCssFile();

    if (cssFile) {
      const styleTag = `<style>${cssFile.content}</style>`;
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${styleTag}</head>`);
      } else if (html.includes("<body")) {
        html = html.replace("<body", `${styleTag}<body`);
      } else {
        html = styleTag + html;
      }
    }

    return html;
  };

  const canPreview = selectedFile?.path.endsWith(".html");

  return (
    <div className="flex h-full">
      {/* File sidebar */}
      <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Files</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => onSelectFile(file)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors",
                  selectedFile?.path === file.path
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {getFileIcon(file.path)}
                <span className="truncate">{file.path}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with file name and view toggle */}
        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 text-sm">
            {selectedFile && getFileIcon(selectedFile.path)}
            <span className="font-medium">{selectedFile?.path || "No file selected"}</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "preview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("preview")}
              disabled={!canPreview}
            >
              <Eye className="h-4 w-4 mr-1" />
              Превью
            </Button>
            <Button
              variant={viewMode === "code" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("code")}
            >
              <Code className="h-4 w-4 mr-1" />
              Код
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "preview" && canPreview ? (
            <iframe
              srcDoc={getPreviewContent()}
              className="w-full h-full border-0 bg-white"
              title={`Preview of ${selectedFile?.path}`}
              sandbox="allow-scripts"
            />
          ) : (
            <ScrollArea className="h-full">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                {selectedFile?.content || "No file selected"}
              </pre>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}