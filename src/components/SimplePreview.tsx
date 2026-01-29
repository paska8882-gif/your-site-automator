import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import { processHtmlForPreview } from "@/lib/inlineAssets";

interface GeneratedFile {
  path: string;
  content: string;
}

interface SimplePreviewProps {
  files: GeneratedFile[];
  websiteType?: string;
}

// ========== REACT PREVIEW BUILDER ==========

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

// ========== HTML PREVIEW BUILDER ==========

function buildHtmlPreview(files: GeneratedFile[], currentPage: string): string {
  // Find the requested page or fallback to index.html
  const htmlFile = files.find(f => f.path === currentPage) || 
                   files.find(f => f.path === "index.html") ||
                   files.find(f => f.path.endsWith(".html"));
  
  if (!htmlFile) return "";
  
  // Process HTML with full pipeline
  let html = processHtmlForPreview(htmlFile.content, files);

  // Build list of available pages for validation
  const availablePages = files
    .filter(f => f.path.endsWith('.html'))
    .map(f => f.path.replace(/^\.\//, '').replace(/^\//, ''));

  // Add navigation handler script to intercept link clicks
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
          
          // Direct match
          for (var i = 0; i < availablePages.length; i++) {
            if (availablePages[i].toLowerCase() === normalized) {
              return availablePages[i];
            }
          }
          
          // Try adding .html
          if (!normalized.endsWith('.html') && !normalized.endsWith('.htm')) {
            var withHtml = normalized + '.html';
            for (var i = 0; i < availablePages.length; i++) {
              if (availablePages[i].toLowerCase() === withHtml) {
                return availablePages[i];
              }
            }
          }
          
          // Try filename only match
          var fileName = normalized.split('/').pop();
          for (var i = 0; i < availablePages.length; i++) {
            var pageName = availablePages[i].split('/').pop().toLowerCase();
            if (pageName === fileName || pageName === fileName + '.html') {
              return availablePages[i];
            }
          }
          
          return null;
        }
        
        // Intercept all clicks
        document.addEventListener('click', function(e) {
          var target = e.target;
          
          // Walk up to find anchor tag
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          
          if (!target) return;
          
          var href = target.getAttribute('href');
          if (!href) return;
          
          // Skip external, anchors, special protocols
          if (href.startsWith('http://') || 
              href.startsWith('https://') || 
              href.startsWith('//') ||
              href.startsWith('#') ||
              href.startsWith('tel:') ||
              href.startsWith('mailto:') ||
              href.startsWith('javascript:')) {
            return;
          }
          
          // Try to find the page
          var page = findPage(href);
          
          if (page) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log('[Preview Nav] Navigating to:', page);
            
            window.parent.postMessage({ 
              type: 'preview-navigate', 
              page: page 
            }, '*');
          }
        }, true);
        
        // Handle form submissions
        document.addEventListener('submit', function(e) {
          e.preventDefault();
          console.log('[Preview] Form submission prevented');
        }, true);
        
        // Fix broken images
        document.querySelectorAll('img').forEach(function(img, i) {
          img.onerror = function() {
            if (!this.dataset.fixed) {
              this.dataset.fixed = 'true';
              this.src = 'https://picsum.photos/seed/img' + i + '/800/600';
            }
          };
          if (img.complete && img.naturalHeight === 0) {
            img.onerror();
          }
        });
        
        console.log('[Preview Nav] Initialized with pages:', availablePages);
      })();
    </script>
  `;

  // Inject before </body> or at the end
  if (html.includes("</body>")) {
    html = html.replace("</body>", navigationScript + "</body>");
  } else {
    html += navigationScript;
  }

  return html;
}

// ========== MAIN COMPONENT ==========

function SimplePreviewInner({ files, websiteType }: SimplePreviewProps) {
  const isReact = websiteType === "react";
  const [currentPage, setCurrentPage] = useState("index.html");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Build list of HTML pages for navigation validation
  const htmlPages = useMemo(() => {
    return files
      .filter(f => f.path.endsWith('.html'))
      .map(f => f.path);
  }, [files]);

  // Reset to index when files change
  useEffect(() => {
    setCurrentPage("index.html");
  }, [files]);

  // Listen for navigation messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "preview-navigate" && e.data.page) {
        const targetPage = e.data.page;
        console.log('[SimplePreview] Navigation request:', targetPage);
        
        // Validate the page exists
        if (htmlPages.includes(targetPage)) {
          setCurrentPage(targetPage);
        } else {
          console.warn(`[SimplePreview] Page not found: ${targetPage}. Available: ${htmlPages.join(', ')}`);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [htmlPages]);

  // Generate preview content with memoization
  const previewContent = useMemo(() => {
    if (isReact) {
      return buildReactPreviewHtml(files);
    }
    return buildHtmlPreview(files, currentPage);
  }, [files, isReact, currentPage]);

  // Use Blob URL for better performance with large content
  useEffect(() => {
    // Clean up previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!previewContent) return;

    // For large content (>50KB), use Blob URL for better performance
    if (previewContent.length > 50000) {
      const blob = new Blob([previewContent], { type: 'text/html;charset=utf-8' });
      blobUrlRef.current = URL.createObjectURL(blob);
      
      if (iframeRef.current) {
        iframeRef.current.src = blobUrlRef.current;
      }
    }

    // Cleanup on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [previewContent]);

  // For smaller content, use srcDoc (faster initial load)
  const useBlobUrl = previewContent.length > 50000;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={useBlobUrl ? undefined : previewContent}
      className="w-full h-full border-0 bg-white"
      title="Website preview"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
    />
  );
}

// Memoize to prevent unnecessary re-renders
export const SimplePreview = memo(SimplePreviewInner);
