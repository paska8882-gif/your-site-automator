import type { GeneratedFile } from "@/lib/websiteGenerator";

function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/^\.+\//, "")
    .replace(/^\//, "")
    .replace(/[#?].*$/, "");
}

function guessMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function findAssetFile(files: GeneratedFile[], src: string): GeneratedFile | null {
  const normalized = normalizePath(src);
  if (!normalized) return null;

  // Fast path: exact match
  const exact = files.find((f) => normalizePath(f.path) === normalized);
  if (exact) return exact;

  // Common folder prefixes
  const candidates = [
    `assets/${normalized}`,
    `images/${normalized}`,
    `img/${normalized}`,
    `icons/${normalized}`,
    `static/${normalized}`,
    `css/${normalized}`,
  ];
  for (const c of candidates) {
    const match = files.find((f) => normalizePath(f.path) === normalizePath(c));
    if (match) return match;
  }

  // Fuzzy match by suffix (best-effort)
  const suffix = "/" + normalized;
  return files.find((f) => normalizePath(f.path).endsWith(suffix)) || null;
}

/** Generate a stable picsum URL based on seed */
function getPlaceholderUrl(seed: number, width = 800, height = 600): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

/** Extract dimensions from common image patterns or use defaults */
function guessDimensions(context: string): { width: number; height: number } {
  // Hero/banner patterns
  if (/hero|banner|cover|full|bg/i.test(context)) {
    return { width: 1920, height: 1080 };
  }
  // Card/thumbnail patterns
  if (/card|thumb|small|icon/i.test(context)) {
    return { width: 400, height: 300 };
  }
  // Team/avatar patterns
  if (/team|avatar|profile|person/i.test(context)) {
    return { width: 400, height: 400 };
  }
  // Default
  return { width: 800, height: 600 };
}

/**
 * Inlines local <img src="..."> references when the asset exists in `files`.
 * Also replaces broken image URLs with placeholder images.
 */
export function inlineLocalImages(html: string, files: GeneratedFile[]): string {
  if (!html) return html;

  let seedCounter = 1;

  return html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
    (match, before: string, rawSrc: string, after: string) => {
      const src = rawSrc.trim();
      
      // Skip external URLs and data URIs
      if (
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("data:") ||
        src.startsWith("blob:")
      ) {
        return match;
      }

      const asset = findAssetFile(files, src);
      
      // If asset exists and is SVG, inline it
      if (asset) {
        const mime = guessMimeType(asset.path);
        if (mime === "image/svg+xml") {
          const encoded = encodeURIComponent(asset.content)
            .replace(/%0A/g, "")
            .replace(/%0D/g, "");
          const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
          return before + dataUrl + after;
        }
        // For binary formats, leave as-is (they might work if bundled)
        return match;
      }

      // Asset not found - replace with placeholder
      const dims = guessDimensions(src + " " + after);
      const placeholderUrl = getPlaceholderUrl(seedCounter++, dims.width, dims.height);
      return before + placeholderUrl + after;
    }
  );
}

/**
 * Process CSS background-image URLs and replace broken ones with placeholders
 */
export function processCssBackgrounds(css: string, files: GeneratedFile[]): string {
  if (!css) return css;

  let seedCounter = 100;

  // Match url(...) in CSS - handles both quoted and unquoted
  return css.replace(
    /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, quote, rawUrl: string) => {
      const url = rawUrl.trim();
      
      // Skip external URLs, data URIs, and gradients
      if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("data:") ||
        url.startsWith("#") ||
        url.startsWith("linear-gradient") ||
        url.startsWith("radial-gradient")
      ) {
        return match;
      }

      // Try to find the asset
      const asset = findAssetFile(files, url);
      
      if (asset) {
        const mime = guessMimeType(asset.path);
        if (mime === "image/svg+xml") {
          const encoded = encodeURIComponent(asset.content)
            .replace(/%0A/g, "")
            .replace(/%0D/g, "");
          return `url("data:image/svg+xml;charset=utf-8,${encoded}")`;
        }
        // For binary, leave as-is
        return match;
      }

      // Asset not found - use placeholder
      const dims = guessDimensions(url);
      const placeholderUrl = getPlaceholderUrl(seedCounter++, dims.width, dims.height);
      return `url("${placeholderUrl}")`;
    }
  );
}

