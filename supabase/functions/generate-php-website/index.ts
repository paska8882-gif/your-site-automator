import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a prompt refiner for professional, multi-page PHP websites.

Your job:
- Analyze the user's request
- Extract the required pages/sections, brand details, geo/country, and contact info
- Produce a clear GENERATION BRIEF that a separate website generator will follow

LANGUAGE (CRITICAL, NON-NEGOTIABLE):
- If the user explicitly specifies a language (e.g. "Language: EN", "Мова: українська", "Язык: русский"), set TARGET_LANGUAGE to that exact language/code.
- Otherwise infer from the language of the user's message.
- If still unclear, default to EN.
- IMPORTANT: Do NOT "default" to Ukrainian unless explicitly requested.

OUTPUT RULES:
- Write the brief itself in ENGLISH (meta-instructions), but keep TARGET_LANGUAGE exactly as determined.
- Do NOT translate the user's business content; only describe what to generate.

Return ONLY this structure:
TARGET_LANGUAGE: <value>
SITE_NAME: <value if present>
GEO/COUNTRY: <value if present>
PAGES:
- <page 1>
- <page 2>
DESIGN:
- style: <summary>
- colors: <summary>
CONTENT:
- key offerings: <bullets>
- primary CTAs: <bullets>
CONTACT:
- phone: <required format + must be clickable tel: link>
- email: <if present + must be clickable mailto: link>
- address: <if present>
`.trim();

// 10 unique layout variations for randomization or manual selection
const LAYOUT_VARIATIONS = [
  {
    id: "classic",
    name: "Classic Corporate",
    description: `LAYOUT STYLE: Classic Corporate
- Hero: Full-width hero with centered content, large background image with dark overlay
- Sections: Alternating left-right content blocks with images
- Features: 3-column grid of cards with icons on top
- Testimonials: Carousel-style slider with large quotes
- CTA: Full-width banner with gradient background
- Footer: 4-column layout with newsletter subscription`
  },
  {
    id: "asymmetric",
    name: "Modern Asymmetric",
    description: `LAYOUT STYLE: Modern Asymmetric
- Hero: Split-screen layout - 60% text left, 40% large image right with overlap effect
- Sections: Asymmetric grid with varying column widths (2:1, 1:2 ratio)
- Features: Staggered cards with alternating sizes, some overlapping
- Testimonials: Large single testimonial with portrait photo offset to corner
- CTA: Diagonal section divider with angled background
- Footer: Minimalist 2-column with large logo`
  },
  {
    id: "editorial",
    name: "Editorial Magazine",
    description: `LAYOUT STYLE: Editorial Magazine
- Hero: Minimal text-only hero with huge typography, small accent image in corner
- Sections: Newspaper-style multi-column layout with pull quotes
- Features: Masonry grid with varying heights and widths
- Testimonials: Inline quotes styled as editorial callouts with decorative quotation marks
- CTA: Text-heavy with minimal button, focus on copywriting
- Footer: Single-line footer with horizontal link list`
  },
  {
    id: "bold",
    name: "Bold Blocks",
    description: `LAYOUT STYLE: Bold Blocks
- Hero: Full-viewport hero with video or animated background, text at bottom
- Sections: Large full-width color blocks alternating between content types
- Features: Single row horizontal scroll cards on mobile, grid on desktop
- Testimonials: Full-width color section with centered large text
- CTA: Sticky bottom bar that appears on scroll
- Footer: Compact dark footer with social icons prominent`
  },
  {
    id: "minimalist",
    name: "Minimalist Zen",
    description: `LAYOUT STYLE: Minimalist Zen
- Hero: Lots of whitespace, small centered text with subtle line animations
- Sections: Single column centered layout with generous margins (max-width: 800px)
- Features: Vertical stack with large icons and minimal text
- Testimonials: Simple italic text with em-dash attribution, no photos
- CTA: Subtle underlined text link instead of button
- Footer: Ultra-minimal with only essential links`
  },
  {
    id: "showcase",
    name: "Dynamic Showcase",
    description: `LAYOUT STYLE: Dynamic Showcase
- Hero: Image gallery/slideshow hero with thumbnails below
- Sections: Card-heavy layout with hover effects revealing more content
- Features: Hexagonal or circular icon grid with connecting lines
- Testimonials: Grid of small cards with photos and star ratings
- CTA: Floating action button that follows scroll
- Footer: Multi-level footer with expandable sections on mobile`
  },
  {
    id: "gradient",
    name: "Gradient Flow",
    description: `LAYOUT STYLE: Gradient Flow
- Hero: Animated gradient background with floating geometric shapes
- Sections: Smooth color transitions between sections with wave dividers
- Features: Glassmorphism cards with blur effects and subtle borders
- Testimonials: Floating quote bubbles with gradient borders
- CTA: Pulsing gradient button with glow effect
- Footer: Dark footer with gradient accent line at top`
  },
  {
    id: "brutalist",
    name: "Brutalist Raw",
    description: `LAYOUT STYLE: Brutalist Raw
- Hero: Bold oversized typography, harsh contrasts, visible grid lines
- Sections: Exposed structure with visible borders and raw edges
- Features: Monospace font, numbered lists, stark black/white with one accent
- Testimonials: Plain text with quotation marks, no styling
- CTA: Thick bordered button with underline on hover
- Footer: Minimal with just copyright and essential links`
  },
  {
    id: "saas",
    name: "SaaS Product",
    description: `LAYOUT STYLE: SaaS Product
- Hero: Product screenshot mockup in browser frame, floating UI elements
- Sections: Feature comparison tables, pricing cards side by side
- Features: Icon + title + description in 2x3 grid with hover animations
- Testimonials: Company logos carousel + featured case study card
- CTA: Free trial button with "No credit card required" text
- Footer: Multi-column with product links, resources, company info`
  },
  {
    id: "portfolio",
    name: "Creative Portfolio",
    description: `LAYOUT STYLE: Creative Portfolio
- Hero: Full-screen image/video with name overlay and scroll indicator
- Sections: Case study cards with large thumbnails and project details
- Features: Skills as animated progress bars or tag clouds
- Testimonials: Client logos with expandable reviews
- CTA: "Let's work together" with contact form modal
- Footer: Social links prominent with simple copyright`
  }
];

const PHP_GENERATION_PROMPT = `CRITICAL: CREATE A STUNNING, PREMIUM MULTI-PAGE PHP WEBSITE WITH EXCEPTIONAL DESIGN QUALITY

📞📧🚨 CONTACT INFO - READ THIS FIRST! ABSOLUTELY MANDATORY! 🚨📧📞
EVERY website MUST have a REAL phone number and email. NO EXCEPTIONS!

**PHONE NUMBER - REQUIRED ON EVERY PAGE:**
- MUST appear in header AND footer on ALL pages
- MUST be realistic for the country/GEO (see examples below)
- MUST be clickable: <a href="tel:+491234567890">+49 123 456 7890</a>
- NEVER use fake numbers like 123456, 555-1234, XXX, or placeholders
- Examples by country:
  * Germany: +49 30 2897 6543, +49 89 4521 7890
  * Poland: +48 22 456 78 90, +48 12 345 67 89
  * Spain: +34 912 456 789, +34 932 876 543
  * France: +33 1 42 68 53 00, +33 4 93 45 67 89
  * Italy: +39 06 8745 6321, +39 02 7654 3210
  * UK: +44 20 7946 0958, +44 161 496 0753
  * USA: +1 (212) 456-7890, +1 (415) 789-0123
  * Netherlands: +31 20 794 5682
  * Czech Republic: +420 221 456 789
  * Ukraine: +380 44 456 7890
  * Austria: +43 1 234 5678

**EMAIL - REQUIRED ON EVERY PAGE:**
- MUST appear in header AND footer on ALL pages
- MUST use the site's domain: info@<sitename>.com, contact@<sitename>.com
- Extract domain from business name (lowercase, no spaces)
- MUST be clickable: <a href="mailto:info@sitename.com">info@sitename.com</a>
- NEVER use generic emails like info@company.com or test@example.com

⚠️ IF NO PHONE/EMAIL IN OUTPUT = SITE IS BROKEN! ALWAYS INCLUDE THEM!

**🎨 DESIGN PHILOSOPHY - THIS IS NON-NEGOTIABLE:**
You are creating a PREMIUM, AGENCY-QUALITY website that looks like it cost $5,000+ to build.
The design must be EXCEPTIONAL - think award-winning agency work, not template garbage.

**⚠️ MANDATORY MULTI-PAGE REQUIREMENT - NON-NEGOTIABLE:**
You MUST create a MINIMUM of 6 SEPARATE PHP PAGE FILES. This is ABSOLUTELY REQUIRED:

REQUIRED PAGES (ALL MANDATORY):
1. index.php - Homepage with hero, features, about preview, services preview, testimonials, CTA
2. about.php - About Us page with company history, mission, vision, team section, values
3. services.php - Services/Products page with detailed service descriptions, benefits, process
4. contact.php - Contact page with WORKING form, map placeholder, contact info, working hours
5. thank-you.php - Thank you page after form submission
6. privacy.php - Privacy policy page with 10+ sections (see Privacy Policy requirements below)
7. terms.php - Terms of Service page with 14 sections (see Terms of Service requirements below)
8. cookie-policy.php - Cookie Policy page with cookies table (see Cookie Policy requirements below)

OPTIONAL ADDITIONAL PAGES (add 1-3 based on business type):
- portfolio.php - For creative/agency businesses
- team.php - Team members page
- faq.php - Frequently asked questions
- pricing.php - Pricing/packages (use "Contact for quote" instead of prices)
- blog.php - Blog listing page
- gallery.php - Photo gallery page

**FAILURE TO CREATE ALL 6 MANDATORY PAGES = INVALID OUTPUT**

