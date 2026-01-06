import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileCode, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Home,
  X,
  ChevronLeft,
  ChevronRight,
  Link2,
  Link2Off,
  Monitor,
  Smartphone,
  Tablet
} from "lucide-react";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { 
  emulatePhpPage, 
  getPhpPages, 
  checkAllLinks, 
  LinkCheckResult, 
  PhpPreviewResult 
} from "@/lib/phpEmulator";

interface PhpPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: GeneratedFile[];
  siteName?: string;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportSize, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "375px", label: "Mobile" },
};

export function PhpPreviewDialog({ open, onOpenChange, files, siteName }: PhpPreviewDialogProps) {
  const [currentPage, setCurrentPage] = useState("index.php");
  const [previewResult, setPreviewResult] = useState<PhpPreviewResult | null>(null);
  const [allLinks, setAllLinks] = useState<LinkCheckResult[]>([]);
  const [history, setHistory] = useState<string[]>(["index.php"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [activeTab, setActiveTab] = useState<"preview" | "links">("preview");

  const pages = getPhpPages(files);
  const brokenLinksCount = allLinks.filter(l => !l.exists && !l.isExternal).length;

  // Check all links on mount
  useEffect(() => {
    if (open && files.length > 0) {
      const links = checkAllLinks(files);
      setAllLinks(links);
    }
  }, [open, files]);

  // Emulate current page
  useEffect(() => {
    if (open && files.length > 0) {
      const result = emulatePhpPage(currentPage, files);
      setPreviewResult(result);
    }
  }, [open, files, currentPage]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentPage("index.php");
      setHistory(["index.php"]);
      setHistoryIndex(0);
      setActiveTab("preview");
    }
  }, [open]);

  const navigateTo = useCallback((path: string) => {
    const normalizedPath = path.replace(/^\.\//, "").replace(/^\//, "");
    
    // Check if page exists
    const pageExists = pages.some(p => p.path === normalizedPath);
    if (!pageExists) return;

    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(normalizedPath);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPage(normalizedPath);
  }, [history, historyIndex, pages]);

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentPage(history[historyIndex - 1]);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentPage(history[historyIndex + 1]);
    }
  };

  // Handle clicks inside iframe to navigate between pages
  const handleIframeLoad = useCallback((iframe: HTMLIFrameElement | null) => {
    if (!iframe) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLAnchorElement;
      if (target.tagName === "A" && target.href) {
        const href = target.getAttribute("href");
        if (href && href.endsWith(".php") && !href.startsWith("http")) {
          e.preventDefault();
          navigateTo(href);
        }
      }
    };

    try {
      iframe.contentDocument?.addEventListener("click", handleClick);
    } catch {
      // Cross-origin error, ignore
    }
  }, [navigateTo]);

  const getIframeContent = () => {
    if (!previewResult) return "";

    // Inject a base style and click handler
    let html = previewResult.html;

    // Add base tag to handle relative URLs
    if (!html.includes("<base")) {
      html = html.replace("<head>", `<head><base href=".">`);
    }

    // Add script to intercept link clicks
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

  // Listen for navigation messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "php-navigate" && e.data.href) {
        navigateTo(e.data.href);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigateTo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg">
                PHP Превью: {siteName || "Сайт"}
              </DialogTitle>
              {brokenLinksCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <Link2Off className="h-3 w-3" />
                  {brokenLinksCount} битих посилань
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar with pages */}
          <div className="w-56 border-r flex flex-col shrink-0">
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm mb-2">Сторінки ({pages.length})</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {pages.map((page) => {
                  const pageLinks = allLinks.filter(l => l.sourceFile === page.path);
                  const hasBroken = pageLinks.some(l => !l.exists && !l.isExternal);
                  
                  return (
                    <button
                      key={page.path}
                      onClick={() => navigateTo(page.path)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                        currentPage === page.path 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-muted"
                      }`}
                    >
                      {page.path === "index.php" ? (
                        <Home className="h-4 w-4 shrink-0" />
                      ) : (
                        <FileCode className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate flex-1">{page.path}</span>
                      {hasBroken && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={goBack}
                  disabled={historyIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={goForward}
                  disabled={historyIndex >= history.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-background rounded border text-sm">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">/</span>
                <span>{currentPage}</span>
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

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "preview" | "links")}>
                <TabsList className="h-8">
                  <TabsTrigger value="preview" className="text-xs px-3 h-7">Превью</TabsTrigger>
                  <TabsTrigger value="links" className="text-xs px-3 h-7 gap-1">
                    Посилання
                    {brokenLinksCount > 0 && (
                      <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                        {brokenLinksCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Content area */}
            <div className="flex-1 min-h-0 p-4 bg-muted/20">
              {activeTab === "preview" ? (
                <div 
                  className="h-full flex justify-center bg-background rounded-lg border overflow-hidden"
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
                      ref={handleIframeLoad}
                      srcDoc={getIframeContent()}
                      className="w-full h-full"
                      title={`PHP Preview: ${currentPage}`}
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-full bg-background rounded-lg border">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Перевірка посилань</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          {allLinks.filter(l => l.exists).length} ок
                        </span>
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          {brokenLinksCount} битих
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ExternalLink className="h-4 w-4" />
                          {allLinks.filter(l => l.isExternal).length} зовнішніх
                        </span>
                      </div>
                    </div>

                    {brokenLinksCount > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-destructive">Биті посилання:</h4>
                        {allLinks
                          .filter(l => !l.exists && !l.isExternal)
                          .map((link, i) => (
                            <div 
                              key={i} 
                              className="flex items-center gap-3 p-2 bg-destructive/10 rounded text-sm"
                            >
                              <Link2Off className="h-4 w-4 text-destructive shrink-0" />
                              <span className="font-mono">{link.href}</span>
                              <span className="text-muted-foreground">у файлі</span>
                              <button
                                onClick={() => navigateTo(link.sourceFile)}
                                className="text-primary hover:underline"
                              >
                                {link.sourceFile}
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Всі внутрішні посилання:</h4>
                      <div className="grid gap-1">
                        {allLinks
                          .filter(l => !l.isExternal)
                          .map((link, i) => (
                            <div 
                              key={i} 
                              className={`flex items-center gap-3 p-2 rounded text-sm ${
                                link.exists ? "bg-muted/50" : "bg-destructive/10"
                              }`}
                            >
                              {link.exists ? (
                                <Link2 className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <Link2Off className="h-4 w-4 text-destructive shrink-0" />
                              )}
                              <span className="font-mono flex-1 truncate">{link.href}</span>
                              <span className="text-muted-foreground text-xs">
                                з {link.sourceFile}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Status bar */}
            {previewResult && previewResult.warnings.length > 0 && (
              <div className="px-4 py-2 border-t bg-yellow-50 dark:bg-yellow-950/20 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                {previewResult.warnings.join(", ")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
