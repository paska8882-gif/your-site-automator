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
  websiteType?: string;
}

// Build a standalone HTML that runs the React app in-browser
function buildReactPreviewHtml(files: GeneratedFile[]): string {
  const globalCss = files.find(f => f.path.includes("global.css") || f.path.includes("index.css"));
  const indexHtml = files.find(f => f.path.endsWith("index.html"));
  
  const jsFiles = files.filter(f => 
    (f.path.endsWith(".js") || f.path.endsWith(".jsx")) && 
    !f.path.includes("index.js") &&
    !f.path.includes("reportWebVitals")
  );

  let title = "React Preview";
  if (indexHtml) {
    const titleMatch = indexHtml.content.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) title = titleMatch[1];
  }

  const getComponentName = (path: string): string => {
    const fileName = path.split("/").pop() || "";
    return fileName.replace(/\.(js|jsx)$/, "");
  };

  const processFile = (file: GeneratedFile): string => {
    let content = file.content;
    const componentName = getComponentName(file.path);
    
    content = content.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '');
    content = content.replace(/import\s+['"][^'"]+['"];?\s*/g, '');
    
    content = content.replace(
      /export\s+default\s+function\s+(\w+)/g, 
      (_, name) => `window.${name} = function ${name}`
    );
    
    content = content.replace(
      /export\s+default\s+(\w+)\s*;?/g,
      (_, name) => `window.${name} = ${name};`
    );
    
    content = content.replace(
      /export\s+function\s+(\w+)/g,
      (_, name) => `window.${name} = function ${name}`
    );
    
    content = content.replace(
      /export\s+const\s+(\w+)/g,
      (_, name) => `window.${name} = window.${name} || {}; const ${name}`
    );
    
    if (!content.includes(`window.${componentName}`)) {
      content = content.replace(
        new RegExp(`function\\s+${componentName}\\s*\\(`),
        `window.${componentName} = function ${componentName}(`
      );
      content = content.replace(
        new RegExp(`const\\s+${componentName}\\s*=\\s*\\(`),
        `window.${componentName} = (`
      );
    }
    
    return `// === ${file.path} ===\n${content}`;
  };

  const sortedFiles = [...jsFiles].sort((a, b) => {
    const aIsApp = a.path.includes("App.");
    const bIsApp = b.path.includes("App.");
    const aIsComponent = a.path.includes("/components/");
    const bIsComponent = b.path.includes("/components/");
    
    if (aIsApp) return 1;
    if (bIsApp) return -1;
    if (aIsComponent && !bIsComponent) return -1;
    if (!aIsComponent && bIsComponent) return 1;
    return 0;
  });

  const processedCode = sortedFiles.map(processFile).join('\n\n');

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
  <style>
    ${globalCss?.content || '* { margin: 0; padding: 0; box-sizing: border-box; }'}
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script type="text/babel" data-presets="react">
    const { 
      useState, useEffect, useRef, useCallback, useMemo, 
      createContext, useContext, useLayoutEffect, Fragment 
    } = React;
    
    const RouterContext = React.createContext({ path: '/', navigate: () => {} });
    
    const BrowserRouter = ({ children }) => {
      const [path, setPath] = useState(window.location.hash.slice(1) || '/');
      
      useEffect(() => {
        const handler = () => setPath(window.location.hash.slice(1) || '/');
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
      }, []);
      
      const navigate = (to) => { window.location.hash = to; };
      
      return React.createElement(
        RouterContext.Provider, 
        { value: { path, navigate } }, 
        children
      );
    };
    window.BrowserRouter = BrowserRouter;
    
    const Routes = ({ children }) => {
      const { path } = useContext(RouterContext);
      const childArray = React.Children.toArray(children);
      
      for (const child of childArray) {
        if (child.props && child.props.path) {
          const routePath = child.props.path;
          if (routePath === path || routePath === '*' || 
              (routePath === '/' && (path === '' || path === '/')) ||
              (routePath !== '/' && path.startsWith(routePath))) {
            return child.props.element;
          }
        }
      }
      
      const notFound = childArray.find(c => c.props?.path === '*');
      return notFound?.props?.element || null;
    };
    window.Routes = Routes;
    
    const Route = ({ path, element }) => null;
    window.Route = Route;
    
    const Link = ({ to, children, className, ...props }) => {
      const { navigate } = useContext(RouterContext);
      return React.createElement('a', {
        href: '#' + to,
        className,
        onClick: (e) => { e.preventDefault(); navigate(to); },
        ...props
      }, children);
    };
    window.Link = Link;
    
    const NavLink = ({ to, children, className, ...props }) => {
      const { path } = useContext(RouterContext);
      const isActive = path === to || (to !== '/' && path.startsWith(to));
      const finalClassName = typeof className === 'function' 
        ? className({ isActive }) 
        : className + (isActive ? ' active' : '');
      return React.createElement(Link, { to, className: finalClassName, ...props }, children);
    };
    window.NavLink = NavLink;
    
    const useNavigate = () => {
      const { navigate } = useContext(RouterContext);
      return navigate;
    };
    window.useNavigate = useNavigate;
    
    const useLocation = () => {
      const { path } = useContext(RouterContext);
      return { pathname: path, search: '', hash: '' };
    };
    window.useLocation = useLocation;
    
    const useParams = () => ({});
    window.useParams = useParams;

    ${processedCode}
    
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      const AppComponent = window.App;
      if (AppComponent) {
        root.render(
          React.createElement(BrowserRouter, null,
            React.createElement(AppComponent)
          )
        );
      } else {
        document.getElementById('root').innerHTML = '<p style="padding:20px;color:red;">App component not found</p>';
      }
    } catch (err) {
      console.error('React render error:', err);
      document.getElementById('root').innerHTML = '<pre style="padding:20px;color:red;">' + err.message + '</pre>';
    }
  </script>
</body>
</html>`;
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
        <div
          onClick={() => onToggleFolder(node.path)}
          className="w-full flex items-center gap-1 px-2 py-1 rounded-md text-sm text-left transition-colors hover:bg-muted cursor-pointer"
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
        </div>
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
    <div
      onClick={() => node.file && onSelectFile(node.file)}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm text-left transition-colors cursor-pointer",
        selectedPath === node.path
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-foreground"
      )}
      style={{ paddingLeft: `${20 + depth * 12}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </div>
  );
}

export function EditPreview({ files, selectedFile, onSelectFile, websiteType }: EditPreviewProps) {
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
  const isReact = websiteType === "react";

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
    if (isReact) {
      return buildReactPreviewHtml(files);
    }
    
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

  const canPreview = isReact || selectedFile?.path.endsWith(".html");

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 text-sm">
            {selectedFile && getFileIcon(selectedFile.path)}
            <span className="font-medium">{isReact ? "React App" : (selectedFile?.path || "No file selected")}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)}>
            <Minimize2 className="h-4 w-4 mr-1" />
            Вийти з повноекранного
          </Button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
            <div className="p-3 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Файли</span>
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
          <div className="flex-1">
            <iframe
              srcDoc={getPreviewContent()}
              className="w-full h-full border-0 bg-white"
              title={`Fullscreen preview of ${selectedFile?.path}`}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 text-sm">
            {selectedFile && getFileIcon(selectedFile.path)}
            <span className="font-medium">{isReact && viewMode === "preview" ? "React App" : (selectedFile?.path || "No file selected")}</span>
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
              sandbox="allow-scripts allow-same-origin"
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