**🖥️ PHP STRUCTURE - ABSOLUTELY CRITICAL:**
This is a PHP website. You MUST:
1. Use .php file extensions for ALL pages (index.php, about.php, services.php, contact.php, etc.)
2. Create reusable PHP includes for header, footer, and navigation:
   - includes/header.php - Contains <!DOCTYPE html>, <head>, navigation with links to ALL pages
   - includes/footer.php - Contains footer content and closing </body></html>
   - includes/config.php - Contains site configuration variables
3. Use PHP includes on every page:
   <?php include 'includes/header.php'; ?>
   <!-- page content -->
   <?php include 'includes/footer.php'; ?>
4. Create a proper contact form handler (form-handler.php) that processes POST data
5. Use PHP variables for site-wide settings (site name, email, phone)

**⚠️ CRITICAL PHP INCLUDE PATHS - MUST FOLLOW EXACTLY:**
- ALWAYS use simple relative paths: include 'includes/header.php';
- NEVER use ./ prefix: NOT include './includes/header.php';
- NEVER use absolute paths: NOT include '/includes/header.php';
- NEVER use dirname(__FILE__): NOT include dirname(__FILE__) . '/includes/header.php';

**CORRECT INCLUDE SYNTAX (USE THIS EXACTLY):**
\`\`\`php
<?php include 'includes/header.php'; ?>
<!-- page content here -->
<?php include 'includes/footer.php'; ?>
\`\`\`

**WRONG (NEVER DO THIS):**
\`\`\`php
<?php include './includes/header.php'; ?> // WRONG - no ./
<?php include_once __DIR__ . '/includes/header.php'; ?> // WRONG - no __DIR__
<?php require_once dirname(__FILE__).'/includes/header.php'; ?> // WRONG
\`\`\`

**PHP CODE REQUIREMENTS:**
- All PHP code MUST be valid and syntactically correct
- Use proper PHP opening tags: <?php
- Close PHP tags only when switching to HTML: ?>
- Use htmlspecialchars() for outputting user data
- Use proper form handling with $_POST
- Include error handling and validation
- DO NOT use deprecated functions

**MANDATORY FILE STRUCTURE (MINIMUM):**
\`\`\`
includes/
  config.php      - Site configuration (REQUIRED)
  header.php      - Header template with nav to ALL pages (REQUIRED)
  footer.php      - Footer template (REQUIRED)
index.php         - Homepage (REQUIRED)
about.php         - About page (REQUIRED)
services.php      - Services page (REQUIRED)
contact.php       - Contact page with form (REQUIRED)
form-handler.php  - Form processing (REQUIRED)
thank-you.php     - Thank you page (REQUIRED)
privacy.php       - Privacy policy with 10+ sections (REQUIRED)
terms.php         - Terms of Service with 14 sections (REQUIRED)
cookie-policy.php - Cookie Policy with cookies table (REQUIRED)
css/
  style.css       - Main stylesheet (REQUIRED)
js/
  script.js       - JavaScript functionality (REQUIRED)
\`\`\`

**EXAMPLE config.php (REPLACE WITH REAL VALUES FOR YOUR GEO):**
\`\`\`php
<?php
// Site Configuration - REPLACE WITH REALISTIC VALUES!
define('SITE_NAME', 'Company Name');
// EMAIL MUST be domain-based: info@companyname.com (extract from business name)
define('SITE_EMAIL', 'info@companyname.com');
// PHONE MUST be realistic for GEO! Examples: +49 30 2897 6543 (Germany), +48 22 456 78 90 (Poland)
define('SITE_PHONE', '+49 30 2897 6543');
define('SITE_ADDRESS', 'Friedrichstraße 123, 10117 Berlin, Germany');
define('PRIMARY_COLOR', '#2563eb');
define('SECONDARY_COLOR', '#1e40af');
?>
\`\`\`

**🎨🎨🎨 PREMIUM CSS DESIGN SYSTEM - ABSOLUTELY MANDATORY 🎨🎨🎨**
This is the MOST IMPORTANT part. The CSS must be EXCEPTIONAL:

\`\`\`css
/* ===== PREMIUM DESIGN SYSTEM - MANDATORY ===== */

/* CSS Custom Properties for cohesive design */
:root {
  /* Colors - Adjust based on brief */
  --primary: #2563eb;
  --primary-dark: #1e40af;
  --primary-light: #3b82f6;
  --primary-glow: rgba(37, 99, 235, 0.15);
  --secondary: #0f172a;
  --accent: #06b6d4;
  --success: #10b981;
  
  /* Neutrals */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-dark: #0f172a;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-light: #e2e8f0;
  --border-medium: #cbd5e1;
  
  /* Typography Scale */
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  
  /* Spacing Scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  --space-4xl: 6rem;
  
  /* Effects */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --shadow-glow: 0 0 40px var(--primary-glow);
  
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Reset & Base */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.7;
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow-x: hidden;
}

/* Typography with visual hierarchy */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

h1 { 
  font-size: clamp(2.5rem, 5vw, 4rem); 
  font-weight: 800;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

h2 { 
  font-size: clamp(2rem, 4vw, 3rem); 
  margin-bottom: var(--space-lg);
}

h3 { font-size: clamp(1.5rem, 3vw, 2rem); }
h4 { font-size: clamp(1.25rem, 2vw, 1.5rem); }

p {
  color: var(--text-secondary);
  margin-bottom: var(--space-md);
}

/* Links */
a {
  color: var(--primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--primary-dark);
}

/* Container */
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-xl);
}

/* ===== PREMIUM NAVIGATION ===== */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: all var(--transition-base);
}

.navbar.scrolled {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-md);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.logo {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.25rem;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  list-style: none;
}

.nav-links a {
  font-weight: 500;
  color: var(--text-secondary);
  position: relative;
  padding: var(--space-sm) 0;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  transition: width var(--transition-base);
}

.nav-links a:hover::after,
.nav-links a.active::after {
  width: 100%;
}

.nav-links a:hover {
  color: var(--text-primary);
}

.nav-cta {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white !important;
  padding: var(--space-sm) var(--space-lg) !important;
  border-radius: var(--radius-full);
  font-weight: 600;
  box-shadow: 0 4px 15px var(--primary-glow);
  transition: all var(--transition-base);
}

.nav-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--primary-glow);
}

.nav-cta::after {
  display: none !important;
}

.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: var(--space-sm);
  color: var(--text-primary);
}

/* ===== HERO SECTION - STUNNING ===== */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  padding: calc(80px + var(--space-4xl)) 0 var(--space-4xl);
  overflow: hidden;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
}

.hero-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.hero-bg::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 80%;
  height: 150%;
  background: radial-gradient(ellipse, var(--primary-glow) 0%, transparent 70%);
  animation: float 20s ease-in-out infinite;
}

.hero-bg::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 60%;
  height: 100%;
  background: radial-gradient(ellipse, rgba(6, 182, 212, 0.1) 0%, transparent 70%);
  animation: float 15s ease-in-out infinite reverse;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(30px, -30px) rotate(5deg); }
  66% { transform: translate(-20px, 20px) rotate(-5deg); }
}

.hero-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4xl);
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-content {
  max-width: 600px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  margin-bottom: var(--space-lg);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.hero-badge-dot {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.hero h1 {
  margin-bottom: var(--space-lg);
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-xl);
  line-height: 1.8;
}

.hero-buttons {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.hero-image-wrapper {
  position: relative;
}

.hero-image {
  width: 100%;
  height: auto;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  transform: perspective(1000px) rotateY(-5deg) rotateX(5deg);
  transition: transform var(--transition-slow);
}

.hero-image:hover {
  transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
}

.hero-float-card {
  position: absolute;
  background: white;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  animation: floatCard 6s ease-in-out infinite;
}

.hero-float-card.card-1 {
  top: 10%;
  right: -10%;
  animation-delay: 0s;
}

.hero-float-card.card-2 {
  bottom: 20%;
  left: -10%;
  animation-delay: 2s;
}

@keyframes floatCard {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

/* ===== PREMIUM BUTTONS ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-xl);
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-lg);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  text-decoration: none;
  white-space: nowrap;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  box-shadow: 0 4px 15px var(--primary-glow);
}

.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px var(--primary-glow);
  color: white;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}

.btn-secondary:hover {
  background: var(--bg-secondary);
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
}

.btn-outline:hover {
  background: var(--primary);
  color: white;
}

.btn-lg {
  padding: var(--space-lg) var(--space-2xl);
  font-size: 1.125rem;
}

.btn-icon {
  transition: transform var(--transition-fast);
}

.btn:hover .btn-icon {
  transform: translateX(4px);
}

/* ===== SECTIONS ===== */
section {
  padding: var(--space-4xl) 0;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto var(--space-3xl);
}

.section-badge {
  display: inline-block;
  padding: var(--space-xs) var(--space-md);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  margin-bottom: var(--space-md);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-title {
  margin-bottom: var(--space-md);
}

.section-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
}

/* ===== FEATURE CARDS - PREMIUM ===== */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-xl);
}

.feature-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: var(--space-2xl);
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--transition-base);
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-xl);
  border-color: transparent;
}

.feature-card:hover::before {
  transform: scaleX(1);
}

.feature-icon {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--primary-glow), rgba(6, 182, 212, 0.1));
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  margin-bottom: var(--space-lg);
}

.feature-card h3 {
  margin-bottom: var(--space-md);
  font-size: 1.25rem;
}

.feature-card p {
  color: var(--text-secondary);
  margin: 0;
}

/* ===== ABOUT SECTION ===== */
.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4xl);
  align-items: center;
}

.about-image-wrapper {
  position: relative;
}

.about-image {
  width: 100%;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
}

.about-image-accent {
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 200px;
  height: 200px;
  background: linear-gradient(135deg, var(--primary-glow), var(--accent));
  border-radius: var(--radius-2xl);
  z-index: -1;
  opacity: 0.5;
}

.about-content h2 {
  margin-bottom: var(--space-lg);
}

.about-content p {
  margin-bottom: var(--space-md);
}

.about-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
  margin-top: var(--space-2xl);
  padding-top: var(--space-2xl);
  border-top: 1px solid var(--border-light);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: var(--space-xs);
}

/* ===== SERVICES SECTION ===== */
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--space-xl);
}

.service-card {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}

.service-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-2xl);
}

.service-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.service-content {
  padding: var(--space-xl);
}

.service-content h3 {
  margin-bottom: var(--space-md);
}

.service-content p {
  color: var(--text-secondary);
  margin-bottom: var(--space-lg);
}

.service-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: 600;
  color: var(--primary);
}

.service-link:hover .btn-icon {
  transform: translateX(4px);
}

/* ===== TESTIMONIALS ===== */
.testimonials {
  background: var(--bg-secondary);
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--space-xl);
}

.testimonial-card {
  background: var(--bg-primary);
  padding: var(--space-2xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  position: relative;
}

.testimonial-quote {
  font-size: 4rem;
  color: var(--primary-glow);
  position: absolute;
  top: var(--space-md);
  right: var(--space-lg);
  line-height: 1;
}

.testimonial-text {
  font-size: 1.125rem;
  font-style: italic;
  color: var(--text-primary);
  margin-bottom: var(--space-xl);
  line-height: 1.8;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.testimonial-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
}

.testimonial-name {
  font-weight: 700;
  color: var(--text-primary);
}

.testimonial-role {
  font-size: 0.875rem;
  color: var(--text-muted);
}

/* ===== CTA SECTION ===== */
.cta {
  background: linear-gradient(135deg, var(--secondary) 0%, var(--primary-dark) 100%);
  color: white;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.cta::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%);
}

.cta-content {
  position: relative;
  z-index: 1;
  max-width: 700px;
  margin: 0 auto;
}

.cta h2 {
  color: white;
  margin-bottom: var(--space-md);
}

.cta p {
  color: rgba(255,255,255,0.8);
  font-size: 1.25rem;
  margin-bottom: var(--space-xl);
}

.cta .btn-primary {
  background: white;
  color: var(--primary);
}

.cta .btn-primary:hover {
  background: var(--bg-secondary);
}

/* ===== FOOTER ===== */
footer {
  background: var(--bg-dark);
  color: white;
  padding: var(--space-4xl) 0 var(--space-xl);
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: var(--space-3xl);
  margin-bottom: var(--space-3xl);
}

.footer-brand .logo {
  color: white;
  margin-bottom: var(--space-lg);
}

.footer-brand p {
  color: rgba(255,255,255,0.6);
  max-width: 300px;
}

.footer-column h4 {
  color: white;
  font-size: 1rem;
  margin-bottom: var(--space-lg);
}

.footer-column ul {
  list-style: none;
}

.footer-column li {
  margin-bottom: var(--space-sm);
}

.footer-column a {
  color: rgba(255,255,255,0.6);
  transition: color var(--transition-fast);
}

.footer-column a:hover {
  color: white;
}

.footer-bottom {
  padding-top: var(--space-xl);
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.footer-bottom p {
  color: rgba(255,255,255,0.4);
  font-size: 0.875rem;
  margin: 0;
}

.footer-bottom-links {
  display: flex;
  gap: var(--space-lg);
}

.footer-bottom-links a {
  color: rgba(255,255,255,0.4);
  font-size: 0.875rem;
}

/* ===== CONTACT PAGE ===== */
.contact-hero {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  padding: calc(80px + var(--space-3xl)) 0 var(--space-3xl);
  text-align: center;
}

.contact-section {
  padding: var(--space-4xl) 0;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: var(--space-3xl);
}

.contact-info {
  background: var(--bg-secondary);
  padding: var(--space-2xl);
  border-radius: var(--radius-xl);
}

.contact-info h2 {
  margin-bottom: var(--space-xl);
}

.info-item {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.info-item-icon {
  width: 48px;
  height: 48px;
  background: var(--primary-glow);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.info-item-content h4 {
  font-size: 1rem;
  margin-bottom: var(--space-xs);
}

.info-item-content p {
  color: var(--text-secondary);
  margin: 0;
}

.info-item-content a {
  color: var(--primary);
}

.contact-form-wrapper {
  background: white;
  padding: var(--space-2xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

.contact-form-wrapper h2 {
  margin-bottom: var(--space-xl);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: var(--space-md);
  border: 2px solid var(--border-light);
  border-radius: var(--radius-lg);
  font-size: 1rem;
  font-family: inherit;
  transition: all var(--transition-fast);
  background: var(--bg-primary);
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-glow);
}

.form-group textarea {
  resize: vertical;
  min-height: 150px;
}

.submit-btn {
  width: 100%;
  padding: var(--space-lg);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px var(--primary-glow);
}

/* ===== LEGAL PAGES ===== */
.legal-page {
  padding: calc(80px + var(--space-3xl)) 0 var(--space-4xl);
}

.legal-container {
  max-width: 800px;
  margin: 0 auto;
}

.legal-container h1 {
  margin-bottom: var(--space-lg);
}

.legal-container h2 {
  font-size: 1.5rem;
  margin-top: var(--space-2xl);
  margin-bottom: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border-light);
}

.legal-container h2:first-of-type {
  border-top: none;
  padding-top: 0;
}

.legal-container p {
  margin-bottom: var(--space-md);
}

.legal-container ul {
  margin-bottom: var(--space-md);
  padding-left: var(--space-xl);
}

.legal-container li {
  margin-bottom: var(--space-sm);
  color: var(--text-secondary);
}

/* ===== COOKIES TABLE ===== */
.cookies-table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-xl) 0;
  font-size: 0.9rem;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.cookies-table thead {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
}

.cookies-table th {
  padding: var(--space-md) var(--space-lg);
  text-align: left;
  font-weight: 600;
}

.cookies-table td {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-light);
}

.cookies-table tbody tr {
  transition: background var(--transition-fast);
}

.cookies-table tbody tr:hover {
  background: var(--bg-secondary);
}

.cookies-table tbody tr:last-child td {
  border-bottom: none;
}

/* ===== THANK YOU PAGE ===== */
.thank-you-section {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: calc(80px + var(--space-4xl)) var(--space-xl) var(--space-4xl);
}

.thank-you-content {
  max-width: 500px;
}

.thank-you-icon {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, var(--success), #059669);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-xl);
  font-size: 3rem;
  color: white;
  animation: scaleIn 0.5s ease-out;
}

@keyframes scaleIn {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .hero-container,
  .about-grid,
  .contact-grid {
    grid-template-columns: 1fr;
    gap: var(--space-2xl);
  }
  
  .hero-image-wrapper {
    order: -1;
  }
  
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    padding: var(--space-lg);
    box-shadow: var(--shadow-lg);
  }
  
  .nav-links.active {
    display: flex;
  }
  
  .mobile-menu-btn {
    display: block;
  }
  
  .hero {
    padding: calc(80px + var(--space-2xl)) 0 var(--space-2xl);
    min-height: auto;
  }
  
  .hero-buttons {
    flex-direction: column;
  }
  
  .about-stats {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }
  
  .features-grid,
  .services-grid,
  .testimonials-grid {
    grid-template-columns: 1fr;
  }
  
  .footer-grid {
    grid-template-columns: 1fr;
  }
  
  .footer-bottom {
    flex-direction: column;
    text-align: center;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  section {
    padding: var(--space-3xl) 0;
  }
}

/* ===== ANIMATIONS ===== */
.fade-in {
  opacity: 0;
  transform: translateY(30px);
  transition: all 0.6s ease-out;
}

.fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ===== COOKIE BANNER ===== */
.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-dark);
  color: white;
  padding: var(--space-lg) var(--space-xl);
  z-index: 9999;
  display: none;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
}

.cookie-banner.show {
  display: block;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.cookie-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xl);
  flex-wrap: wrap;
}

.cookie-content p {
  color: rgba(255,255,255,0.8);
  margin: 0;
  flex: 1;
}

.cookie-buttons {
  display: flex;
  gap: var(--space-md);
}

.cookie-btn {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-lg);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.cookie-btn-accept {
  background: var(--primary);
  color: white;
}

.cookie-btn-accept:hover {
  background: var(--primary-dark);
}

.cookie-btn-decline {
  background: transparent;
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
}

.cookie-btn-decline:hover {
  background: rgba(255,255,255,0.1);
}
\`\`\`

**JAVASCRIPT - PREMIUM INTERACTIONS (js/script.js):**
\`\`\`javascript
// Mobile menu toggle
function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  navLinks.classList.toggle('active');
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// Cookie consent
document.addEventListener('DOMContentLoaded', () => {
  const cookieBanner = document.querySelector('.cookie-banner');
  const accepted = localStorage.getItem('cookieConsent');
  
  if (!accepted && cookieBanner) {
    setTimeout(() => cookieBanner.classList.add('show'), 1000);
  }
});

function acceptCookies() {
  localStorage.setItem('cookieConsent', 'accepted');
  document.querySelector('.cookie-banner').classList.remove('show');
}

function declineCookies() {
  localStorage.setItem('cookieConsent', 'declined');
  document.querySelector('.cookie-banner').classList.remove('show');
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
\`\`\`

**📸 IMAGE REQUIREMENTS - CRITICAL:**
1. ALL images MUST use valid URLs that will load correctly
2. Use Pexels URLs provided in the image strategy OR Picsum placeholder images
3. NEVER use broken or local file paths for images
4. EVERY image MUST have loading="lazy" attribute
5. EVERY image MUST have descriptive alt text

**CORRECT IMAGE USAGE:**
\`\`\`html
<img src="https://picsum.photos/800/600?random=1" alt="Description" loading="lazy">
<img src="https://images.pexels.com/photos/XXX/pexels-photo-XXX.jpeg" alt="Description" loading="lazy">
\`\`\`

**WRONG (NEVER DO):**
\`\`\`html
<img src="images/hero.jpg"> <!-- WRONG - local path won't work -->
<img src="/assets/image.png"> <!-- WRONG - absolute local path -->
<img src="hero-bg.jpg"> <!-- WRONG - local file -->
\`\`\`

**CSS BACKGROUND IMAGES:**
\`\`\`css
.hero {
    background-image: url('https://picsum.photos/1920/1080?random=hero');
    background-size: cover;
    background-position: center;
}
\`\`\`

**PAGE CONTENT REQUIREMENTS:**
Each page MUST have UNIQUE, SUBSTANTIAL content:
- index.php: Hero section, 3+ feature blocks, about preview, services preview, testimonials, CTA (minimum 500 words)
- about.php: Company story, mission/vision, team section, values (minimum 400 words)
- services.php: 3-6 detailed service descriptions with benefits (minimum 400 words)
- contact.php: Contact form, address, phone, email, working hours, map placeholder (minimum 200 words)
- thank-you.php: Confirmation message, next steps, links back to site (minimum 100 words)

**📜 PRIVACY POLICY PAGE (privacy.php) - MANDATORY 10+ SECTIONS:**
Privacy Policy MUST contain AT LEAST 10 distinct sections with full legal text:
1. Introduction & General Information
2. Data Controller Contact Information
3. Types of Personal Data Collected
4. Purpose of Data Processing
5. Legal Basis for Processing
6. Data Retention Periods
7. Data Sharing with Third Parties
8. International Data Transfers
9. User Rights (Access, Rectification, Erasure, Portability, etc.)
10. Cookie Policy Reference
11. Security Measures (optional but recommended)
12. Changes to Privacy Policy (optional but recommended)
Each section MUST have a heading (h2/h3) and 2-4 paragraphs of detailed legal text.

**📋 TERMS OF SERVICE PAGE (terms.php) - MANDATORY 14 SECTIONS:**
Terms of Service MUST contain EXACTLY 14 distinct sections with full legal text:
1. Acceptance of Terms
2. Definitions
3. User Eligibility
4. Account Registration and Security
5. Permitted Use of Services
6. Prohibited Activities
7. Intellectual Property Rights
8. User-Generated Content
9. Third-Party Links and Services
10. Disclaimers and Limitation of Liability
11. Indemnification
12. Termination
13. Governing Law and Dispute Resolution
14. Contact Information and Notices
Each section MUST have a heading (h2/h3) and 2-4 paragraphs of detailed legal text.

**🍪 COOKIE POLICY PAGE (cookie-policy.php) - MANDATORY WITH COOKIES TABLE:**
Cookie Policy MUST contain:
1. Introduction explaining what cookies are
2. Why we use cookies
3. Types of cookies we use (with explanations)
4. **MANDATORY COOKIES TABLE** with the following columns:
   - Cookie Name
   - Provider
   - Purpose
   - Expiry
   - Type (Essential/Analytics/Marketing/Functional)
   
Example table structure:
\`\`\`html
<table class="cookies-table">
  <thead>
    <tr>
      <th>Cookie Name</th>
      <th>Provider</th>
      <th>Purpose</th>
      <th>Expiry</th>
      <th>Type</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>cookieConsent</td>
      <td><?php echo SITE_NAME; ?></td>
      <td>Stores user's cookie consent preference</td>
      <td>1 year</td>
      <td>Essential</td>
    </tr>
    <!-- Add 5-10 more cookie entries -->
  </tbody>
</table>
\`\`\`
5. How to manage/disable cookies
6. Contact information for cookie-related inquiries
The table MUST include AT LEAST 6-10 different cookies commonly used on websites.

**🌍 LANGUAGE COMPLIANCE - ABSOLUTELY MANDATORY:**
The website MUST be generated in the EXACT language specified in the request. This is NON-NEGOTIABLE:

1. **ALL text content** MUST be in the specified language:
   - Headings, paragraphs, buttons, links, navigation
   - Form labels, placeholders, error messages
   - Footer text, copyright notices
   - Cookie banner text
   - Alt text for images
   - Meta descriptions and page titles

2. **Language code mapping** (use correct language for each code):
   - EN = English (US/UK)
   - DE = German (Deutsch)
   - FR = French (Français)
   - ES = Spanish (Español)
   - IT = Italian (Italiano)
   - PL = Polish (Polski)
   - NL = Dutch (Nederlands)
   - UK/UA = Ukrainian (Українська)
   - PT = Portuguese (Português)
   - CS/CZ = Czech (Čeština)
   - RU = Russian (Русский)
   - TR = Turkish (Türkçe)

3. **NEVER mix languages** - If the site is in German, ALL text must be German

**NAVIGATION LINKS - ABSOLUTELY CRITICAL:**
- ALL navigation links MUST use RELATIVE paths: href="about.php" NOT href="/about"
- EVERY link MUST use .php extension
- Header navigation MUST include links to ALL pages
- Footer MUST include links to key pages

**DESIGN PHILOSOPHY - AGENCY-QUALITY UI:**
- Create STUNNING, POLISHED websites that look expensive
- Use the premium CSS system with animations and transitions
- Apply glass morphism, gradients, and modern effects
- Ensure perfect spacing and visual hierarchy

**🍪 MANDATORY COOKIE SYSTEM:**
Every website MUST include a REAL, FUNCTIONAL cookie consent system that ACTUALLY STORES user choices using localStorage.

**🚫 NUMBERS PROHIBITION - ABSOLUTELY CRITICAL, NON-NEGOTIABLE:**
NEVER include ANY numerical data anywhere on the website. This is a STRICT requirement:

**FORBIDDEN (NEVER USE):**
- Prices, costs, monetary figures ($99, €50, £100, ₴500, etc.)
- Statistics, percentages (95%, 100+, 50% off, etc.)
- Years of experience ("10 years", "Since 2010", etc.)
- Client/project counts ("500+ clients", "1000 projects", etc.)
- Team size numbers ("50 experts", "Team of 20", etc.)
- Ratings and scores ("4.9/5", "5 stars", etc.)
- Time frames with numbers ("24/7", "in 48 hours", etc.)
- Numerical guarantees ("100% satisfaction", "30-day guarantee", etc.)
- Square meters, distances, capacities
- Any forecasts, projections, or numerical predictions
- Countdown timers or numerical deadlines

**ALLOWED ALTERNATIVES (USE THESE INSTEAD):**
- "Contact us for pricing" instead of prices
- "Years of experience" instead of "10 years"
- "Hundreds of satisfied clients" instead of "500+ clients"
- "Our expert team" instead of "Team of 50"
- "Top-rated service" instead of "4.9/5 rating"
- "Fast delivery" instead of "in 24 hours"
- "Satisfaction guaranteed" instead of "100% guarantee"
- "Always available" instead of "24/7"
- "Request a quote" instead of any price
- "Proven track record" instead of statistics

**THE ONLY ALLOWED NUMBERS:**
- Phone numbers (required for contact)
- Postal codes in addresses (required for location)
- Years in copyright footer (e.g., "© 2024")

**THIS RULE IS NON-NEGOTIABLE - ANY NUMERICAL DATA OTHER THAN CONTACT INFO WILL MAKE THE WEBSITE INVALID!**

**⚠️ MANDATORY DISCLAIMER - ABSOLUTELY CRITICAL, NON-NEGOTIABLE:**
Every PHP website MUST include a disclaimer section adapted to the website's theme. This is REQUIRED for Google Ads compliance:

**DISCLAIMER REQUIREMENTS:**
1. Add the disclaimer in includes/footer.php, ABOVE the copyright section
2. The disclaimer MUST be styled to MATCH THE WEBSITE'S DESIGN STYLE:
   - Use colors that complement the site's color palette (can be accent color, muted tone, or contrasting block)
   - Match the typography and spacing of the site
   - Make it visible but harmonious with overall design
   - Can use borders, subtle backgrounds, or other styling that fits the site aesthetic
3. The disclaimer text MUST be ADAPTED to match the website's theme/industry:
   - Keep the core meaning: "content is for general information/education only, not professional advice"
   - Adapt terminology to the specific industry (e.g., "financial advice" for finance, "medical advice" for health, "legal advice" for law, etc.)
   - Always include: not professional advice, consult qualified experts, involves risk, we don't sell [relevant products]

**📞 PHONE NUMBERS - MANDATORY REQUIREMENTS:**
All phone numbers MUST be:
1. **REALISTIC and RANDOM for the specified country** - Generate unique, realistic phone numbers:
   - USA/Canada: +1 (212) 555-0147, +1 (415) 637-8294
   - UK: +44 20 7839 5471, +44 7842 156 923
   - Germany: +49 30 2897 6543, +49 89 4521 7890
   - France: +33 1 42 68 53 00, +33 4 93 45 67 89
   - Italy: +39 06 8745 6321, +39 02 7654 3210
   - Spain: +34 912 456 789, +34 932 876 543
   - Poland: +48 22 456 78 90, +48 12 345 67 89
   - Netherlands: +31 20 794 5682, +31 10 456 7890
   - Ukraine: +380 44 456 7890, +380 67 123 4567
   - Russia: +7 495 123 4567, +7 812 456 7890
2. **CLICKABLE with tel: links**: <a href="tel:+14155550147">+1 (415) 555-0147</a>
3. **NEVER use fake numbers** like 1234567, 0000000, or placeholder XXX

**🏠 ADDRESSES - MANDATORY REQUIREMENTS:**
All physical addresses MUST be realistic and from the specified country/city.

**📧 EMAIL ADDRESSES - MUST MATCH SITE DOMAIN:**
- Email MUST use the site's domain name, NOT generic placeholders
- Format: info@<sitename>.com, contact@<sitename>.com
- Extract sitename from business name (lowercase, no spaces)
- Examples:
  * "Green Garden Services" → info@greengarden.com
  * "Auto Pro Center" → contact@autoprocenter.com
- MUST be clickable: <a href="mailto:info@sitename.com">info@sitename.com</a>
- NEVER use generic emails like info@company.com or test@example.com

**🙏 THANK YOU PAGE - MANDATORY FOR ALL WEBSITES:**
Every PHP website MUST include a thank-you.php page that users see after submitting ANY form:

1. **Create thank-you.php** with:
   - Same header/navigation as other pages (include 'includes/header.php')
   - Hero section with success checkmark icon
   - Thank you heading (in site language)
   - Friendly message explaining next steps
   - Contact info for urgent matters
   - Button to return to homepage: <a href="index.php">Return to Home</a>
   - Same footer as other pages (include 'includes/footer.php')

**CONTENT LENGTH:**
- Total website content: Minimum 2000 words across all pages
- Each main page (index, about, services): Minimum 400 words each
- Rich, detailed descriptions for all sections

**OUTPUT FORMAT:**
Return ONLY a series of file definitions in this format:
--- FILE: path/filename.ext ---
content here
--- END FILE ---

NEVER add explanations outside file blocks. Generate COMPLETE files with full content.
REMEMBER: MINIMUM 6 SEPARATE PHP PAGE FILES ARE REQUIRED!
`.trim();

