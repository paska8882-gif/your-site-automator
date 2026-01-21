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

  // Find all CSS link tags and replace with inline styles
  const linkRegex = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  const linkRegex2 = /<link[^>]+href\s*=\s*["']([^"']+\.css)["'][^>]*\/?>/gi;

  const replaceCssLink = (match: string, href: string) => {
    // Keep external stylesheets (Bootstrap, Google Fonts, etc.)
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return match;
    }

    const normalizedPath = href.replace(/^\.\//, '').replace(/^\//, '');
    const cssFile = files.find(f => 
      f.path === normalizedPath || 
      f.path === 'css/' + normalizedPath || 
      f.path === 'assets/css/' + normalizedPath ||
      f.path.endsWith('/' + normalizedPath)
    );

    if (cssFile) {
      // Process background images in CSS
      const processedCss = processCssBackgrounds(cssFile.content, files);
      return `<style data-source="${cssFile.path}">\n${processedCss}\n</style>`;
    }

    return match;
  };

  result = result.replace(linkRegex, replaceCssLink);
  result = result.replace(linkRegex2, replaceCssLink);

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

/* Ensure cookie banner is visible */
.cookie-banner, .cookie-consent, [class*="cookie"] {
  position: fixed !important;
  z-index: 9999 !important;
}

/* Fix common layout issues */
.container { max-width: 1200px; margin: 0 auto; padding: 0 15px; }
section { overflow: hidden; }
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

  // 4. Add base preview styles
  result = injectBaseStyles(result);

  return result;
}
