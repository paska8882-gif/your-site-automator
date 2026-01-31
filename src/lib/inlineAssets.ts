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
/* ===== CRITICAL PREVIEW RESET ===== */
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { 
  margin: 0; 
  padding: 0; 
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; }

/* ===== DOCUMENT STRUCTURE ===== */
/* Ensure proper stacking: header at top, main content fills, footer at bottom */
body > header, body > .header, body > [class*="header"]:first-child { order: -2; }
body > main, body > .main, body > .content { flex: 1 0 auto; order: 0; }
body > footer, body > .footer, body > [class*="footer"]:last-child { order: 100; margin-top: auto; }

/* Containers */
.container, .wrapper, [class*="container"] { 
  max-width: 1200px; 
  margin-left: auto; 
  margin-right: auto; 
  padding-left: 15px; 
  padding-right: 15px; 
  width: 100%; 
}
section { overflow: hidden; }

/* ===== HEADER / TOP BAR CRITICAL FIXES ===== */
/* Top bar (phone, social, etc) */
.top-bar, .topbar, .header-top, .top-header, [class*="top-bar"], [class*="topbar"], 
.contact-bar, .info-bar, .header-info, .pre-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 1rem;
  flex-wrap: wrap;
  width: 100%;
  padding: 8px 0;
}

.top-bar > *, .topbar > *, .header-top > *, .pre-header > * {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem;
}

/* Main header wrapper */
header, .header, .site-header, .main-header {
  position: relative;
  width: 100%;
}

/* Header inner container - FORCE horizontal layout */
header .container, .header .container, .site-header .container, 
.main-header .container, header > .wrapper {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-wrap: wrap;
  gap: 1rem;
  min-height: 60px;
}

/* ===== LOGO ===== */
.logo, .site-logo, .brand, .navbar-brand, [class*="logo"]:not([class*="footer"]) {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem;
  flex-shrink: 0;
  order: 0;
}

.logo img, .site-logo img, .brand img, .navbar-brand img {
  max-height: 50px;
  width: auto;
  height: auto;
  object-fit: contain;
}

/* ===== NAVIGATION ===== */
nav, .nav, .navigation, .main-nav, .site-nav, .navbar {
  display: flex !important;
  align-items: center !important;
  order: 1;
}

nav ul, .nav ul, .navigation ul, .nav-menu, .menu, .nav-links, 
ul.nav, ul.menu, ul.navigation, .navbar ul, nav > ul {
  display: flex !important;
  align-items: center !important;
  gap: 0.25rem;
  list-style: none !important;
  margin: 0 !important;
  padding: 0 !important;
  flex-wrap: wrap;
}

nav li, .nav li, .menu li, .nav-menu li, .nav-links li, nav ul li {
  display: inline-flex !important;
  align-items: center !important;
  list-style: none !important;
}

nav a, .nav a, .menu a, .nav-links a, .nav-menu a, nav ul li a {
  display: inline-flex !important;
  align-items: center !important;
  padding: 0.5rem 0.75rem;
  white-space: nowrap;
}

/* ===== HEADER CTA / ACTIONS ===== */
.header-cta, .header-buttons, .nav-cta, .header-actions, 
.header-right, .cta-button, header .btn, header .button {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem;
  margin-left: auto;
  order: 2;
}

/* Phone in header */
.header-phone, .phone-number, [class*="phone"]:not(footer *), a[href^="tel:"] {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem;
  white-space: nowrap;
}

/* ===== HERO SECTION ===== */
.hero, .hero-section, [class*="hero"], .banner, .jumbotron {
  position: relative;
  width: 100%;
}

/* ===== FOOTER - KEEP AT BOTTOM ===== */
footer, .footer, .site-footer, .main-footer {
  width: 100%;
  margin-top: auto !important;
}

footer .container, .footer .container, .site-footer .container {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  justify-content: space-between;
}

footer ul, .footer ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* ===== GOOGLE MAPS ===== */
.map-container, .map-wrapper, .google-map, [class*="map-section"] {
  width: 100%;
  min-height: 350px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin: 20px 0;
}
.map-container iframe, .map-wrapper iframe, .google-map iframe {
  width: 100%;
  height: 100%;
  min-height: 350px;
  border: none;
  display: block;
}
iframe[src*="google.com/maps"], iframe[src*="maps.google"] {
  width: 100%;
  min-height: 350px;
  border: none;
  border-radius: 12px;
}