const IMAGE_STRATEGY_BASIC = `
IMAGE STRATEGY: Basic (Picsum)
- Use https://picsum.photos/WIDTH/HEIGHT for all images
- Example: <img src="https://picsum.photos/800/600" alt="Description">
- Add random seed for variety: https://picsum.photos/seed/unique-id/800/600
- Use appropriate dimensions for each use case (hero: 1920x1080, cards: 600x400, icons: 200x200)

**🏢 BRAND LOGOS - USE REAL LOGOS, NOT PLACEHOLDERS:**
For partner logos, client logos, certification badges, or any brand logos - ALWAYS use real logos from CDN services:

**Logo CDN Sources (use these URLs):**
- https://logo.clearbit.com/[company-domain] - e.g., https://logo.clearbit.com/google.com
- https://cdn.brandfetch.io/[company-domain]/w/400/h/400 - e.g., https://cdn.brandfetch.io/apple.com/w/400/h/400

**Industry-Specific Logo Examples:**
- Tech/Software: google.com, microsoft.com, aws.amazon.com, github.com, stripe.com, slack.com
- E-commerce/Payments: visa.com, mastercard.com, paypal.com, shopify.com, amazon.com
- Shipping/Logistics: dhl.com, fedex.com, ups.com, dpd.com
- Cloud/Hosting: cloudflare.com, digitalocean.com, heroku.com, vercel.com
- Certifications: iso.org, tuv.com, bsigroup.com
- Social: facebook.com, instagram.com, twitter.com, linkedin.com, youtube.com

**Usage in PHP:**
<img src="https://logo.clearbit.com/stripe.com" alt="Stripe" class="partner-logo" loading="lazy">
<img src="https://logo.clearbit.com/visa.com" alt="Visa" class="payment-logo" loading="lazy">

**RULES:**
- NEVER use placeholder logos or generic icons for brand logos
- Choose logos that make sense for the website's industry
- Use 4-8 partner/client logos in "Partners" or "Trusted By" sections
- Include relevant payment logos on e-commerce sites
- Add certification logos for professional services
`;

