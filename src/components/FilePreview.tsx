import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { inlineLocalImages } from "@/lib/inlineAssets";
import { useState, useEffect, useRef, forwardRef } from "react";
import { ImageIcon, Check } from "lucide-react";

interface FilePreviewProps {
  file: GeneratedFile;
  cssFile?: GeneratedFile;
  allFiles?: GeneratedFile[];
  websiteType?: string;
  viewMode: "preview" | "code";
}

// Build a standalone HTML that runs the React app in-browser
function buildReactPreviewHtml(files: GeneratedFile[]): string {
  // Find key files
  const globalCss = files.find(f => f.path.includes("global.css") || f.path.includes("index.css"));
  const appFile = files.find(f => f.path.endsWith("App.js") || f.path.endsWith("App.jsx"));
  const indexHtml = files.find(f => f.path.endsWith("index.html"));
  
  // Get all JS/JSX files except index.js
  const jsFiles = files.filter(f => 
    (f.path.endsWith(".js") || f.path.endsWith(".jsx")) && 
    !f.path.includes("index.js") &&
    !f.path.includes("reportWebVitals")
  );

  // Extract title from index.html
  let title = "React Preview";
  if (indexHtml) {
    const titleMatch = indexHtml.content.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) title = titleMatch[1];
  }

  // Helper to extract component name from file path
  const getComponentName = (path: string): string => {
    const fileName = path.split("/").pop() || "";
    return fileName.replace(/\.(js|jsx)$/, "");
  };

  // Process a single file: remove imports/exports, make component global
  const processFile = (file: GeneratedFile): string => {
    let content = file.content;
    const componentName = getComponentName(file.path);
    
    // Remove all import statements (multi-line and single-line)
    content = content.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '');
    content = content.replace(/import\s+['"][^'"]+['"];?\s*/g, '');
    
    // Handle "export default function ComponentName"
    content = content.replace(
      /export\s+default\s+function\s+(\w+)/g, 
      (_, name) => `window.${name} = function ${name}`
    );
    
    // Handle "export default ComponentName"
    content = content.replace(
      /export\s+default\s+(\w+)\s*;?/g,
      (_, name) => `window.${name} = ${name};`
    );
    
    // Handle "export function ComponentName"
    content = content.replace(
      /export\s+function\s+(\w+)/g,
      (_, name) => `window.${name} = function ${name}`
    );
    
    // Handle "export const ComponentName"
    content = content.replace(
      /export\s+const\s+(\w+)/g,
      (_, name) => `window.${name} = window.${name} || {}; const ${name}`
    );
    
    // If component wasn't exported but defined as function, make it global
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

  // Sort files: components first, then pages, then App
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
    // React hooks and utilities
    const { 
      useState, useEffect, useRef, useCallback, useMemo, 
      createContext, useContext, useLayoutEffect, Fragment 
    } = React;
    
    // Mock react-router-dom
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
      
      // Return first matching or last (usually 404)
      const notFound = childArray.find(c => c.props?.path === '*');
      return notFound?.props?.element || null;
    };
    window.Routes = Routes;
    
    const Route = ({ path, element }) => null; // Handled by Routes
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

    // Component code
    ${processedCode}
    
    // Render App
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

// Script to track image loading and report to parent
const IMAGE_TRACKING_SCRIPT = `
<script>
(function() {
  function trackImages() {
    const images = document.querySelectorAll('img');
    const total = images.length;
    let loaded = 0;
    
    if (total === 0) {
      window.parent.postMessage({ type: 'image-progress', loaded: 0, total: 0, done: true }, '*');
      return;
    }
    
    window.parent.postMessage({ type: 'image-progress', loaded: 0, total: total, done: false }, '*');
    
    images.forEach(function(img) {
      if (img.complete && img.naturalHeight !== 0) {
        loaded++;
        window.parent.postMessage({ type: 'image-progress', loaded: loaded, total: total, done: loaded === total }, '*');
      } else {
        img.addEventListener('load', function() {
          loaded++;
          window.parent.postMessage({ type: 'image-progress', loaded: loaded, total: total, done: loaded === total }, '*');
        });
        img.addEventListener('error', function() {
          loaded++;
          window.parent.postMessage({ type: 'image-progress', loaded: loaded, total: total, done: loaded === total }, '*');
        });
      }
    });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackImages);
  } else {
    trackImages();
  }
})();
</script>
`;

export const FilePreview = forwardRef<HTMLDivElement, FilePreviewProps>(function FilePreview({ file, cssFile, allFiles, websiteType, viewMode }, ref) {
  const [imageProgress, setImageProgress] = useState({ loaded: 0, total: 0, done: true });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const isHtml = file.path.endsWith(".html");
  const isReact = websiteType === "react";
  const canPreview = isHtml || isReact;

  // Listen for image progress messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'image-progress') {
        setImageProgress({
          loaded: event.data.loaded,
          total: event.data.total,
          done: event.data.done
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Reset progress when content changes
  useEffect(() => {
    setImageProgress({ loaded: 0, total: 0, done: true });
  }, [file, allFiles]);

  const getPreviewContent = () => {
    // For React projects, build a standalone HTML preview
    if (isReact && allFiles && allFiles.length > 0) {
      let html = buildReactPreviewHtml(allFiles);
      // Inject tracking script before </body>
      html = html.replace('</body>', IMAGE_TRACKING_SCRIPT + '</body>');
      return html;
    }
    
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

    // Fix local SVGs (icons) referenced from HTML
    if (allFiles && allFiles.length > 0) {
      html = inlineLocalImages(html, allFiles);
    }
    
    // Inject tracking script before </body>
    if (html.includes("</body>")) {
      html = html.replace("</body>", IMAGE_TRACKING_SCRIPT + "</body>");
    } else {
      html = html + IMAGE_TRACKING_SCRIPT;
    }

    return html;
  };

  if (viewMode === "code" || !canPreview) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-sm font-medium">{file.path}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <ScrollArea className="h-full w-full rounded-md border">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
              {file.content}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = imageProgress.total > 0 
    ? Math.round((imageProgress.loaded / imageProgress.total) * 100) 
    : 100;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-sm font-medium">
            Превью: {isReact ? "React App" : file.path}
          </CardTitle>
          
          {imageProgress.total > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {imageProgress.done ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  <span>{imageProgress.total} фото</span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-3.5 w-3.5 animate-pulse" />
                  <span>{imageProgress.loaded}/{imageProgress.total}</span>
                  <Progress value={progressPercent} className="w-16 h-1.5" />
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="rounded-md border overflow-hidden bg-white h-full">
          <iframe
            ref={iframeRef}
            srcDoc={getPreviewContent()}
            className="w-full h-full"
            title={`Preview of ${file.path}`}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </CardContent>
    </Card>
  );
});

FilePreview.displayName = "FilePreview";