/**
 * Inline all CSS files into the HTML and process their background images
 */
export function inlineAllCss(html: string, files: GeneratedFile[]): string {
  if (!html) return html;

  let result = html;
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  
  // Build a map of CSS file names to their content
  const cssMap = new Map<string, GeneratedFile>();
  for (const cssFile of cssFiles) {
    // Add by full path
    cssMap.set(cssFile.path, cssFile);
    // Add by filename only
    const fileName = cssFile.path.split('/').pop() || '';
    cssMap.set(fileName, cssFile);
    // Add common variants
    cssMap.set('./' + cssFile.path, cssFile);
    cssMap.set('/' + cssFile.path, cssFile);
  }

  // Find all CSS link tags and replace with inline styles
  // Match various link tag formats
  const linkRegex = /<link[^>]*(?:href\s*=\s*["']([^"']+\.css)["'])[^>]*\/?>/gi;
  
  result = result.replace(linkRegex, (match, href) => {
    if (!href) return match;
    
    // Keep external stylesheets (Bootstrap, Google Fonts, CDN, etc.)
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      return match;
    }

    // Normalize the path
    const normalizedPath = href.replace(/^\.\//, '').replace(/^\//, '');
    const fileName = normalizedPath.split('/').pop() || '';
    
    // Try to find the CSS file
    let cssFile = cssMap.get(normalizedPath) || 
                  cssMap.get(fileName) ||
                  cssMap.get('css/' + normalizedPath) ||
                  cssMap.get('css/' + fileName) ||
                  cssMap.get('assets/css/' + fileName) ||
                  cssMap.get('assets/' + fileName);
    
    // Fallback: search by suffix matching
    if (!cssFile) {
      cssFile = cssFiles.find(f => 
        f.path.endsWith('/' + normalizedPath) || 
        f.path.endsWith('/' + fileName) ||
        f.path === normalizedPath
      );
    }

    if (cssFile) {
      // Process background images in CSS
      const processedCss = processCssBackgrounds(cssFile.content, files);
      return `<style data-source="${cssFile.path}">\n${processedCss}\n</style>`;
    }

    // CSS file not found - remove the broken link
    console.warn(`[inlineAllCss] CSS file not found: ${href}`);
    return `<!-- CSS not found: ${href} -->`;
  });

  // Also inline CSS files that aren't linked but exist
  // This handles cases where PHP includes didn't pick up the link tags
  const hasInlinedCss = result.includes('data-source=');
  if (!hasInlinedCss && cssFiles.length > 0) {
    // No CSS was inlined, inject all CSS files before </head>
    let allCssStyles = '';
    for (const cssFile of cssFiles) {
      const processedCss = processCssBackgrounds(cssFile.content, files);
      allCssStyles += `<style data-source="${cssFile.path}">\n${processedCss}\n</style>\n`;
    }
    
    if (result.includes('</head>')) {
      result = result.replace('</head>', allCssStyles + '</head>');
    } else if (result.includes('<body')) {
      result = result.replace(/<body/i, allCssStyles + '<body');
    } else {
      result = allCssStyles + result;
    }
  }

  return result;
}

/**
 * Inject external resources (Google Fonts, Font Awesome, etc.)
 */