async function fetchPexelsPhotos(query: string, count = 5): Promise<string[]> {
  const pexelsKey = Deno.env.get("PEXELS_API_KEY");
  if (!pexelsKey) return [];
  
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: pexelsKey } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.photos || []).map((p: any) => p.src?.large || p.src?.original);
  } catch {
    return [];
  }
}

async function extractKeywordsAI(prompt: string): Promise<string[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return extractKeywordsFallback(prompt);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Extract 3-5 keywords from the user's website description that would be good search terms for finding relevant stock photos. Return ONLY a JSON array of strings, nothing else."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
      }),
    });

    if (!resp.ok) return extractKeywordsFallback(prompt);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const keywords = JSON.parse(content);
    return Array.isArray(keywords) ? keywords : extractKeywordsFallback(prompt);
  } catch {
    return extractKeywordsFallback(prompt);
  }
}

function extractKeywordsFallback(prompt: string): string[] {
  const commonWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "need", "want", "сайт", "website", "page", "create", "make", "build", "design"]);
  
  const words = prompt.toLowerCase()
    .replace(/[^a-zA-Zа-яА-ЯіІїЇєЄ\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.has(w));
  
  return [...new Set(words)].slice(0, 5);
}

async function buildPexelsImageStrategy(prompt: string): Promise<string> {
  const keywords = await extractKeywordsAI(prompt);
  console.log("Extracted keywords for Pexels:", keywords);
  
  const allUrls: string[] = [];
  for (const keyword of keywords) {
    const urls = await fetchPexelsPhotos(keyword, 3);
    allUrls.push(...urls);
  }
  
  if (allUrls.length === 0) {
    return IMAGE_STRATEGY_BASIC;
  }
  
  return `
IMAGE STRATEGY: Pexels (High Quality)
Use these SPECIFIC image URLs throughout the website:
${allUrls.map((url, i) => `- Image ${i + 1}: ${url}`).join("\n")}

For additional images beyond these, use https://picsum.photos/WIDTH/HEIGHT
`;
}

