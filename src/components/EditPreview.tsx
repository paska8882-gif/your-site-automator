import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Code, FileCode, FileText, File, ChevronRight, ChevronDown, Folder, FolderOpen, Maximize2, Minimize2 } from "lucide-react";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { cn } from "@/lib/utils";

interface EditPreviewProps {
  files: GeneratedFile[];
  selectedFile: GeneratedFile | null;
  onSelectFile: (file: GeneratedFile) => void;
}

function getFileIcon(path: string) {
  const fileName = path.split("/").pop() || path;
  if (fileName.endsWith(".html")) return <FileCode className="h-4 w-4 text-orange-500" />;
  if (fileName.endsWith(".css")) return <FileCode className="h-4 w-4 text-blue-500" />;
  if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) return <FileCode className="h-4 w-4 text-yellow-500" />;
  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return <FileCode className="h-4 w-4 text-blue-400" />;
  if (fileName.endsWith(".json")) return <FileText className="h-4 w-4 text-green-500" />;
  if (fileName.endsWith(".toml") || fileName.endsWith(".txt") || fileName.endsWith(".md")) return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  file?: GeneratedFile;
}

function buildFileTree(files: GeneratedFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        currentLevel.push(existing);
      }

      if (!isLast) {
        currentLevel = existing.children;
      }
    }
  }

  // Sort: folders first, then alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  return sortNodes(root);
}

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (file: GeneratedFile) => void;
}

function FileTreeNode({ node, depth, selectedPath, expandedFolders, onToggleFolder, onSelectFile }: FileTreeNodeProps) {
  const isExpanded = expandedFolders.has(node.path);

  if (node.isFolder) {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="w-full flex items-center gap-1 px-2 py-1 rounded-md text-sm text-left transition-colors hover:bg-muted"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-blue-400 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && (
          <div className="animate-accordion-down">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => node.file && onSelectFile(node.file)}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm text-left transition-colors",
        selectedPath === node.path
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-foreground"
      )}
      style={{ paddingLeft: `${20 + depth * 12}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function EditPreview({ files, selectedFile, onSelectFile }: EditPreviewProps) {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const folders = new Set<string>();
    files.forEach((file) => {
      const parts = file.path.split("/");
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join("/"));
      }
    });
    return folders;
  });

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getCssFile = () => {
    return files.find((f) => f.path === "styles.css" || f.path.endsWith("/styles.css"));
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

  // Fullscreen modal
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 text-sm">
            {selectedFile && getFileIcon(selectedFile.path)}
            <span className="font-medium">{selectedFile?.path || "No file selected"}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)}>
            <Minimize2 className="h-4 w-4 mr-1" />
            Вийти з повноекранного
          </Button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {/* File sidebar in fullscreen */}
          <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
            <div className="p-3 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Сторінки</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="py-2">
                {fileTree.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={selectedFile?.path || null}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    onSelectFile={onSelectFile}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
          {/* Preview area */}
          <div className="flex-1">
            <iframe
              srcDoc={getPreviewContent()}
              className="w-full h-full border-0 bg-white"
              title={`Fullscreen preview of ${selectedFile?.path}`}
              sandbox="allow-scripts"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* File sidebar */}
      <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Files</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-2">
            {fileTree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedFile?.path || null}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 text-sm">
            {selectedFile && getFileIcon(selectedFile.path)}
            <span className="font-medium">{selectedFile?.path || "No file selected"}</span>
          </div>
          <div className="flex gap-1">
            {canPreview && viewMode === "preview" && (
              <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
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