/* ===== RESPONSIVE - TABLET (768px - 1024px) ===== */
@media (max-width: 1024px) {
  .container, .wrapper, [class*="container"] {
    max-width: 100%;
    padding-left: 20px;
    padding-right: 20px;
  }
  
  /* Grid layouts become 2 columns */
  .grid, [class*="grid"], .cards, .features, .services-grid, .team-grid, .gallery {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 1.5rem !important;
  }
  
  /* Flex rows wrap more aggressively */
  .row, [class*="row"], .flex-row {
    flex-wrap: wrap !important;
    gap: 1rem !important;
  }
  
  .row > *, .flex-row > * {
    min-width: 45% !important;
    flex: 1 1 45% !important;
  }
  
  /* Two-column sections become stacked */
  .two-columns, .split-section, [class*="two-col"], 
  .content-image, .image-content, .text-image, .about-content {
    display: flex !important;
    flex-direction: column !important;
    gap: 2rem !important;
  }
  
  .two-columns > *, .split-section > *, [class*="two-col"] > * {
    width: 100% !important;
    max-width: 100% !important;
    flex: none !important;
  }
  
  /* Hero text sizing */
  h1, .hero h1, .hero-title, [class*="hero"] h1 {
    font-size: clamp(2rem, 5vw, 3rem) !important;
    line-height: 1.2 !important;
  }
  
  h2 {
    font-size: clamp(1.5rem, 4vw, 2.25rem) !important;
  }
  
  h3 {
    font-size: clamp(1.25rem, 3vw, 1.75rem) !important;
  }
  
  /* Section padding reduction */
  section, .section, [class*="section"] {
    padding-top: clamp(40px, 8vw, 60px) !important;
    padding-bottom: clamp(40px, 8vw, 60px) !important;
  }
}

/* ===== HAMBURGER MENU SYSTEM ===== */
/* Menu toggle button - hidden on desktop, visible on mobile */
.mobile-menu-toggle {
  display: none;
  flex-direction: column;
  justify-content: space-around;
  width: 30px;
  height: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
  position: relative;
}

.mobile-menu-toggle span {
  display: block;
  width: 100%;
  height: 3px;
  background-color: currentColor;
  border-radius: 2px;
  transition: all 0.3s ease;
  transform-origin: center;
}

/* Hamburger animation when open */
.mobile-menu-toggle.active span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}
.mobile-menu-toggle.active span:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}
.mobile-menu-toggle.active span:nth-child(3) {
  transform: rotate(-45deg) translate(6px, -6px);
}

/* Mobile navigation container */
.mobile-nav-menu {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1000;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0;
  padding: 60px 20px 40px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  overflow-y: auto;
}

.mobile-nav-menu.active {
  display: flex;
  opacity: 1;
  visibility: visible;
}

.mobile-nav-menu a {
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 500;
  padding: 1rem 2rem;
  text-decoration: none;
  transition: color 0.2s ease, transform 0.2s ease;
  text-align: center;
  width: 100%;
  max-width: 280px;
}

.mobile-nav-menu a:hover {
  color: #3b82f6;
  transform: scale(1.05);
}

/* Close button for mobile menu */
.mobile-menu-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 1.5rem;
  transition: all 0.2s ease;
}

.mobile-menu-close:hover {
  background: #ffffff;
  color: #000000;
}

