import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GeneratedFile } from "@/lib/websiteGenerator";

interface FilePreviewProps {
  file: GeneratedFile;
  cssFile?: GeneratedFile;
  viewMode: "preview" | "code";
}

export function FilePreview({ file, cssFile, viewMode }: FilePreviewProps) {
  const isHtml = file.path.endsWith(".html");
  const canPreview = isHtml;

  const getPreviewContent = () => {
    if (!isHtml) return file.content;

    let html = file.content;
    
    // Inject CSS if available
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

  if (viewMode === "code" || !canPreview) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{file.path}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] w-full rounded-md border">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
              {file.content}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Превью: {file.path}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden bg-white">
          <iframe
            srcDoc={getPreviewContent()}
            className="w-full h-[500px]"
            title={`Preview of ${file.path}`}
            sandbox="allow-scripts"
          />
        </div>
      </CardContent>
    </Card>
  );
}