const IMAGE_CSS = `
/* Essential image CSS - include in style.css */
img {
  max-width: 100%;
  height: auto;
  display: block;
}

.hero-image {
  width: 100%;
  height: 60vh;
  object-fit: cover;
}

.card-image {
  width: 100%;
  height: 250px;
  object-fit: cover;
  border-radius: 8px;
}

.feature-icon {
  width: 80px;
  height: 80px;
  object-fit: contain;
}
`;

// Token pricing per model (input/output per 1M tokens)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "google/gemini-2.5-pro": { input: 2.5, output: 15 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
};

interface GeneratedFile {
  path: string;
  content: string;
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

function calculateCost(usage: TokenUsage, model: string): number {
  const pricing = TOKEN_PRICING[model] || TOKEN_PRICING["gpt-4o-mini"];
  const inputCost = ((usage.prompt_tokens || 0) / 1_000_000) * pricing.input;
  const outputCost = ((usage.completion_tokens || 0) / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

interface GenerationResult {
  success: boolean;
  files?: GeneratedFile[];
  refinedPrompt?: string;
  totalFiles?: number;
  fileList?: string[];
  error?: string;
  totalCost?: number;
  specificModel?: string;
}

function cleanFileContent(content: string): string {
  return content
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .trim();
}

function parseFilesFromModelText(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const regex = /---\s*FILE:\s*(.+?)\s*---\n([\s\S]*?)(?=---\s*(?:FILE:|END FILE)|\s*$)/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const path = match[1].trim();
    const content = cleanFileContent(match[2]);
    if (path && content) {
      files.push({ path, content });
    }
  }

  return files;
}

async function runGeneration({
  prompt,
  language,
  aiModel,
  layoutStyle,
  imageSource = "basic",
  siteName,
}: {
  prompt: string;
  language?: string;
  aiModel: "junior" | "senior";
  layoutStyle?: string;
  imageSource?: "basic" | "ai";
  siteName?: string;
}): Promise<GenerationResult> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!lovableApiKey && !openaiKey) {
    return { success: false, error: "No API key configured (LOVABLE_API_KEY or OPENAI_API_KEY)" };
  }

  // Use Lovable AI for better quality generation
  const useLovableAI = !!lovableApiKey;
  
