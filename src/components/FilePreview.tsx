import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GeneratedFile } from "@/lib/websiteGenerator";

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
  const appJs = files.find(f => f.path.endsWith("App.js") || f.path.endsWith("App.jsx"));
  const indexHtml = files.find(f => f.path.endsWith("index.html"));
  
  // Get all component files
  const componentFiles = files.filter(f => 
    (f.path.endsWith(".js") || f.path.endsWith(".jsx")) && 
    !f.path.includes("index.js") &&
    !f.path.includes("reportWebVitals")
  );

  // Extract title from index.html if available
  let title = "React Preview";
  if (indexHtml) {
    const titleMatch = indexHtml.content.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) title = titleMatch[1];
  }

  // Process components to remove imports/exports and make them global
  const processedComponents: string[] = [];
  
  for (const file of componentFiles) {
    let content = file.content;
    
    // Remove import statements
    content = content.replace(/^import\s+.*?;?\s*$/gm, '');
    content = content.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
    
    // Convert export default to window assignment
    const defaultExportMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (defaultExportMatch) {
      const componentName = defaultExportMatch[1];
      content = content.replace(/export\s+default\s+(?:function\s+)?(\w+)/, `window.${componentName} = $1`);
    }
    
    // Convert named exports
    content = content.replace(/export\s+(?:const|function|class)\s+(\w+)/g, 'window.$1 = $1; const $1');
    
    processedComponents.push(`// ${file.path}\n${content}`);
  }

  // Process App.js specially
  let appContent = appJs?.content || '';
  appContent = appContent.replace(/^import\s+.*?;?\s*$/gm, '');
  appContent = appContent.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  appContent = appContent.replace(/export\s+default\s+(?:function\s+)?App/, 'window.App = App; function App');
  
  // Simple mock for react-router-dom
  const routerMock = `
    window.BrowserRouter = ({ children }) => children;
    window.Routes = ({ children }) => {
      const [path, setPath] = React.useState(window.location.hash.slice(1) || '/');
      React.useEffect(() => {
        const handler = () => setPath(window.location.hash.slice(1) || '/');
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
      }, []);
      window.__currentPath = path;
      return children;
    };
    window.Route = ({ path, element }) => {
      if (window.__currentPath === path || (path === '/' && !window.__currentPath)) {
        return element;
      }
      return null;
    };
    window.Link = ({ to, children, className }) => {
      return React.createElement('a', { 
        href: '#' + to, 
        className,
        onClick: (e) => { window.location.hash = to; }
      }, children);
    };
    window.NavLink = window.Link;
    window.useNavigate = () => (path) => { window.location.hash = path; };
    window.useParams = () => ({});
    window.useLocation = () => ({ pathname: window.__currentPath || '/' });
  `;

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    ${globalCss?.content || ''}
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;
    
    ${routerMock}
    
    ${processedComponents.join('\n\n')}
    
    // App component
    ${appContent}
    
    // Render
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(window.App || App));
  </script>
</body>
</html>`;
}

export function FilePreview({ file, cssFile, allFiles, websiteType, viewMode }: FilePreviewProps) {
  const isHtml = file.path.endsWith(".html");
  const isReact = websiteType === "react";
  const canPreview = isHtml || isReact;

  const getPreviewContent = () => {
    // For React projects, build a standalone HTML preview
    if (isReact && allFiles && allFiles.length > 0) {
      return buildReactPreviewHtml(allFiles);
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
          Превью: {isReact ? "React App" : file.path}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden bg-white">
          <iframe
            srcDoc={getPreviewContent()}
            className="w-full h-[500px]"
            title={`Preview of ${file.path}`}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </CardContent>
    </Card>
  );
}