/* ===== RESPONSIVE - MOBILE LARGE (481px - 767px) ===== */
@media (max-width: 767px) {
  /* Show hamburger menu button */
  .mobile-menu-toggle {
    display: flex !important;
    order: 10;
  }
  
  /* Hide desktop navigation */
  nav, .nav, .navigation, .main-nav, .site-nav, .navbar,
  header nav, header .nav, header .navigation,
  .header nav, .header .nav, .site-header nav {
    display: none !important;
  }
  
  /* But show our mobile nav overlay */
  .mobile-nav-menu {
    display: none; /* Will be shown via JS when .active is added */
  }
  .mobile-nav-menu.active {
    display: flex !important;
  }
  
  /* Header layout for mobile with hamburger */
  header .container, .header .container, .site-header .container,
  .main-header .container, header > .wrapper {
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 0.75rem 1rem;
    gap: 0.5rem;
  }
  
  /* Logo stays left */
  .logo, .site-logo, .brand, .navbar-brand {
    order: 0;
    margin-bottom: 0;
    flex-shrink: 0;
  }
  
  /* Header CTA/phone between logo and hamburger */
  .header-cta, .header-buttons, .nav-cta, .header-right, .header-actions {
    margin-left: auto !important;
    order: 5;
    display: none !important; /* Hide on mobile - will be in mobile menu */
  }
  
  /* Top bar stacked */
  .top-bar, .topbar, .header-top, .pre-header {
    flex-direction: column !important;
    align-items: center !important;
    text-align: center;
    gap: 0.5rem !important;
    padding: 0.5rem !important;
    font-size: 0.875rem;
  }
  
  /* All grids become single column */
  .grid, [class*="grid"], .cards, .features, .services-grid, 
  .team-grid, .gallery, .portfolio-grid, .blog-grid {
    grid-template-columns: 1fr !important;
    gap: 1.5rem !important;
  }
  
  /* Flex items full width */
  .row > *, .flex-row > *, [class*="col-"] {
    min-width: 100% !important;
    flex: 1 1 100% !important;
    width: 100% !important;
  }
  
  /* Hero section adjustments */
  .hero, .hero-section, [class*="hero"], .banner {
    min-height: 70vh !important;
    padding: 2rem 1rem !important;
  }
  
  .hero .container, [class*="hero"] .container {
    text-align: center;
  }
  
  .hero-content, [class*="hero-content"] {
    max-width: 100% !important;
    text-align: center !important;
  }
  
  /* Hero buttons stacked */
  .hero-buttons, .hero-cta, .cta-buttons, .button-group, .btn-group {
    flex-direction: column !important;
    align-items: center !important;
    gap: 0.75rem !important;
    width: 100%;
  }
  
  .hero-buttons .btn, .hero-buttons .button, .hero-buttons a,
  .cta-buttons .btn, .cta-buttons .button {
    width: 100% !important;
    max-width: 280px;
    text-align: center !important;
    justify-content: center !important;
  }
  
  /* Cards full width */
  .card, .service-card, .feature-card, .team-card, .testimonial-card,
  [class*="card"], .box, .item {
    width: 100% !important;
    max-width: 100% !important;
  }
  
  /* Footer columns stacked */
  footer .container, .footer .container, .site-footer .container {
    flex-direction: column !important;
    align-items: center !important;
    text-align: center;
    gap: 2rem !important;
  }
  
  .footer-col, .footer-column, .footer-widget, footer > div > div {
    width: 100% !important;
    text-align: center;
  }
  
  footer ul, .footer ul {
    align-items: center;
  }
  
  /* Contact form full width */
  form, .contact-form, .newsletter-form {
    width: 100% !important;
    max-width: 100% !important;
  }
  
  input, textarea, select, .form-control, .input-field {
    width: 100% !important;
    min-width: 0 !important;
    font-size: 16px !important; /* Prevents iOS zoom */
  }
  
  /* Tables responsive */
  table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
  }
  
  /* Stats/counters row */
  .stats, .counters, .numbers, [class*="stats"], [class*="counter"] {
    flex-direction: column !important;
    gap: 1.5rem !important;
  }
  
  /* Pricing tables stacked */
  .pricing, .pricing-table, [class*="pricing"] {
    flex-direction: column !important;
    align-items: center !important;
  }
  
  .pricing-card, .price-card, [class*="pricing"] > div {
    width: 100% !important;
    max-width: 350px !important;
  }
}

/* ===== RESPONSIVE - MOBILE SMALL (≤480px) ===== */
@media (max-width: 480px) {
  .container, .wrapper, [class*="container"] {
    padding-left: 16px !important;
    padding-right: 16px !important;
  }
  
  /* Even smaller typography */
  h1, .hero h1, .hero-title {
    font-size: clamp(1.5rem, 7vw, 2.25rem) !important;
  }
  
  h2 {
    font-size: clamp(1.25rem, 5vw, 1.75rem) !important;
  }
  
  h3 {
    font-size: clamp(1.1rem, 4vw, 1.5rem) !important;
  }
  
  p, li, span {
    font-size: clamp(0.9rem, 3.5vw, 1rem) !important;
  }
  
  /* Buttons */
  .btn, .button, button, [class*="btn"], a.cta {
    padding: 0.75rem 1.25rem !important;
    font-size: 0.9rem !important;
    width: 100% !important;
    text-align: center !important;
  }
  
  /* Reduce section padding */
  section, .section {
    padding-top: 32px !important;
    padding-bottom: 32px !important;
  }
  
  /* Hero smaller */
  .hero, [class*="hero"], .banner {
    min-height: 60vh !important;
    padding: 1.5rem 1rem !important;
  }
  
  /* Logo smaller */
  .logo img, .site-logo img, .brand img {
    max-height: 40px !important;
  }
  
  /* Google Maps smaller */
  .map-container, .google-map, iframe[src*="google.com/maps"] {
    min-height: 250px !important;
    height: 250px !important;
  }
  
  /* Hide decorative elements */
  .decoration, .ornament, .bg-pattern, [class*="decoration"] {
    display: none !important;
  }
}

/* ===== UTILITY FIXES ===== */
/* Prevent horizontal scroll */
html, body {
  overflow-x: hidden !important;
  max-width: 100vw !important;
}