  // Determine which model to use
  const refineModel = useLovableAI ? "google/gemini-2.5-flash" : "gpt-4o-mini";
  const generateModel = useLovableAI 
    ? (aiModel === "senior" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash")
    : (aiModel === "senior" ? "gpt-4o" : "gpt-4o-mini");

  console.log(`PHP Generation using: Refine=${refineModel}, Generate=${generateModel}, Lovable AI=${useLovableAI}`);

  // 1. Refine the prompt
  const languageInstruction = language
    ? `\n\nIMPORTANT: The website MUST be in ${language}. All text, buttons, navigation, and content should be in this language.`
    : "";

  // Add site name instruction if provided
  const siteNameInstruction = siteName
    ? `\n\nCRITICAL SITE NAME REQUIREMENT: The website/business/brand name MUST be "${siteName}". Use this EXACT name in the logo, header, footer, page titles, meta tags, copyright, and all references to the business. Do NOT invent a different name.`
    : "";

  // API call helper for Lovable AI or OpenAI
  const makeAPICall = async (
    systemContent: string,
    userContent: string,
    maxTokens: number,
    model: string,
    opts?: { timeoutMs?: number; temperature?: number }
  ) => {
    const timeoutMs = opts?.timeoutMs ?? 120_000;
    const temperature = opts?.temperature ?? 0.7;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = useLovableAI
        ? "https://ai.gateway.lovable.dev/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

      const apiKey = useLovableAI ? lovableApiKey : openaiKey;
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_tokens: maxTokens,
      };

      // OpenAI supports temperature; gateway is OpenAI-compatible, so this is safe here.
      if (!useLovableAI) body.temperature = temperature;
      else body.temperature = temperature;

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      return resp;
    } finally {
      clearTimeout(timeout);
    }
  };

  const refineResponse = await makeAPICall(
    SYSTEM_PROMPT + languageInstruction + siteNameInstruction,
    prompt + siteNameInstruction,
    1000,
    refineModel,
    { timeoutMs: 90_000, temperature: 0.3 }
  );

  if (!refineResponse.ok) {
    const errText = await refineResponse.text();
    console.error("Refine API error:", errText);
    return { success: false, error: `Prompt refinement failed: ${errText}` };
  }

  // Defensive JSON parsing (prevents "Unexpected end of JSON input" from leaving jobs stuck)
  let refineData: any;
  try {
    const raw = await refineResponse.text();
    refineData = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Refine API JSON parse error:", e);
    return { success: false, error: "Prompt refinement failed: invalid JSON response" };
  }

  const refinedPrompt = refineData?.choices?.[0]?.message?.content || prompt;
  const refineUsage = refineData?.usage || {};
  const refineCost = calculateCost(refineUsage, refineModel);

  console.log(
    `💰 Token usage for ${refineModel}: ${refineUsage.prompt_tokens || 0} in, ${refineUsage.completion_tokens || 0} out = $${refineCost.toFixed(6)}`
  );
  console.log("Refined prompt:", refinedPrompt.substring(0, 200) + "...");

  // 2. Select layout variation
  let layoutDescription = "";
  if (layoutStyle) {
    const selectedLayout = LAYOUT_VARIATIONS.find(l => l.id === layoutStyle);
    if (selectedLayout) {
      layoutDescription = `\n\n${selectedLayout.description}`;
    }
  } else {
    // Random layout
    const randomLayout = LAYOUT_VARIATIONS[Math.floor(Math.random() * LAYOUT_VARIATIONS.length)];
    layoutDescription = `\n\n${randomLayout.description}`;
  }

  // 3. Build image strategy
  let imageStrategy = IMAGE_STRATEGY_BASIC;
  if (imageSource === "ai") {
    imageStrategy = await buildPexelsImageStrategy(prompt);
  }

  const requiredPaths = [
    "includes/config.php",
    "includes/header.php",
    "includes/footer.php",
    "index.php",
    "about.php",
    "services.php",
    "contact.php",
    "form-handler.php",
    "thank-you.php",
    "privacy.php",
    "terms.php",
    "cookie-policy.php",
    "css/style.css",
    "js/script.js",
  ];

  const validateFiles = (files: GeneratedFile[]) => {
    const paths = new Set(files.map((f) => f.path));
    const missing = requiredPaths.filter((p) => !paths.has(p));
    // Guard against "nothingburger" files: if the file exists but is extremely short, treat as invalid.
    const tooShort = files
      .filter((f) => requiredPaths.includes(f.path))
      .filter((f) => f.content.trim().length < 50)
      .map((f) => f.path);

    return { missing, tooShort };
  };

  const generateOnce = async (opts: { strictFormat: boolean; timeoutMs?: number }) => {
    // Reduced timeout: 120s default to leave room for retry within edge function limits
    const timeoutMs = opts.timeoutMs ?? 120_000; // 2 minutes default
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`⏰ Generation timeout after ${timeoutMs / 1000}s`);
      controller.abort();
    }, timeoutMs);

    const strictFormatBlock = opts.strictFormat
      ? `\n\nSTRICT OUTPUT FORMAT (MANDATORY):\n- Output ONLY file blocks in this exact format. No commentary, no markdown headings.\n\n--- FILE: includes/config.php ---\n<file contents>\n--- END FILE ---\n\n--- FILE: includes/header.php ---\n<file contents>\n--- END FILE ---\n\n(Repeat for every file.)\n\nIf you cannot comply, output nothing.`
      : "";

    const systemContent = PHP_GENERATION_PROMPT + layoutDescription + "\n\n" + imageStrategy + "\n\n" + IMAGE_CSS;
    const userContent = `Create a COMPLETE, FULLY FUNCTIONAL multi-page PHP website based on this brief:\n\n${refinedPrompt}\n\nCRITICAL GENERATION CHECKLIST - YOU MUST INCLUDE ALL:\n✅ includes/config.php - Site constants (SITE_NAME, SITE_EMAIL, SITE_PHONE, SITE_ADDRESS)\n✅ includes/header.php - Full HTML head, navigation with links to ALL pages\n✅ includes/footer.php - Footer with disclaimer, copyright, links\n✅ index.php - Homepage with hero, features, services preview, testimonials, CTA (FULL CONTENT)\n✅ about.php - About page with mission, team, values (FULL CONTENT)\n✅ services.php - Services/Products page with detailed descriptions (FULL CONTENT)\n✅ contact.php - Contact form with method=\"POST\" action=\"form-handler.php\"\n✅ form-handler.php - Form processor that redirects to thank-you.php\n✅ thank-you.php - Thank you page after form submission\n✅ privacy.php - Privacy Policy with 10+ sections (Introduction, Data Controller, Data Types, Purpose, Legal Basis, Retention, Sharing, International Transfers, User Rights, Cookie Reference)\n✅ terms.php - Terms of Service with 14 sections (Acceptance, Definitions, Eligibility, Account, Permitted Use, Prohibited, IP Rights, User Content, Third-Party, Disclaimers, Indemnification, Termination, Governing Law, Contact)\n✅ cookie-policy.php - Cookie Policy with cookies table (Cookie Name, Provider, Purpose, Expiry, Type) - minimum 6-10 cookies\n✅ css/style.css - Complete CSS with responsive design, mobile menu, cookies table styling\n✅ js/script.js - JavaScript for mobile menu, interactions\n\nEach page MUST have SUBSTANTIAL, UNIQUE content (not placeholders).\nGenerate COMPLETE files with full HTML, CSS, and PHP code.\nUse proper PHP includes on every page.${strictFormatBlock}`;

    try {
      let generateResponse: Response;
      const startTime = Date.now();
      console.log(`🚀 Starting generation with ${generateModel} (timeout: ${timeoutMs / 1000}s)...`);
      
      if (useLovableAI) {
        generateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: generateModel,
            messages: [
              { role: "system", content: systemContent },
              { role: "user", content: userContent },
            ],
            max_tokens: 32000,
          }),
          signal: controller.signal,
        });
        console.log(`✅ Generation API responded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      } else {
        generateResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: generateModel,
            messages: [
              { role: "system", content: systemContent },
              { role: "user", content: userContent },
            ],
            max_tokens: 16000,
            temperature: opts.strictFormat ? 0.4 : 0.6,
          }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!generateResponse.ok) {
        const errText = await generateResponse.text();
        console.error("Generate API error:", errText);
        return { ok: false as const, error: `Website generation failed: ${errText}` };
      }

      let generateData: any;
      try {
        const raw = await generateResponse.text();
        generateData = raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error("Generate API JSON parse error:", e);
        return { ok: false as const, error: "Website generation failed: invalid JSON response" };
      }

      const generatedText = generateData?.choices?.[0]?.message?.content || "";
      const genUsage = generateData?.usage || {};
      const generateCost = calculateCost(genUsage, generateModel);

      console.log(
        `💰 Token usage for ${generateModel}: ${genUsage.prompt_tokens || 0} in, ${genUsage.completion_tokens || 0} out = $${generateCost.toFixed(6)}`
      );

      // Parse
      const files = parseFilesFromModelText(generatedText);
      console.log(`Parsed ${files.length} files from generation`);

      return { ok: true as const, files, generateCost };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        console.error(`Generation aborted due to timeout (${timeoutMs / 1000}s)`);
        return { ok: false as const, error: `Generation timed out after ${timeoutMs / 1000} seconds` };
      }
      console.error("Generate unexpected error:", err);
      return { ok: false as const, error: `Generation failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  };

  // 4. Generate the PHP website (retry on JSON errors or incomplete files)
  let first = await generateOnce({ strictFormat: false });

  // Auto-retry once on invalid JSON error
  if (!first.ok && first.error?.includes("invalid JSON")) {
    console.warn("Retrying PHP generation due to invalid JSON response...");
    first = await generateOnce({ strictFormat: false });
  }

  if (!first.ok) return { success: false, error: first.error };

  let files = first.files;
  let generateCost = first.generateCost;

  // If model returned something parseable but incomplete/empty-ish, retry once with stricter format.
  const v1 = validateFiles(files);
  let retryAttempted = false;
  let retryError: string | null = null;
  
  if (files.length === 0 || v1.missing.length > 0 || v1.tooShort.length > 0) {
    console.warn(
      `PHP generation invalid on attempt #1. Files: ${files.length}, Missing: ${v1.missing.join(", ")}; Too short: ${v1.tooShort.join(", ")}`
    );
    retryAttempted = true;

    try {
      // Retry with shorter timeout (60s) and strict format
      const second = await generateOnce({ strictFormat: true, timeoutMs: 60_000 });
      if (second.ok) {
        const v2 = validateFiles(second.files);
        console.log(`Retry attempt result: ${second.files.length} files, Missing: ${v2.missing.join(", ")}, Too short: ${v2.tooShort.join(", ")}`);
        
        // Use second result if it's better (more files or fewer issues)
        if (second.files.length > files.length || 
            (v2.missing.length < v1.missing.length) || 
            (v2.missing.length === 0 && v2.tooShort.length === 0)) {
          files = second.files;
          generateCost = second.generateCost;
          console.log(`Using retry result: ${files.length} files`);
        } else {
          console.log(`Keeping first result as it's not worse: ${files.length} files`);
        }
      } else {
        retryError = second.error || "Retry failed";
        console.error(`Retry failed: ${retryError}`);
      }
    } catch (retryErr) {
      retryError = retryErr instanceof Error ? retryErr.message : "Retry exception";
      console.error(`Retry exception: ${retryError}`);
    }
  }

  // Graceful degradation: accept results with minor issues
  const finalValidation = validateFiles(files);
  const criticalFiles = ["index.php", "includes/header.php", "includes/footer.php", "css/style.css"];
  const missingCritical = finalValidation.missing.filter(f => criticalFiles.includes(f));
  
  const totalCost = refineCost + generateCost;
  console.log(
    `Generation costs: Refine=$${refineCost.toFixed(4)}, Generate=$${generateCost.toFixed(4)}, Total=$${totalCost.toFixed(4)}`
  );

  if (files.length === 0) {
    return { success: false, error: `Failed to parse generated files${retryAttempted ? ` (retry also failed: ${retryError})` : ""}` };
  }

  // If we have 6+ files and no critical files missing, accept with warning
  if (files.length >= 6 && missingCritical.length === 0) {
    if (finalValidation.missing.length > 0 || finalValidation.tooShort.length > 0) {
      console.warn(`⚠️ Accepting partial result: ${files.length} files`);
      console.warn(`  - Missing non-critical: ${finalValidation.missing.join(", ") || "none"}`);
      console.warn(`  - Too short: ${finalValidation.tooShort.join(", ") || "none"}`);
    }
    // Continue with partial result
  } else if (missingCritical.length > 0 || files.length < 6) {
    // Only fail if critical files are missing or very few files generated
    console.error(`Final validation failed after ${retryAttempted ? "retry" : "first attempt"}:`);
    console.error(`- Files generated: ${files.length} (${files.map(f => f.path).join(", ")})`);
    console.error(`- Missing critical: ${missingCritical.join(", ")}`);
    console.error(`- Missing all: ${finalValidation.missing.join(", ")}`);
    console.error(`- Too short: ${finalValidation.tooShort.join(", ")}`);
    
    return {
      success: false,
      error: `Generation incomplete. Missing critical files: ${missingCritical.join(", ") || "none"}. Total files: ${files.length}.`,
    };
  }
  const normalizePaths = (files: GeneratedFile[]) =>
    files.map((f) => ({ ...f, path: f.path.replace(/^\/+/, "").trim() }));

  // Ensure contact form flow works (contact.php -> form-handler.php -> thank-you.php)
  const ensureContactFlow = (files: GeneratedFile[]): GeneratedFile[] => {
    const next = [...files];

    const findIndex = (path: string) => next.findIndex((f) => f.path === path);
    const upsert = (path: string, content: string) => {
      const idx = findIndex(path);
      if (idx >= 0) next[idx] = { path, content };
      else next.push({ path, content });
    };

    const contactIdx = findIndex("contact.php");
    if (contactIdx >= 0) {
      let c = next[contactIdx].content;

      if (/<form\b/i.test(c)) {
        // enforce method="POST"
        if (!/method\s*=\s*"post"/i.test(c)) {
          if (/method\s*=\s*"[^"]*"/i.test(c)) c = c.replace(/method\s*=\s*"[^"]*"/i, 'method="POST"');
          else c = c.replace(/<form\b/i, '<form method="POST"');
        }

        // enforce action="form-handler.php"
        if (!/action\s*=\s*"form-handler\.php"/i.test(c)) {
          if (/action\s*=\s*"[^"]*"/i.test(c)) c = c.replace(/action\s*=\s*"[^"]*"/i, 'action="form-handler.php"');
          else c = c.replace(/<form\b/i, '<form action="form-handler.php"');
        }
      }

      next[contactIdx] = { ...next[contactIdx], content: c };
    }

    // Ensure handler exists and redirects reliably
    if (findIndex("form-handler.php") === -1) {
      upsert(
        "form-handler.php",
        `<?php\nif ($_SERVER['REQUEST_METHOD'] === 'POST') {\n  $name = htmlspecialchars(trim($_POST['name'] ?? ''));\n  $email = filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);\n  $phone = htmlspecialchars(trim($_POST['phone'] ?? ''));\n  $subject = htmlspecialchars(trim($_POST['subject'] ?? ''));\n  $message = htmlspecialchars(trim($_POST['message'] ?? ''));\n\n  $isValid = !empty($name) && filter_var($email, FILTER_VALIDATE_EMAIL) && !empty($subject) && !empty($message);\n\n  if ($isValid) {\n    header('Location: thank-you.php');\n    exit;\n  }\n\n  header('Location: contact.php?error=1');\n  exit;\n}\n\nheader('Location: contact.php');\nexit;\n?>`
      );
    }

    // Ensure thank-you exists (some generations forget it)
    if (findIndex("thank-you.php") === -1) {
      upsert(
        "thank-you.php",
        `<?php\n$page_title = 'Thank You';\ninclude 'includes/header.php';\n?>\n\n<section class="page-hero">\n  <div class="container">\n    <h1>Thank you!</h1>\n    <p>Your message has been received. We'll get back to you shortly.</p>\n    <a class="btn" href="index.php">Back to Home</a>\n  </div>\n</section>\n\n<?php include 'includes/footer.php'; ?>`
      );
    }

    return next;
  };

  // Ensure cookie banner exists
  const ensureCookieBanner = (files: GeneratedFile[]): GeneratedFile[] => {
    const hasCookieJs = files.some((f) => f.path.includes("cookie"));

    if (!hasCookieJs) {
      files.push({
        path: "js/cookie-banner.js",
        content: `// Cookie Consent Banner\ndocument.addEventListener('DOMContentLoaded', function() {\n  const cookieConsent = localStorage.getItem('cookieConsent');\n  if (!cookieConsent) {\n    showCookieBanner();\n  }\n});\n\nfunction showCookieBanner() {\n  const banner = document.createElement('div');\n  banner.id = 'cookie-banner';\n  banner.innerHTML = \`\n    <div style="position: fixed; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.9); color: white; padding: 1rem; z-index: 9999; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">\n      <p style="margin: 0; flex: 1;">We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.</p>\n      <div style="display: flex; gap: 0.5rem;">\n        <button onclick="acceptCookies()" style="background: #4CAF50; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;">Accept</button>\n        <button onclick="declineCookies()" style="background: #666; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;">Decline</button>\n      </div>\n    </div>\n  \`;\n  document.body.appendChild(banner);\n}\n\nfunction acceptCookies() {\n  localStorage.setItem('cookieConsent', 'accepted');\n  document.getElementById('cookie-banner')?.remove();\n}\n\nfunction declineCookies() {\n  localStorage.setItem('cookieConsent', 'declined');\n  document.getElementById('cookie-banner')?.remove();\n}\n`,
      });
    }

    // Ensure all PHP files include cookie banner script
    return files.map((file) => {
      if (!file.path.endsWith(".php")) return file;

      let content = file.content;
      const hasCookieScript =
        content.includes("cookie-banner.js") ||
        content.includes("cookie-banner") ||
        content.includes("cookieConsent");

      if (!hasCookieScript && content.includes("</body>")) {
        content = content.replace(
          "</body>",
          '  <script src="js/cookie-banner.js"></script>\n</body>'
        );
      }

      return { ...file, content };
    });
  };

  const normalized = normalizePaths(files);
  const withContact = ensureContactFlow(normalized);
  const finalFiles = ensureCookieBanner(withContact);
  console.log(`Final files count: ${finalFiles.length}`);

  return {
    success: true,
    files: finalFiles,
    refinedPrompt,
    totalFiles: finalFiles.length,
    fileList: finalFiles.map((f) => f.path),
    totalCost,
    specificModel: generateModel,
  };
}

