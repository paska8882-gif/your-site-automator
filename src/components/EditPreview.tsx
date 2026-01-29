import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Code, FileCode, FileText, File, ChevronRight, ChevronDown, Folder, FolderOpen, Maximize2, Minimize2, Home, ChevronLeft, ChevronRightIcon, Monitor, Tablet, Smartphone, Pencil, Save, X, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { cn } from "@/lib/utils";
import { emulatePhpPage, getPhpPages, PhpPreviewResult } from "@/lib/phpEmulator";
import { processHtmlForPreview } from "@/lib/inlineAssets";

interface EditPreviewProps {
  files: GeneratedFile[];
  selectedFile: GeneratedFile | null;
  onSelectFile: (file: GeneratedFile) => void;
  onFilesUpdate?: (files: GeneratedFile[]) => void;
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

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportSize, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "375px", label: "Mobile" },
};

export function EditPreview({ files, selectedFile, onSelectFile, onFilesUpdate, websiteType }: EditPreviewProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"preview" | "code" | "edit">("preview");
  const [editedContent, setEditedContent] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // PHP-specific state
  const [currentPhpPage, setCurrentPhpPage] = useState("index.php");
  const [phpPreviewResult, setPhpPreviewResult] = useState<PhpPreviewResult | null>(null);
  const [phpHistory, setPhpHistory] = useState<string[]>(["index.php"]);
  const [phpHistoryIndex, setPhpHistoryIndex] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [previewKey, setPreviewKey] = useState(0);

  // Force preview refresh when files change
  const filesHash = useMemo(() => {
    return files.map(f => `${f.path}:${f.content.length}`).join('|');
  }, [files]);

  useEffect(() => {
    setPreviewKey(prev => prev + 1);
  }, [filesHash]);

  const refreshPreview = () => {
    setPreviewKey(prev => prev + 1);
    toast({
      title: "Оновлено",
      description: "Превью перезавантажено",
    });
  };

  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const isReact = websiteType === "react";
  const isPhp = websiteType === "php";
  const phpPages = useMemo(() => isPhp ? getPhpPages(files) : [], [files, isPhp]);

  // Emulate PHP page when it changes
  useEffect(() => {
    if (isPhp && files.length > 0) {
      const result = emulatePhpPage(currentPhpPage, files);
      setPhpPreviewResult(result);
    }
  }, [isPhp, files, currentPhpPage]);

  // Reset PHP state when files change
  useEffect(() => {
    if (isPhp) {
      setCurrentPhpPage("index.php");
      setPhpHistory(["index.php"]);
      setPhpHistoryIndex(0);
    }
  }, [isPhp]);

  // Sync edited content when selected file changes
  useEffect(() => {
    if (selectedFile) {
      setEditedContent(selectedFile.content);
      setHasUnsavedChanges(false);
    }
  }, [selectedFile]);

  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
    setHasUnsavedChanges(newContent !== selectedFile?.content);
  };

  const handleSaveChanges = async () => {
    if (!selectedFile || !onFilesUpdate) return;
    
    setIsSaving(true);
    try {
      const updatedFiles = files.map(f => 
        f.path === selectedFile.path 
          ? { ...f, content: editedContent }
          : f
      );
      
      // Get generation ID from URL
      const pathParts = window.location.pathname.split('/');
      const generationId = pathParts[pathParts.length - 1];
      
      if (generationId && generationId !== 'edit') {
        // Save to database
        const { error } = await supabase
          .from('generation_history')
          .update({ files_data: JSON.parse(JSON.stringify(updatedFiles)) })
          .eq('id', generationId);
        
        if (error) throw error;
      }
      
      onFilesUpdate(updatedFiles);
      setHasUnsavedChanges(false);
      
      toast({
        title: "Збережено",
        description: `Файл ${selectedFile.path} оновлено`,
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти зміни",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (selectedFile) {
      setEditedContent(selectedFile.content);
      setHasUnsavedChanges(false);
    }
  };

  const navigateToPhpPage = useCallback((path: string) => {
    const normalizedPath = path.replace(/^\.\//, "").replace(/^\//, "");
    const pageExists = phpPages.some(p => p.path === normalizedPath);
    if (!pageExists) return;

    const newHistory = phpHistory.slice(0, phpHistoryIndex + 1);
    newHistory.push(normalizedPath);
    setPhpHistory(newHistory);
    setPhpHistoryIndex(newHistory.length - 1);
    setCurrentPhpPage(normalizedPath);
  }, [phpHistory, phpHistoryIndex, phpPages]);

  const goBackPhp = () => {
    if (phpHistoryIndex > 0) {
      setPhpHistoryIndex(phpHistoryIndex - 1);
      setCurrentPhpPage(phpHistory[phpHistoryIndex - 1]);
    }
  };

  const goForwardPhp = () => {
    if (phpHistoryIndex < phpHistory.length - 1) {
      setPhpHistoryIndex(phpHistoryIndex + 1);
      setCurrentPhpPage(phpHistory[phpHistoryIndex + 1]);
    }
  };

  // Listen for PHP navigation messages from iframe
  useEffect(() => {
    if (!isPhp) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "php-navigate" && e.data.href) {
        navigateToPhpPage(e.data.href);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isPhp, navigateToPhpPage]);

  // Listen for HTML navigation messages from iframe
  useEffect(() => {
    if (isPhp || isReact) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "preview-navigate" && e.data.page) {
        const targetPage = e.data.page;
        
        // Find the file and select it
        const targetFile = files.find(f => f.path === targetPage);
        
        if (targetFile) {
          onSelectFile(targetFile);
        } else {
          console.warn(`[EditPreview] Page not found: ${targetPage}`);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [files, isPhp, isReact, onSelectFile]);

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

  const getPhpIframeContent = () => {
    if (!phpPreviewResult) return "";

    let html = phpPreviewResult.html;

    // Add click handler to intercept PHP link clicks
    const clickHandler = `
      <script>
        document.addEventListener('click', function(e) {
          var target = e.target;
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          if (target && target.href) {
            var href = target.getAttribute('href');
            if (href && href.endsWith('.php') && !href.startsWith('http')) {
              e.preventDefault();
              window.parent.postMessage({ type: 'php-navigate', href: href }, '*');
            }
          }
        });
      </script>
    `;

    if (html.includes("</body>")) {
      html = html.replace("</body>", clickHandler + "</body>");
    } else {
      html += clickHandler;
    }

    return html;
  };

  const getPreviewContent = () => {
    if (isReact) {
      return buildReactPreviewHtml(files);
    }

    if (isPhp) {
      return getPhpIframeContent();
    }
    
    if (!selectedFile) return "";
    if (!selectedFile.path.endsWith(".html")) return selectedFile.content;

    // Use full processing pipeline for HTML
    let html = processHtmlForPreview(selectedFile.content, files);
    
    // Build list of available HTML pages
    const availablePages = files
      .filter(f => f.path.endsWith('.html'))
      .map(f => f.path.replace(/^\.\//, '').replace(/^\//, ''));

    // Add navigation handler for HTML links
    const navigationScript = `
      <script data-preview-nav>
        (function() {
          var availablePages = ${JSON.stringify(availablePages)};
          
          function normalizePath(href) {
            if (!href) return '';
            return href
              .replace(/^\\.\\//g, '')
              .replace(/^\\//, '')
              .replace(/\\?.*$/, '')
              .replace(/#.*$/, '')
              .toLowerCase();
          }
          
          function findPage(href) {
            var normalized = normalizePath(href);
            
            for (var i = 0; i < availablePages.length; i++) {
              if (availablePages[i].toLowerCase() === normalized) {
                return availablePages[i];
              }
            }
            
            if (!normalized.endsWith('.html') && !normalized.endsWith('.htm')) {
              var withHtml = normalized + '.html';
              for (var i = 0; i < availablePages.length; i++) {
                if (availablePages[i].toLowerCase() === withHtml) {
                  return availablePages[i];
                }
              }
            }
            
            var fileName = normalized.split('/').pop();
            for (var i = 0; i < availablePages.length; i++) {
              var pageName = availablePages[i].split('/').pop().toLowerCase();
              if (pageName === fileName || pageName === fileName + '.html') {
                return availablePages[i];
              }
            }
            
            return null;
          }
          
          document.addEventListener('click', function(e) {
            var target = e.target;
            while (target && target.tagName !== 'A') {
              target = target.parentElement;
            }
            
            if (!target) return;
            
            var href = target.getAttribute('href');
            if (!href) return;
            
            if (href.startsWith('http://') || 
                href.startsWith('https://') || 
                href.startsWith('//') ||
                href.startsWith('#') ||
                href.startsWith('tel:') ||
                href.startsWith('mailto:') ||
                href.startsWith('javascript:')) {
              return;
            }
            
            var page = findPage(href);
            
            if (page) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              
              console.log('[EditPreview Nav] Navigating to:', page);
              window.parent.postMessage({ type: 'preview-navigate', page: page }, '*');
            }
          }, true);
          
          document.querySelectorAll('img').forEach(function(img, i) {
            img.onerror = function() {
              if (!this.dataset.fixed) {
                this.dataset.fixed = 'true';
                this.src = 'https://picsum.photos/seed/edit' + i + '/800/600';
              }
            };
          });
          
          console.log('[EditPreview Nav] Initialized with pages:', availablePages);
        })();
      </script>
    `;

    if (html.includes("</body>")) {
      html = html.replace("</body>", navigationScript + "</body>");
    } else {
      html += navigationScript;
    }

    return html;
  };

  const canPreview = isReact || isPhp || selectedFile?.path.endsWith(".html");

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 text-sm">
            {selectedFile && getFileIcon(selectedFile.path)}
            <span className="font-medium">
              {isReact ? "React App" : isPhp ? `PHP: ${currentPhpPage}` : (selectedFile?.path || "No file selected")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* PHP navigation in fullscreen */}
            {isPhp && (
              <>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={goBackPhp}
                    disabled={phpHistoryIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={goForwardPhp}
                    disabled={phpHistoryIndex >= phpHistory.length - 1}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center border rounded overflow-hidden">
                  {(Object.entries(VIEWPORT_SIZES) as [ViewportSize, typeof VIEWPORT_SIZES.desktop][]).map(([key, value]) => (
                    <Button
                      key={key}
                      variant={viewport === key ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => setViewport(key)}
                      title={value.label}
                    >
                      {key === "desktop" && <Monitor className="h-4 w-4" />}
                      {key === "tablet" && <Tablet className="h-4 w-4" />}
                      {key === "mobile" && <Smartphone className="h-4 w-4" />}
                    </Button>
                  ))}
                </div>

                <div className="h-4 w-px bg-border" />
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="h-4 w-4 mr-1" />
              Вийти з повноекранного
            </Button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {/* PHP Pages sidebar */}
          {isPhp ? (
            <div className="w-56 border-r bg-muted/30 flex flex-col shrink-0">
              <div className="p-3 border-b">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Сторінки ({phpPages.length})
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {phpPages.map((page) => (
                    <button
                      key={page.path}
                      onClick={() => navigateToPhpPage(page.path)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                        currentPhpPage === page.path 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-muted"
                      )}
                    >
                      {page.path === "index.php" ? (
                        <Home className="h-4 w-4 shrink-0" />
                      ) : (
                        <FileCode className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate flex-1">{page.path}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
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
          )}
          <div className="flex-1 bg-muted/30">
            {isPhp ? (
              <div 
                className="h-full flex justify-center"
                style={{ padding: viewport !== "desktop" ? "16px" : 0 }}
              >
                <div 
                  className="h-full bg-white rounded overflow-hidden transition-all duration-300"
                  style={{ 
                    width: VIEWPORT_SIZES[viewport].width,
                    maxWidth: "100%",
                    boxShadow: viewport !== "desktop" ? "0 4px 20px rgba(0,0,0,0.15)" : "none"
                  }}
                >
                  <iframe
                    key={`fs-php-${previewKey}`}
                    srcDoc={getPreviewContent()}
                    className="w-full h-full border-0"
                    title={`Fullscreen PHP preview: ${currentPhpPage}`}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </div>
            ) : (
              <iframe
                key={`fs-html-${previewKey}`}
                srcDoc={getPreviewContent()}
                className="w-full h-full border-0 bg-white"
                title={`Fullscreen preview of ${selectedFile?.path}`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* PHP Toolbar with navigation */}
        {isPhp && viewMode === "preview" && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={goBackPhp}
                disabled={phpHistoryIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={goForwardPhp}
                disabled={phpHistoryIndex >= phpHistory.length - 1}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-background rounded border text-sm max-w-md">
              <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">/</span>
              <span className="truncate">{currentPhpPage}</span>
            </div>

            <div className="flex items-center border rounded overflow-hidden">
              {(Object.entries(VIEWPORT_SIZES) as [ViewportSize, typeof VIEWPORT_SIZES.desktop][]).map(([key, value]) => (
                <Button
                  key={key}
                  variant={viewport === key ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none"
                  onClick={() => setViewport(key)}
                  title={value.label}
                >
                  {key === "desktop" && <Monitor className="h-4 w-4" />}
                  {key === "tablet" && <Tablet className="h-4 w-4" />}
                  {key === "mobile" && <Smartphone className="h-4 w-4" />}
                </Button>
              ))}
            </div>

            {/* PHP Pages quick nav */}
            <div className="flex items-center gap-1 ml-2">
              {phpPages.slice(0, 5).map((page) => (
                <Button
                  key={page.path}
                  variant={currentPhpPage === page.path ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigateToPhpPage(page.path)}
                >
                  {page.path === "index.php" ? (
                    <Home className="h-3 w-3" />
                  ) : (
                    page.path.replace(".php", "")
                  )}
                </Button>
              ))}
              {phpPages.length > 5 && (
                <span className="text-xs text-muted-foreground">+{phpPages.length - 5}</span>
              )}
            </div>
          </div>
        )}

        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 text-sm">
            {selectedFile && getFileIcon(selectedFile.path)}
            <span className="font-medium">
              {isReact && viewMode === "preview" 
                ? "React App" 
                : isPhp && viewMode === "preview"
                  ? `PHP: ${currentPhpPage}`
                  : (selectedFile?.path || "No file selected")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasUnsavedChanges && viewMode === "edit" && (
              <div className="flex items-center gap-1 mr-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? "Збереження..." : "Зберегти"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscardChanges}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Скасувати
                </Button>
              </div>
            )}
            {canPreview && viewMode === "preview" && (
              <>
                <Button variant="ghost" size="sm" onClick={refreshPreview} title="Оновити превью">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </>
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
            {onFilesUpdate && (
              <Button
                variant={viewMode === "edit" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("edit")}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Редагувати
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {viewMode === "preview" && canPreview ? (
            isPhp ? (
              <div 
                className="h-full flex justify-center bg-muted/30"
                style={{ padding: viewport !== "desktop" ? "16px" : 0 }}
              >
                <div 
                  className="h-full bg-white rounded overflow-hidden transition-all duration-300"
                  style={{ 
                    width: VIEWPORT_SIZES[viewport].width,
                    maxWidth: "100%",
                    boxShadow: viewport !== "desktop" ? "0 4px 20px rgba(0,0,0,0.15)" : "none"
                  }}
                >
                  <iframe
                    key={`php-${previewKey}`}
                    srcDoc={getPreviewContent()}
                    className="w-full h-full border-0"
                    title={`PHP Preview: ${currentPhpPage}`}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </div>
            ) : (
              <iframe
                key={`html-${previewKey}`}
                srcDoc={getPreviewContent()}
                className="w-full h-full border-0 bg-white"
                title={`Preview of ${selectedFile?.path}`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            )
          ) : viewMode === "edit" ? (
            <div className="h-full flex flex-col">
              <Textarea
                value={editedContent}
                onChange={(e) => handleContentChange(e.target.value)}
                className="flex-1 font-mono text-sm rounded-none border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Виберіть файл для редагування..."
                spellCheck={false}
              />
              {hasUnsavedChanges && (
                <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <span>● Є незбережені зміни</span>
                </div>
              )}
            </div>
          ) : (
            <ScrollArea className="h-full">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                {selectedFile?.content || "No file selected"}
              </pre>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Files panel - now on the right side */}
      <div className="w-56 border-l bg-muted/30 flex flex-col shrink-0">
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
    </div>
  );
}