/* Images never overflow */
img, video, iframe, embed, object {
  max-width: 100% !important;
}

/* Fix for flexbox items */
* {
  min-width: 0;
}
</style>

<script data-hamburger-menu>
(function() {
  function initHamburgerMenu() {
    // Find the header - try multiple patterns
    var header = document.querySelector('header, .header, .site-header, .main-header, [class*="header"]:not(footer *)');
    if (!header) {
      // Fallback: look for any element with logo + nav pattern
      header = document.querySelector('[class*="logo"]')?.closest('header, div, section');
    }
    if (!header) return;
    
    // Check if hamburger already exists
    if (document.querySelector('.mobile-menu-toggle')) return;
    
    // Find navigation - try inside header first, then broader search
    var nav = header.querySelector('nav, .nav, .navigation, .main-nav, .site-nav, .navbar, .menu, ul.nav, ul.menu');
    
    // If no nav element found, look for ul with links directly in header
    if (!nav) {
      nav = header.querySelector('ul');
    }
    
    // Collect all navigation links from multiple sources
    var allNavLinks = [];
    
    // Get links from nav element
    if (nav) {
      var navLinks = nav.querySelectorAll('a');
      navLinks.forEach(function(link) {
        var href = link.getAttribute('href');
        // Skip empty hrefs, anchors to current page, and javascript: links
        if (href && href !== '#' && href !== '' && !href.startsWith('javascript:')) {
          allNavLinks.push(link);
        }
      });
    }
    
    // If still no links, try to find any navigation-like links in header
    if (allNavLinks.length === 0) {
      var headerLinks = header.querySelectorAll('a');
      headerLinks.forEach(function(link) {
        var href = link.getAttribute('href');
        var text = link.textContent.trim();
        // Skip logo links, empty links, and very short/long text
        if (href && href !== '#' && href !== '' && 
            !href.startsWith('javascript:') &&
            !link.closest('.logo, .site-logo, .brand, [class*="logo"]') &&
            text.length > 0 && text.length < 50) {
          allNavLinks.push(link);
        }
      });
    }
    
    // Need at least one link
    if (allNavLinks.length === 0) return;
    
    // Create hamburger button
    var hamburger = document.createElement('button');
    hamburger.className = 'mobile-menu-toggle';
    hamburger.setAttribute('aria-label', 'Toggle menu');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    
    // Create mobile menu overlay
    var mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-nav-menu';
    
    // Create close button
    var closeBtn = document.createElement('button');
    closeBtn.className = 'mobile-menu-close';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.innerHTML = '×';
    mobileMenu.appendChild(closeBtn);
    
    // Clone nav links into mobile menu
    allNavLinks.forEach(function(link) {
      var clone = link.cloneNode(true);
      clone.addEventListener('click', function() {
        closeMobileMenu();
      });
      mobileMenu.appendChild(clone);
    });
    
    // Add phone/CTA if exists (search in entire header area)
    var headerPhone = header.querySelector('a[href^="tel:"], .header-phone, .phone-number, [class*="phone"]');
    if (!headerPhone) {
      // Also check document for phone in top-bar area
      headerPhone = document.querySelector('.top-bar a[href^="tel:"], .topbar a[href^="tel:"], .pre-header a[href^="tel:"]');
    }
    if (headerPhone && !allNavLinks.includes(headerPhone)) {
      var phoneClone = headerPhone.cloneNode(true);
      phoneClone.style.marginTop = '2rem';
      phoneClone.style.color = '#3b82f6';
      phoneClone.addEventListener('click', function() {
        closeMobileMenu();
      });
      mobileMenu.appendChild(phoneClone);
    }
    
    // Find the best container to append hamburger
    var headerContainer = header.querySelector('.container, .wrapper, .header-container, .header-wrapper') || header;
    headerContainer.appendChild(hamburger);
    document.body.appendChild(mobileMenu);
    
    // Toggle functions
    function openMobileMenu() {
      mobileMenu.classList.add('active');
      hamburger.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
      mobileMenu.classList.remove('active');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    
    function toggleMobileMenu() {
      if (mobileMenu.classList.contains('active')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    }
    
    // Event listeners
    hamburger.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMobileMenu();
    });
    
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeMobileMenu();
    });
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
        closeMobileMenu();
      }
    });
    
    // Close when clicking outside menu content
    mobileMenu.addEventListener('click', function(e) {
      if (e.target === mobileMenu) {
        closeMobileMenu();
      }
    });
    
    console.log('[HamburgerMenu] Initialized with', allNavLinks.length, 'links');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHamburgerMenu);
  } else {
    // Small delay to ensure all elements are rendered
    setTimeout(initHamburgerMenu, 100);
  }
})();
</script>
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