async function runBackgroundGeneration(
  historyId: string,
  userId: string,
  prompt: string,
  language: string | undefined,
  aiModel: "junior" | "senior",
  layoutStyle?: string,
  imageSource: "basic" | "ai" = "basic",
  teamId: string | null = null,
  salePrice: number = 0
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[BG] Starting PHP background generation for history ID: ${historyId}, team: ${teamId}, salePrice: $${salePrice}`);

  try {
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    const result = await runGeneration({ prompt, language, aiModel, layoutStyle, imageSource });

    if (result.success && result.files) {
      const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
      const zip = new JSZip();
      result.files.forEach((file) => zip.file(file.path, file.content));
      const zipBase64 = await zip.generateAsync({ type: "base64" });

      const generationCost = result.totalCost || 0;
      await supabase
        .from("generation_history")
        .update({
          status: "completed",
          files_data: result.files,
          zip_data: zipBase64,
          generation_cost: generationCost,
          specific_ai_model: result.specificModel || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", historyId);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_complete",
        title: "PHP сайт згенеровано",
        message: `PHP сайт успішно створено (${result.files.length} файлів)`,
        data: { historyId, filesCount: result.files.length }
      });

      console.log(`[BG] PHP Generation completed for ${historyId}: ${result.files.length} files, sale: $${salePrice}, cost: $${generationCost.toFixed(4)}`);
    } else {
      // REFUND balance on failure
      if (teamId && salePrice > 0) {
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", teamId)
          .single();

        if (team) {
          await supabase
            .from("teams")
            .update({ balance: (team.balance || 0) + salePrice })
            .eq("id", teamId);
          console.log(`[BG] REFUNDED $${salePrice} to team ${teamId} due to failure`);
        }
      }

      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "Generation failed",
          sale_price: 0,
        })
        .eq("id", historyId);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_failed",
        title: "Помилка генерації PHP",
        message: result.error || "Не вдалося згенерувати PHP сайт",
        data: { historyId, error: result.error }
      });

      console.error(`[BG] PHP Generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] PHP Background generation error for ${historyId}:`, error);

    if (teamId && salePrice > 0) {
      try {
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", teamId)
          .single();

        if (team) {
          await supabase
            .from("teams")
            .update({ balance: (team.balance || 0) + salePrice })
            .eq("id", teamId);
          console.log(`[BG] REFUNDED $${salePrice} to team ${teamId} due to error`);
        }
      } catch (refundError) {
        console.error(`[BG] Failed to refund:`, refundError);
      }
    }

    await supabase
      .from("generation_history")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        sale_price: 0,
      })
      .eq("id", historyId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("Request rejected: No authorization header");
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT using getClaims for more reliable token validation
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log("Authenticated PHP generation request from user:", userId);

    const { prompt, originalPrompt, improvedPrompt, language, aiModel = "senior", layoutStyle, siteName, imageSource = "basic", teamId: overrideTeamId, geo } = await req.json();

    // Build prompt with language and geo context if provided
    let promptForGeneration = prompt;
    
    // Add language instruction FIRST (critical for content generation)
    if (language && language !== "auto") {
      const languageNames: Record<string, string> = {
        en: "English", uk: "Ukrainian", ru: "Russian", de: "German", fr: "French",
        es: "Spanish", it: "Italian", pt: "Portuguese", pl: "Polish", nl: "Dutch",
        cs: "Czech", bg: "Bulgarian", ro: "Romanian", hu: "Hungarian", tr: "Turkish",
        ja: "Japanese", vi: "Vietnamese", th: "Thai", id: "Indonesian", hi: "Hindi",
        ar: "Arabic", el: "Greek", fi: "Finnish", sv: "Swedish", da: "Danish",
        hr: "Croatian", sk: "Slovak", sl: "Slovenian", et: "Estonian", lv: "Latvian", lt: "Lithuanian"
      };
      const langName = languageNames[language] || language;
      promptForGeneration = `[TARGET LANGUAGE: ${langName}]