export function injectExternalResources(html: string): string {
  if (!html) return html;

  // Check if we need to add Google Fonts
  const needsGoogleFonts = /font-family\s*:[^;]*(Roboto|Open Sans|Lato|Montserrat|Poppins|Inter|Raleway|Nunito)/i.test(html);
  
  // Check if we need Font Awesome
  const needsFontAwesome = /<i\s+class\s*=\s*["'][^"']*fa[srlbd]?\s/i.test(html) || 
                           /class\s*=\s*["'][^"']*fa-[a-z]/i.test(html);

  let injections = '';

  if (needsGoogleFonts) {
    injections += `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
`;
  }

  if (needsFontAwesome) {
    injections += `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
`;
  }

  if (injections) {
    // Insert after <head> tag
    const headMatch = html.match(/<head[^>]*>/i);
    if (headMatch) {
      const insertPos = headMatch.index! + headMatch[0].length;
      return html.slice(0, insertPos) + '\n' + injections + html.slice(insertPos);
    }
  }

  return html;
}

/**
 * Add base styles for consistent rendering in preview
 * NOTE: Cookie banner styles are NOT included here - the cookie system has its own inline styles
 */
export function injectBaseStyles(html: string): string {
  if (!html) return html;

  const baseStyles = `<style data-preview-base>
/* Preview base styles */
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { 
  margin: 0; 
  padding: 0; 
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
img { max-width: 100%; height: auto; }
a { text-decoration: none; }

/* Fix common layout issues */
.container { max-width: 1200px; margin: 0 auto; padding: 0 15px; }
section { overflow: hidden; }

/* Google Maps container - responsive and styled */
.map-container, .map-wrapper, .google-map, [class*="map-section"] {
  width: 100%;
  min-height: 350px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin: 20px 0;
}
.map-container iframe, .map-wrapper iframe, .google-map iframe, [class*="map-section"] iframe {
  width: 100%;
  height: 100%;
  min-height: 350px;
  border: none;
  display: block;
}
/* Fallback for Google Maps iframes without container */
iframe[src*="google.com/maps"], iframe[src*="maps.google"] {
  width: 100%;
  min-height: 350px;
  border: none;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
</style>
`;

  // Insert before </head> tag
  const headCloseMatch = html.match(/<\/head>/i);
  if (headCloseMatch) {
    const insertPos = headCloseMatch.index!;
    return html.slice(0, insertPos) + baseStyles + html.slice(insertPos);
  }

  // Fallback: prepend to HTML
  return baseStyles + html;
}

/**
 * Optimize Google Maps iframes for proper display
 * - Ensures proper attributes for embedding
 * - Adds loading="lazy" and allowfullscreen
 * - Wraps in container if needed
 */
export function optimizeGoogleMaps(html: string): string {
  if (!html) return html;

  // Match Google Maps iframes
  const iframeRegex = /(<iframe[^>]*(?:src\s*=\s*["'][^"']*(?:google\.com\/maps|maps\.google)[^"']*["'])[^>]*)(\/?>)/gi;

  let result = html.replace(iframeRegex, (match, iframeStart: string, iframeEnd: string) => {
    let iframe = iframeStart;

    // Add loading="lazy" if not present
    if (!/loading\s*=/i.test(iframe)) {
      iframe += ' loading="lazy"';
    }

    // Add allowfullscreen if not present
    if (!/allowfullscreen/i.test(iframe)) {
      iframe += ' allowfullscreen=""';
    }

    // Add title if not present
    if (!/title\s*=/i.test(iframe)) {
      iframe += ' title="Google Maps"';
    }

    // Add referrerpolicy for security
    if (!/referrerpolicy/i.test(iframe)) {
      iframe += ' referrerpolicy="no-referrer-when-downgrade"';
    }

    // Ensure width and height
    if (!/width\s*=/i.test(iframe)) {
      iframe += ' width="100%"';
    }
    if (!/height\s*=/i.test(iframe)) {
      iframe += ' height="450"';
    }

    // Ensure style has border:0
    if (!/style\s*=/i.test(iframe)) {
      iframe += ' style="border:0;"';
    }

    return iframe + iframeEnd;
  });

  return result;
}

/**
 * Full processing pipeline for PHP preview HTML
 */
export function processHtmlForPreview(html: string, files: GeneratedFile[]): string {
  if (!html) return html;

  let result = html;

  // 1. Inline all CSS files and process their backgrounds
  result = inlineAllCss(result, files);

  // 2. Replace broken image URLs with placeholders
  result = inlineLocalImages(result, files);

  // 3. Inject external resources (fonts, icons)
  result = injectExternalResources(result);

  // 4. Add base preview styles (includes Google Maps container styles)
  result = injectBaseStyles(result);

  // 5. Optimize Google Maps iframes
  result = optimizeGoogleMaps(result);

  return result;
}
