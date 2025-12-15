import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Code } from "lucide-react";
import { GeneratedFile } from "@/lib/websiteGenerator";

interface EditPreviewProps {
  files: GeneratedFile[];
  selectedFile: GeneratedFile | null;
  onSelectFile: (file: GeneratedFile) => void;
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
    <div className="flex flex-col h-full">
      {/* File tabs */}
      <div className="border-b p-2 flex items-center justify-between shrink-0 overflow-x-auto">
        <div className="flex gap-1">
          {files.map((file) => (
            <Button
              key={file.path}
              variant={selectedFile?.path === file.path ? "default" : "ghost"}
              size="sm"
              onClick={() => onSelectFile(file)}
              className="shrink-0"
            >
              {file.path}
            </Button>
          ))}
        </div>
        <div className="flex gap-1 ml-4">
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
  );
}