CRITICAL LANGUAGE REQUIREMENT - ALL CONTENT MUST BE IN ${langName.toUpperCase()}:
- ALL text on ALL pages must be written in ${langName}
- Navigation menu items in ${langName}
- All headings, paragraphs, buttons, form labels in ${langName}
- Footer text, copyright notice in ${langName}
- Privacy Policy, Terms of Service, Cookie Policy - ALL in ${langName}
- Meta titles and descriptions in ${langName}
- Error messages and form validation in ${langName}
- DO NOT use any other language unless specifically requested

${promptForGeneration}`;
    }
    
    if (geo && geo !== "none") {
      const geoNames: Record<string, string> = {
        uk: "United Kingdom", bg: "Bulgaria", cz: "Czech Republic", de: "Germany",
        es: "Spain", fr: "France", hu: "Hungary", it: "Italy", pl: "Poland",
        pt: "Portugal", ro: "Romania", tr: "Turkey", nl: "Netherlands", ru: "Russia",
        jp: "Japan", ua: "Ukraine", hr: "Croatia", dk: "Denmark", ee: "Estonia",
        fi: "Finland", gr: "Greece", lv: "Latvia", lt: "Lithuania", sk: "Slovakia",
        si: "Slovenia", se: "Sweden", vn: "Vietnam", th: "Thailand", id: "Indonesia",
        in: "India", ae: "United Arab Emirates", us: "United States"
      };
      const countryName = geoNames[geo];
      if (countryName) {
        promptForGeneration = `${prompt}\n\n[TARGET COUNTRY: ${countryName}]
CRITICAL GEO REQUIREMENTS - ALL CONTENT MUST BE LOCALIZED FOR ${countryName.toUpperCase()}:

1. **PHYSICAL ADDRESS**: Generate a REALISTIC address from ${countryName}:
   - Use REAL street names that exist in ${countryName}
   - Use correct postal/ZIP code format for ${countryName}
   - Use a major city from ${countryName}
   - Example addresses by country:
     * Germany: Friedrichstraße 147, 10117 Berlin
     * Poland: ul. Nowy Świat 47, 00-042 Warszawa
     * Spain: Calle Serrano 47, 28001 Madrid
     * France: 47 Rue du Faubourg Saint-Honoré, 75008 Paris
     * Italy: Via del Corso 147, 00186 Roma
     * UK: 47 King's Road, London SW3 4ND
     * USA: 847 Madison Avenue, New York, NY 10065
     * Netherlands: Herengracht 147, 1015 BH Amsterdam
     * Czech Republic: Václavské náměstí 47, 110 00 Praha 1
     * Portugal: Avenida da Liberdade 147, 1250-096 Lisboa

2. **PHONE NUMBER**: Generate REALISTIC phone number (NOT placeholders like XXXXXXXX or 12345):
   - Germany: +49 30 2897 6543 or +49 89 4521 7890
   - Poland: +48 22 456 78 90 or +48 12 345 67 89
   - Spain: +34 912 456 789 or +34 932 876 543
   - France: +33 1 42 68 53 00 or +33 4 93 45 67 89
   - Italy: +39 06 8745 6321 or +39 02 7654 3210
   - UK: +44 20 7946 0958 or +44 161 496 0753
   - USA: +1 (212) 555-0147 or +1 (415) 555-0198
   - Netherlands: +31 20 794 5682 or +31 10 456 7890
   - Czech Republic: +420 221 456 789 or +420 257 891 234
   - Ukraine: +380 44 456 7890 or +380 67 123 4567
   - Russia: +7 495 123 4567 or +7 812 456 7890
   - Portugal: +351 21 456 7890 or +351 22 345 6789

3. **EMAIL**: Create email based on business name/domain:
   - Format: info@<businessname>.com (lowercase, no spaces)
   - Example: "Green Garden" → info@greengarden.com

4. **BUSINESS CONTEXT**: All content should feel native to ${countryName} market
5. **DO NOT** use addresses or phone numbers from other countries
6. The address MUST appear in the contact section and footer`;
      }
    }
    
    const promptToSave = originalPrompt || prompt;
    const improvedPromptToSave = improvedPrompt || null;

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine team and deduct balance
    let teamId: string | null = overrideTeamId || null;
    let salePrice = 0;

    if (!teamId) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      if (membership) {
        teamId = membership.team_id;
      }
    }

    // Get pricing and DEDUCT balance IMMEDIATELY
    if (teamId) {
      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("html_price")
        .eq("team_id", teamId)
        .maybeSingle();

      // Use HTML price for PHP (same as HTML)
      salePrice = pricing?.html_price || 0;
      
      if (imageSource === "ai") {
        salePrice += 2;
        console.log(`Added $2 for AI photo search. Total salePrice: $${salePrice}`);
      }

      if (salePrice > 0) {
        const { data: team } = await supabase
          .from("teams")
          .select("balance, credit_limit")
          .eq("id", teamId)
          .single();

        if (team) {
          const currentBalance = team.balance || 0;
          const creditLimit = team.credit_limit || 0;
          const newBalance = currentBalance - salePrice;
          
          if (newBalance < -creditLimit) {
            console.log(`🚫 BLOCKED: Team ${teamId} would exceed credit limit.`);
            return new Response(JSON.stringify({ 
              success: false, 
              error: `Перевищено кредитний ліміт. Поточний баланс: $${currentBalance.toFixed(2)}, вартість: $${salePrice}, ліміт: $${creditLimit}. Поповніть баланс для продовження.` 
            }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          await supabase
            .from("teams")
            .update({ balance: newBalance })
            .eq("id", teamId);
          console.log(`💰 IMMEDIATELY deducted $${salePrice} from team ${teamId} for PHP generation. New balance: $${newBalance}`);
        }
      }
    }

    // Create history entry
    const { data: historyEntry, error: insertError } = await supabase
      .from("generation_history")
      .insert({
        prompt: promptToSave,
        improved_prompt: improvedPromptToSave,
        language: language || "auto",
        user_id: userId,
        team_id: teamId || null,
        status: "pending",
        ai_model: aiModel,
        website_type: "php",
        site_name: siteName || null,
        image_source: imageSource || "basic",
        sale_price: salePrice,
        geo: geo || null,
      })
      .select()
      .single();

    if (insertError || !historyEntry) {
      console.error("Failed to create history entry:", insertError);
      // REFUND if we already deducted
      if (teamId && salePrice > 0) {
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", teamId)
          .single();
        if (team) {
          await supabase
            .from("teams")
            .update({ balance: (team.balance || 0) + salePrice })
            .eq("id", teamId);
          console.log(`REFUNDED $${salePrice} to team ${teamId} due to history creation failure`);
        }
      }
      return new Response(JSON.stringify({ success: false, error: "Failed to start generation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Created PHP history entry:", historyEntry.id);

    // Run generation synchronously so the client immediately receives files
    // (UI expects files in the response; background-only runs result in “empty” output)
    let result: GenerationResult;
    try {
      result = await runGeneration({
        prompt: promptForGeneration,
        language,
        aiModel,
        layoutStyle,
        imageSource,
        siteName,
      });
    } catch (e) {
      console.error("PHP generation threw:", e);
      result = {
        success: false,
        error: e instanceof Error ? e.message : "PHP generation failed (unexpected error)",
      };
    }

    if (!result.success || !result.files) {
      // Mark failed + refund (if deducted)
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "PHP generation failed",
          sale_price: 0,
        })
        .eq("id", historyEntry.id);

      if (teamId && salePrice > 0) {
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", teamId)
          .single();
        if (team) {
          await supabase
            .from("teams")
            .update({ balance: (team.balance || 0) + salePrice })
            .eq("id", teamId);
        }
      }

      return new Response(JSON.stringify({ success: false, error: result.error || "PHP generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save completed result into history for later downloads
    try {
      const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
      const zip = new JSZip();
      for (const file of result.files) {
        zip.file(file.path, file.content);
      }
      const zipBase64 = await zip.generateAsync({ type: "base64" });

      await supabase
        .from("generation_history")
        .update({
          status: "completed",
          files_data: result.files,
          zip_data: zipBase64,
          error_message: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", historyEntry.id);
    } catch (e) {
      console.warn("Failed to persist zip/files_data for PHP generation:", e);
      // Still return files to client even if persistence fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        historyId: historyEntry.id,
        files: result.files,
        refinedPrompt: result.refinedPrompt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
