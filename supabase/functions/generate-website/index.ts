import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a prompt refiner for professional, multi-page websites.

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

const HTML_GENERATION_PROMPT = `CRITICAL: CREATE A PREMIUM, CONTENT-RICH PROFESSIONAL WEBSITE

🚨🚨🚨 REFERENCE QUALITY STANDARD - FOLLOW THIS STRUCTURE 🚨🚨🚨

📞📧🚨 CONTACT INFO - ABSOLUTELY MANDATORY - READ FIRST! 🚨📧📞
EVERY website MUST have a REAL phone number and email. NO EXCEPTIONS!

**PHONE NUMBER - REQUIRED IN FOOTER ONLY:**
- MUST appear in FOOTER on ALL pages (NOT in header!)
- MUST be realistic for the country/GEO (see examples below)
- MUST be clickable: <a href="tel:+491234567890">+49 123 456 7890</a>
- NEVER use fake numbers like 123456, 555-1234, XXX, or placeholders
- Examples by country:
  * Germany: +49 30 2897 6543, +49 89 4521 7890, +49 221 456 7891
  * Poland: +48 22 456 78 90, +48 12 345 67 89, +48 71 234 56 78
  * Spain: +34 912 456 789, +34 932 876 543, +34 954 321 654
  * France: +33 1 42 68 53 00, +33 4 93 45 67 89
  * Italy: +39 06 8745 6321, +39 02 7654 3210
  * UK: +44 20 7946 0958, +44 161 496 0753
  * USA: +1 (212) 456-7890, +1 (415) 789-0123
  * Netherlands: +31 20 794 5682, +31 10 456 7890
  * Czech Republic: +420 221 456 789, +420 257 891 234
  * Ukraine: +380 44 456 7890, +380 67 123 4567
  * Russia: +7 495 123 4567, +7 812 456 7890
  * Austria: +43 1 234 5678, +43 512 345 678

**EMAIL - REQUIRED IN FOOTER ONLY:**
- MUST appear in FOOTER on ALL pages (NOT in header!)
- MUST use the site's domain: info@<sitename>.com, contact@<sitename>.com
- Extract domain from business name (lowercase, no spaces, no special chars)
- MUST be clickable: <a href="mailto:info@sitename.com">info@sitename.com</a>
- Examples:
  * "Green Garden" → info@greengarden.com
  * "Auto Pro" → contact@autopro.com
  * "Dr. Smith Clinic" → info@drsmithclinic.com
- NEVER use generic emails like info@company.com or test@example.com

⚠️ IF NO PHONE/EMAIL IN OUTPUT = SITE IS BROKEN! ALWAYS INCLUDE THEM!

**🎯 CENTERING & LAYOUT - ABSOLUTELY CRITICAL:**
ALL content MUST be centered on the page:
- Use max-width: 1200px for main container
- Use margin: 0 auto for centering
- All grids must be centered within container
- Cards should be in clean 3-column grid (2 on tablet, 1 on mobile)
- Light background (#f0f9f0 or similar) for card sections
- Section headers centered with text-align: center

**MANDATORY PAGE STRUCTURE (index.html must have ALL of these):**
1. Header with navigation ONLY (NO phone/email in header! centered nav, max-width container)
2. Hero section (split layout: text + image side by side, centered)
3. Stats/metrics section with big numbers (3-4 stats, centered)
4. Featured cards section (6 cards in 3x2 grid, CENTERED, with "Read More" buttons)
5. Media object section (text + image side by side, centered)
6. Timeline/process steps section (4 numbered steps, centered)
7. Contact/CTA form section (centered) - WITH PHONE AND EMAIL displayed
8. Footer with PHONE, EMAIL, ADDRESS (centered content)

**EVERY SECTION MUST HAVE:**
- Section label (small badge above title): <span class="section-label">Section Topic</span>
- Main heading: <h2>Clear compelling title</h2>
- Description paragraph: <p>Detailed explanation...</p>
- Actual content (lists, cards, stats, forms)
- ALL CONTENT CENTERED IN max-width CONTAINER

🎯 **CONTENT DENSITY REQUIREMENTS:**
- Homepage MUST have 6+ content sections
- Each section MUST have 100+ words of real text
- Cards MUST have title + description + meta info + "Read More" button
- Lists MUST have 3+ bullet points with full sentences
- Stats MUST have 3+ metrics with numbers and labels
- CONTACT INFO (phone + email) MUST be visible on every page

**MANDATORY HERO STRUCTURE (SPLIT LAYOUT) - FOLLOW EXACTLY:**
\`\`\`html
<section class="page-hero homepage-hero">
  <div class="hero-inner">
    <div class="hero-copy">
      <span class="badge">Tagline here</span>
      <h1>Main headline that explains value proposition clearly.</h1>
      <p>Detailed paragraph explaining what you do, who you help, and why it matters. This should be 2-3 sentences minimum.</p>
      <div class="hero-actions">
        <a class="cta-button" href="contact.html">Primary Action</a>
        <a class="button-outline" href="services.html">Secondary Action</a>
      </div>
      <div class="tag-pills">
        <span>Feature 1</span>
        <span>Feature 2</span>
        <span>Feature 3</span>
        <span>Feature 4</span>
      </div>
    </div>
    <div class="hero-visual">
      <img src="https://picsum.photos/seed/hero-main/820/580" alt="Hero visual">
    </div>
  </div>
</section>
\`\`\`

🚨 **HERO CRITICAL RULES - NO EXCEPTIONS:**
- The page-hero section MUST NOT have style="" attribute
- The page-hero section MUST NOT have background-image
- ONLY ONE class="" attribute per element - NEVER duplicate class attributes
- The ONLY image in hero is inside hero-visual div as an <img> tag
- hero-visual MUST contain EXACTLY ONE <img> element, nothing else

**MANDATORY STATS SECTION:**
\`\`\`html
<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-label">Key Metrics</span>
      <h2>Compelling headline about achievements</h2>
      <p>Brief description of what these numbers mean.</p>
    </div>
    <div class="stats-highlight">
      <ul class="highlight-list">
        <li>First key point with detailed explanation.</li>
        <li>Second key point with detailed explanation.</li>
        <li>Third key point with detailed explanation.</li>
      </ul>
      <div class="stats-numbers">
        <div><div class="stat-number">€4.6B</div><div class="stat-caption">Metric description</div></div>
        <div><div class="stat-number">72 hrs</div><div class="stat-caption">Metric description</div></div>
        <div><div class="stat-number">98%</div><div class="stat-caption">Metric description</div></div>
      </div>
    </div>
  </div>
</section>
\`\`\`

**MANDATORY CARDS GRID (CENTERED, BEAUTIFUL):**
\`\`\`html
<section class="section light">
  <div class="section-inner centered">
    <div class="section-header centered">
      <span class="section-label">Services</span>
      <h2>What we offer</h2>
      <p>Brief intro to services.</p>
    </div>
    <div class="cards-grid">
      <article class="card">
        <h3>Service Title</h3>
        <p>Detailed description of service with real information.</p>
        <div class="card-meta"><span class="meta-tag">Category</span> | <span class="meta-date">Published Date</span></div>
        <a href="#" class="card-button">Read More</a>
      </article>
      <!-- 5 more cards for 6 total, or 3x2 grid -->
    </div>
  </div>
</section>
\`\`\`

**🎯 CARD GRID CENTERING - CRITICAL CSS:**
\`\`\`css
/* CENTERED CONTAINER FOR ALL CONTENT */
.section-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-inner.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-header.centered {
  text-align: center;
  max-width: 700px;
  margin-bottom: 48px;
}

/* BEAUTIFUL CENTERED CARD GRID */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 992px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}

/* BEAUTIFUL CARD STYLING */
.card {
  background: white;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.04);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}

.card h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-dark);
}

.card p {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 16px;
  flex-grow: 1;
}

.card-meta {
  font-size: 0.85rem;
  color: var(--primary-color);
  margin-bottom: 16px;
}

.meta-tag, .meta-date {
  font-weight: 500;
}

.card-button {
  display: inline-block;
  padding: 12px 24px;
  border: 2px solid var(--primary-color);
  border-radius: 8px;
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: all 0.3s ease;
  align-self: flex-start;
}

.card-button:hover {
  background: var(--primary-color);
  color: white;
}
\`\`\`

**MANDATORY MEDIA OBJECT (TEXT + IMAGE):**
\`\`\`html
<section class="section">
  <div class="section-inner">
    <div class="media-object">
      <div class="media-copy">
        <span class="section-label">About</span>
        <h3>Compelling headline about approach</h3>
        <p>Detailed paragraph about methodology and approach.</p>
        <ul>
          <li>Key benefit with explanation.</li>
          <li>Second benefit with explanation.</li>
          <li>Third benefit with explanation.</li>
        </ul>
        <div class="cta-buttons">
          <a class="cta-button" href="about.html">Learn More</a>
        </div>
      </div>
      <div class="media-visual">
        <img src="https://picsum.photos/seed/about-img/760/560" alt="Description">
      </div>
    </div>
  </div>
</section>
\`\`\`

**MANDATORY TIMELINE/PROCESS:**
\`\`\`html
<section class="section light">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-label">Process</span>
      <h2>How we work</h2>
    </div>
    <div class="timeline">
      <div class="timeline-step">
        <h3>1 · Step Title</h3>
        <p>Detailed description of this step.</p>
      </div>
      <!-- 3-4 steps -->
    </div>
  </div>
</section>
\`\`\`

**MANDATORY CONTACT FORM:**
\`\`\`html
<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-label">Contact</span>
      <h2>Get in touch</h2>
      <p>Description of what happens when they contact.</p>
    </div>
    <div class="form-card">
      <form class="form-grid">
        <div class="form-grid two-columns">
          <div class="form-group"><label>Name</label><input type="text" required></div>
          <div class="form-group"><label>Email</label><input type="email" required></div>
        </div>
        <div class="form-group"><label>Message</label><textarea required></textarea></div>
        <button type="submit" class="cta-button">Submit</button>
      </form>
    </div>
  </div>
</section>
\`\`\`

🚨 **IMAGE RULES - CRITICAL FOR PREVENTING OVERLAP:**
- Hero: Use SINGLE <img> inside hero-visual div, max 820x580
- Section images: SINGLE <img> inside media-visual div, max 760x560
- Card images: NOT required, cards are text-based
- Use picsum.photos/seed/[unique-name]/WxH for consistent images
- NEVER full-screen images (no 100vw, 100vh)
- NEVER use position:absolute on images
- NEVER place multiple images in the same container
- NEVER use background-image combined with <img> tag in same element
- Each image container (.hero-visual, .media-visual) must have ONLY ONE <img> child

🚫 **ABSOLUTE PROHIBITION - IMAGE OVERLAP:**
- NEVER generate an <img> tag on top of another <img>
- NEVER use CSS that positions one image over another
- NEVER use ::before or ::after pseudo-elements with background-image near <img> tags
- Each visual container must have exactly ONE image source, not multiple

**❌ WHAT NEVER TO DO - ABSOLUTE PROHIBITIONS:**
- Empty pages or sections
- Plain unstyled text without structure
- Missing section labels
- Cards without descriptions
- Forms without proper labels
- Lists with only 1-2 items
- Sections without section-header
- Images without proper sizing constraints
- MULTIPLE IMAGES IN SAME CONTAINER
- OVERLAPPING IMAGES
- Using style="background-image:..." on page-hero section
- Duplicate class="" attributes on any element (class="x" class="y" is INVALID HTML)
- Adding inline styles to hero sections
- Using background-image AND <img> tag in the same visual context

**🚫 HTML SYNTAX RULES - NEVER VIOLATE:**
- Each HTML element can have ONLY ONE class attribute
- WRONG: <section class="page-hero" style="..." class="another">
- CORRECT: <section class="page-hero homepage-hero">
- page-hero sections must NOT have style="" attribute at all

**🎨 CRITICAL DESIGN RULES - UNIQUE STYLING FOR EACH SITE:**

**IMPORTANT: Each website MUST have UNIQUE visual identity!**
- Generate a UNIQUE color palette based on the industry/theme (medical = blues/greens, food = warm colors, tech = modern blues, luxury = golds/blacks)
- Choose border-radius style that fits the brand (corporate = subtle 8-12px, playful = 20px+, brutalist = 0px, modern = 16px)
- Vary shadow styles (soft subtle shadows for elegance, sharp shadows for modern, no shadows for minimalist)
- Mix up section backgrounds (some sites: alternating white/gray, others: gradient sections, others: solid color accents)

**CSS VARIABLES - GENERATE UNIQUE PALETTE BASED ON THEME:**
\`\`\`css
:root {
  /* Generate UNIQUE colors based on industry/theme! Examples: */
  /* Medical/Health: --primary-color: #0891b2; --accent-color: #06b6d4; */
  /* Legal/Finance: --primary-color: #1e3a5f; --accent-color: #3b82f6; */
  /* Food/Restaurant: --primary-color: #b91c1c; --accent-color: #ef4444; */
  /* Eco/Nature: --primary-color: #166534; --accent-color: #22c55e; */
  /* Tech/Startup: --primary-color: #4f46e5; --accent-color: #818cf8; */
  /* Luxury/Premium: --primary-color: #78350f; --accent-color: #d97706; */
  
  --primary-color: [CHOOSE BASED ON THEME];
  --primary-dark: [DARKER VARIANT];
  --secondary-color: [COMPLEMENTARY];
  --text-dark: #1a1a1a;
  --text-light: #666666;
  --text-muted: #888888;
  --bg-light: [LIGHT TINT OF PRIMARY];
  --bg-white: #ffffff;
  --border-color: [SUBTLE BORDER];
  --shadow-sm: [CHOOSE STYLE];
  --shadow-md: [CHOOSE STYLE];
  --shadow-lg: [CHOOSE STYLE];
  --radius-sm: [8px OR 0 OR 16px - CHOOSE];
  --radius-md: [12px OR 0 OR 20px - CHOOSE];
  --radius-lg: [20px OR 0 OR 30px - CHOOSE];
  --transition: all 0.3s ease;
  --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
\`\`\`

**BASE RESET & TYPOGRAPHY:**
\`\`\`css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-main);
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-dark);
  background: var(--bg-white);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-dark);
}

h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.5rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.75rem); }

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: var(--transition);
}

a:hover {
  color: var(--primary-dark);
}
\`\`\`

**HEADER & NAVIGATION - PREMIUM STYLING:**
\`\`\`css
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.header.scrolled {
  background: rgba(255,255,255,0.98);
  box-shadow: var(--shadow-md);
}

.nav {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-dark);
}

.nav-links {
  display: flex;
  gap: 32px;
  list-style: none;
}

.nav-links a {
  font-weight: 500;
  color: var(--text-dark);
  padding: 8px 0;
  position: relative;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--primary-color);
  transition: var(--transition);
}

.nav-links a:hover::after,
.nav-links a.active::after {
  width: 100%;
}

/* Mobile menu button */
.nav-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.nav-toggle span {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--text-dark);
  margin: 6px 0;
  transition: var(--transition);
}

@media (max-width: 768px) {
  .nav-toggle { display: block; }
  .nav-links {
    position: absolute;
    top: 70px;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    padding: 20px;
    gap: 16px;
    box-shadow: var(--shadow-md);
    display: none;
  }
  .nav-links.active { display: flex; }
}
\`\`\`

**BUTTONS - PREMIUM DESIGN:**
\`\`\`css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
}

.btn-secondary {
  background: transparent;
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
}

.btn-secondary:hover {
  background: var(--primary-color);
  color: white;
}

.btn-white {
  background: white;
  color: var(--text-dark);
}

.btn-white:hover {
  background: var(--bg-light);
  transform: translateY(-2px);
}
\`\`\`

**🚨🚨🚨 IMAGE SIZING - ABSOLUTELY CRITICAL - NEVER FULL-SCREEN 🚨🚨🚨:**

**RULES FOR IMAGE SIZES (STRICTLY FOLLOW):**
1. Images must NEVER be full-width or full-screen (no 100vw, no width: 100%)
2. All images must be CONTEXTUAL - sized appropriately for their content role
3. Card images: max 400px height, contained within card boundaries
4. Hero: background-image with overlay, NOT full-screen photos
5. Section images: max-width 600px, centered or alongside text
6. Gallery images: uniform size in grid, max 350px each

\`\`\`css
/* BASE IMAGE CONSTRAINTS - NEVER REMOVE */
img {
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

/* HERO - CONTROLLED HEIGHT, NEVER FULL-SCREEN PHOTO */
.hero {
  min-height: 60vh;
  max-height: 70vh; /* STRICT LIMIT - never full viewport */
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  position: relative;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%);
}

.hero-content {
  position: relative;
  z-index: 1;
  color: white;
  max-width: 700px;
}

/* CARD IMAGES - FIXED HEIGHT, NEVER OVERSIZED */
.card-image, .service-card img, .feature-img {
  width: 100%;
  height: 200px; /* FIXED - never bigger */
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* SECTION IMAGES - CONSTRAINED */
.section-image, .about-image, .content-image {
  max-width: 500px;
  height: auto;
  max-height: 350px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* AVATARS - SMALL AND UNIFORM */
.avatar, .team-photo, .testimonial-img {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  object-fit: cover;
}

/* GALLERY - UNIFORM GRID */
.gallery-item img {
  width: 100%;
  height: 220px; /* FIXED height */
  max-height: 220px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* PARTNER LOGOS - SMALL */
.partner-logo, .client-logo {
  height: 40px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
  filter: grayscale(100%);
  opacity: 0.6;
  transition: var(--transition);
}

.partner-logo:hover {
  filter: grayscale(0);
  opacity: 1;
}

/* PREVENT OVERSIZED IMAGES */
section img:not(.avatar):not(.partner-logo):not(.client-logo) {
  max-height: 400px;
}
\`\`\`

**🎨 CONSISTENT STYLING - ALL SECTIONS MUST MATCH:**

**CRITICAL RULE: Every page section must follow the SAME design language:**
1. ALL cards must have IDENTICAL styling (same border-radius, shadow, padding)
2. ALL sections must have UNIFORM spacing (80px padding top/bottom)
3. ALL text elements must follow typography hierarchy
4. NO mixing of styled cards with plain lists - use cards OR styled lists
5. Newsletter/CTA sections must have proper background styling

\`\`\`css
/* CONSISTENT SECTION STYLING */
.section {
  padding: 80px 0;
}

.section.bg-light {
  background: var(--bg-light);
}

.section.bg-dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}

/* CONSISTENT CARD STYLING - ALL CARDS IDENTICAL */
.card, .service-card, .feature-card, .category-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid rgba(0,0,0,0.05);
}

.card:hover, .service-card:hover, .feature-card:hover, .category-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}

/* CATEGORY/LIST SECTIONS - MUST BE STYLED AS CARDS */
.category-list, .services-list, .features-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.category-item, .service-item, .feature-item {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border-left: 4px solid var(--primary-color);
  transition: all 0.3s ease;
}

.category-item:hover, .service-item:hover, .feature-item:hover {
  transform: translateX(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.category-item h3, .service-item h3, .feature-item h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-dark);
}

.category-item p, .service-item p, .feature-item p {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.5;
}

/* NEWSLETTER/CTA SECTIONS - PROPERLY STYLED */
.newsletter-section, .cta-section, .subscribe-section {
  background: linear-gradient(135deg, var(--bg-light) 0%, #e8f4f8 100%);
  padding: 60px 0;
  text-align: center;
  border-radius: 0;
}

.newsletter-section .container, .cta-section .container {
  max-width: 700px;
}

.newsletter-form, .subscribe-form {
  display: flex;
  gap: 12px;
  max-width: 500px;
  margin: 24px auto 0;
  flex-wrap: wrap;
  justify-content: center;
}

.newsletter-form input, .subscribe-form input {
  flex: 1;
  min-width: 250px;
  padding: 14px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 1rem;
}

.newsletter-form button, .subscribe-form button {
  padding: 14px 28px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.newsletter-form button:hover, .subscribe-form button:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
}
\`\`\`

**❌ WHAT NOT TO DO (NEVER GENERATE LIKE THIS):**
- Plain text lists without styling (Energy, Infrastructure, Technology as plain text)
- Sections with inconsistent backgrounds
- Cards with different border-radius values
- Images that are too large or too small
- Newsletter sections with basic unstyled inputs
- Mixed styling within same page
- **PLAIN/UNSTYLED FORM FIELDS** (raw input, select, textarea without styling)
- Browser-default form elements without custom borders/backgrounds/radius

**✅ WHAT TO DO:**
- All categories/services in styled cards with icons or borders
- Consistent 80px section padding throughout
- Uniform card styling with shadows and hover effects
- Properly sized images (200-400px height max)
- Styled newsletter with gradient background
- **ALL form elements (input, select, textarea) MUST have:**
  - Custom border (1px solid with theme color)
  - Rounded corners (border-radius from theme)
  - Padding (12-16px)
  - Background color (white or theme background)
  - Focus state with box-shadow
  - Consistent font-family and font-size

**SECTIONS & CONTAINERS:**
\`\`\`css
section {
  padding: 80px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 50px;
}

.section-title {
  margin-bottom: 16px;
}

.section-subtitle {
  color: var(--text-light);
  font-size: 1.1rem;
}

.bg-light {
  background: var(--bg-light);
}
\`\`\`

**CARDS & GRIDS:**
\`\`\`css
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }

@media (max-width: 992px) {
  .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 576px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
}

.card {
  background: white;
  border-radius: var(--radius-lg);
  overflow: visible;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}

.card-body {
  padding: 24px;
  overflow: visible;
}

.card-title {
  font-size: 1.2rem;
  margin-bottom: 12px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.card-text {
  color: var(--text-light);
  font-size: 0.95rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
\`\`\`

**FORMS:**
\`\`\`css
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-dark);
}

.form-control {
  width: 100%;
  padding: 14px 18px;
  font-size: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: var(--transition);
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

textarea.form-control {
  resize: vertical;
  min-height: 140px;
}
\`\`\`

**🦶 PREMIUM FOOTER DESIGN - ABSOLUTELY MANDATORY:**
Footer MUST be professional, compact, and well-structured:

\`\`\`css
/* PREMIUM FOOTER STYLES */
.footer {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0;
  padding: 60px 0 30px;
  margin-top: 80px;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-brand {
  max-width: 280px;
}

.footer-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 16px;
  display: block;
}

.footer-description {
  font-size: 0.9rem;
  line-height: 1.6;
  color: #a0a0a0;
  margin-bottom: 20px;
}

.footer-heading {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links li {
  margin-bottom: 12px;
}

.footer-links a {
  color: #a0a0a0;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.footer-links a:hover {
  color: white;
}

.footer-contact-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 0.9rem;
  color: #a0a0a0;
}

.footer-contact-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent-color, #3b82f6);
}

.footer-social {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.footer-social a {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.3s ease;
}

.footer-social a:hover {
  background: var(--accent-color, #3b82f6);
  transform: translateY(-3px);
}

.footer-divider {
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 30px 0;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.footer-copyright {
  font-size: 0.85rem;
  color: #707070;
}

.footer-legal-links {
  display: flex;
  gap: 24px;
}

.footer-legal-links a {
  font-size: 0.85rem;
  color: #707070;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-legal-links a:hover {
  color: white;
}

@media (max-width: 992px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 576px) {
  .footer-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .footer-brand {
    max-width: 100%;
  }
  .footer-bottom {
    flex-direction: column;
    text-align: center;
  }
  .footer-social {
    justify-content: center;
  }
}
\`\`\`

**FOOTER HTML STRUCTURE (USE THIS EXACT STRUCTURE):**
\`\`\`html
<footer class="footer">
  <div class="footer-container">
    <div class="footer-grid">
      <!-- Brand Column -->
      <div class="footer-brand">
        <span class="footer-logo">Company Name</span>
        <p class="footer-description">Brief company description in 2-3 sentences. Professional and concise.</p>
        <div class="footer-social">
          <a href="#" aria-label="Facebook"><svg>...</svg></a>
          <a href="#" aria-label="Instagram"><svg>...</svg></a>
          <a href="#" aria-label="LinkedIn"><svg>...</svg></a>
        </div>
      </div>
      
      <!-- Quick Links -->
      <div>
        <h4 class="footer-heading">Navigation</h4>
        <ul class="footer-links">
          <li><a href="index.html">Home</a></li>
          <li><a href="about.html">About</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      
      <!-- Legal Links -->
      <div>
        <h4 class="footer-heading">Legal</h4>
        <ul class="footer-links">
          <li><a href="privacy.html">Privacy Policy</a></li>
          <li><a href="terms.html">Terms of Service</a></li>
          <li><a href="cookie-policy.html">Cookie Policy</a></li>
        </ul>
      </div>
      
      <!-- Contact Info - PHONE AND EMAIL ARE MANDATORY -->
      <div>
        <h4 class="footer-heading">Contact</h4>
        <div class="footer-contact-item">
          <svg>location icon</svg>
          <span>123 Business Street, City</span>
        </div>
        <div class="footer-contact-item">
          <svg>phone icon</svg>
          <!-- REPLACE WITH REALISTIC PHONE FOR YOUR GEO! Examples: +49 30 2897 6543, +48 22 456 78 90, +34 912 456 789 -->
          <a href="tel:+493028976543">+49 30 2897 6543</a>
        </div>
        <div class="footer-contact-item">
          <svg>email icon</svg>
          <!-- REPLACE WITH DOMAIN-BASED EMAIL! Use sitename from business name -->
          <a href="mailto:info@companyname.com">info@companyname.com</a>
        </div>
      </div>
    </div>
    
    <!-- Disclaimer -->
    <div class="disclaimer-section">
      <p><strong>Disclaimer:</strong> Adapted disclaimer text...</p>
    </div>
    
    <div class="footer-divider"></div>
    
    <div class="footer-bottom">
      <p class="footer-copyright">© 2024 Company Name. All rights reserved.</p>
      <div class="footer-legal-links">
        <a href="privacy.html">Privacy</a>
        <a href="terms.html">Terms</a>
      </div>
    </div>
  </div>
</footer>
\`\`\`

**📐 PAGE STRUCTURE - CENTERED SECTIONS (CRITICAL):**

\`\`\`css
/* GLOBAL CENTERING - APPLY TO ALL PAGES */
body {
  background: #f8faf8;
}

/* MAIN CONTAINER - ALWAYS CENTERED */
.container, .section-inner, .page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* CLEAN SECTION STRUCTURE */
section {
  padding: 80px 0;
}

section.light {
  background: #f0f9f0;
}

/* CENTERED SECTION HEADER */
.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 48px;
}

.section-label {
  display: inline-block;
  background: var(--primary-color, #059669);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.section-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--heading-color, #1a1a1a);
}

.section-subtitle {
  font-size: 1.1rem;
  color: var(--text-muted, #666);
  line-height: 1.6;
}

/* CARDS GRID - CENTERED 3-COLUMN LAYOUT */
.cards-grid, .featured-grid, .articles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 992px) {
  .cards-grid, .featured-grid, .articles-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .cards-grid, .featured-grid, .articles-grid {
    grid-template-columns: 1fr;
  }
}

/* BEAUTIFUL CARD STYLING */
.card {
  background: white;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.04);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}

.card h3, .card-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-dark, #1a1a1a);
}

.card p, .card-text {
  color: var(--text-muted, #666);
  line-height: 1.6;
  font-size: 0.95rem;
  margin-bottom: 16px;
  flex-grow: 1;
}

.card-meta {
  font-size: 0.85rem;
  color: var(--primary-color, #059669);
  margin-bottom: 16px;
  font-weight: 500;
}

/* READ MORE BUTTON */
.card-button, .read-more {
  display: inline-block;
  padding: 12px 24px;
  border: 2px solid var(--primary-color, #059669);
  border-radius: 8px;
  color: var(--primary-color, #059669);
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: all 0.3s ease;
  align-self: flex-start;
}

.card-button:hover, .read-more:hover {
  background: var(--primary-color, #059669);
  color: white;
}

/* SEARCH/FILTER SECTION */
.search-section {
  max-width: 600px;
  margin: 0 auto 48px;
  text-align: center;
}

.search-input {
  width: 100%;
  padding: 16px 24px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 16px;
}

.search-button {
  padding: 14px 32px;
  background: var(--primary-color, #059669);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

/* PAGINATION */
.pagination {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 48px;
}

.pagination a {
  padding: 8px 16px;
  color: var(--primary-color, #059669);
  text-decoration: none;
  font-weight: 500;
}

.pagination a.active {
  background: var(--primary-color, #059669);
  color: white;
  border-radius: 6px;
}
\`\`\`

**🌍 LANGUAGE COMPLIANCE - ABSOLUTELY MANDATORY:**
The website MUST be generated in the EXACT language specified:
- ALL text content MUST be in the specified language
- Button text, navigation, form labels - EVERYTHING in the correct language
- NEVER mix languages
- NEVER default to Ukrainian unless explicitly specified

**NAVIGATION LINKS - USE RELATIVE PATHS:**
- ALL links MUST use: href="about.html" NOT href="/about"
- ALWAYS include .html extension

**🍪 COOKIE CONSENT - MANDATORY:**
Include working cookie banner with localStorage:
\`\`\`javascript
document.addEventListener('DOMContentLoaded', function() {
  const cookieConsent = localStorage.getItem('cookieConsent');
  const banner = document.getElementById('cookie-banner');
  if (!cookieConsent && banner) {
    banner.style.display = 'flex';
  }
});
function acceptCookies() {
  localStorage.setItem('cookieConsent', 'accepted');
  document.getElementById('cookie-banner').style.display = 'none';
}
function declineCookies() {
  localStorage.setItem('cookieConsent', 'declined');
  document.getElementById('cookie-banner').style.display = 'none';
}
\`\`\`

**🚫 NUMBERS PROHIBITION:**
NEVER include prices, statistics, percentages, years of experience, client counts, etc.
ALLOWED: Phone numbers, postal codes, copyright year.
Use alternatives: "Contact for pricing", "Experienced team", "Many satisfied clients"

**📞 PHONE NUMBERS - MUST BE REALISTIC BY COUNTRY:**
- NEVER use fake numbers like 123456, 555-1234, or placeholder XXX
- Generate REALISTIC phone numbers based on GEO/COUNTRY:
  * Germany: +49 30 2897 6543, +49 89 4521 7890
  * Poland: +48 22 456 78 90, +48 12 345 67 89
  * Spain: +34 912 456 789, +34 932 876 543
  * France: +33 1 42 68 53 00, +33 4 93 45 67 89
  * Italy: +39 06 8745 6321, +39 02 7654 3210
  * UK: +44 20 7946 0958, +44 161 496 0753
  * USA: +1 (212) 555-0147, +1 (415) 555-0198
  * Netherlands: +31 20 794 5682, +31 10 456 7890
  * Czech Republic: +420 221 456 789, +420 257 891 234
  * Ukraine: +380 44 456 7890, +380 67 123 4567
  * Russia: +7 495 123 4567, +7 812 456 7890
  * Default international: Use the country code + realistic local format
- MUST be clickable: <a href="tel:+14155550147">+1 (415) 555-0147</a>

**📧 EMAILS - MUST MATCH SITE DOMAIN:**
- Email MUST use the site's domain name
- Format: info@<sitename>.com, contact@<sitename>.com, support@<sitename>.com
- Extract sitename from the business name (lowercase, no spaces, no special chars)
- Examples:
  * Business "Green Garden Services" → info@greengarden.com
  * Business "Auto Pro Center" → contact@autoprocenter.com
  * Business "Dr. Smith Clinic" → info@drsmithclinic.com
- MUST be clickable: <a href="mailto:info@sitename.com">info@sitename.com</a>
- NEVER use generic emails like info@company.com or test@example.com

**🙏 THANK YOU PAGE:**
Every site needs thank-you.html with success message and link back to homepage.

**🗺️ GOOGLE MAPS:**
Contact page MUST include working Google Maps embed matching the site's location.

**⚠️ DISCLAIMER:**
Include in footer, adapted to site's industry/theme.

**MANDATORY FILES:**
- index.html (hero + 6-8 quality sections with smooth animations)
- about.html (company story, mission, team, values sections)
- services.html (detailed services with cards, process steps, benefits)
- contact.html (form, map embed, working hours, multiple contact methods)
- thank-you.html (success message, next steps, back to home)
- privacy.html (EXACTLY 10 detailed sections with substantial content each - Introduction, Data We Collect, How We Use Data, Data Sharing, Data Security, Your Rights, Cookies, Third Parties, Data Retention, Contact & Changes)
- terms.html (EXACTLY 14 sections - Acceptance, Definitions, Services, User Accounts, Acceptable Use, Intellectual Property, User Content, Privacy, Disclaimers, Limitation of Liability, Indemnification, Termination, Changes, Governing Law)
- cookie-policy.html (What Are Cookies, Types We Use, Cookie Table with ALL cookies listed, How to Manage, Third-Party Cookies, Policy Updates)
- styles.css (600+ lines, premium design system with CSS variables, animations, responsive breakpoints)
- script.js (mobile menu, cookie banner, scroll animations, form validation)
- cookie-banner.js (separate file for cookie consent logic)
- robots.txt
- sitemap.xml

**QUALITY STANDARDS:**
- Each page must be SUBSTANTIAL - no empty or minimal pages
- Legal pages (privacy, terms, cookie) must each have 3000+ characters of real content
- All sections must have proper styling and spacing
- Mobile-first responsive design throughout
- Smooth hover effects and transitions
- Professional typography with proper hierarchy

**CSS MUST INCLUDE:**
- CSS variables in :root
- Image size constraints (CRITICAL!)
- Premium footer styles
- Mobile responsive breakpoints
- Card hover effects
- Form styling
- Cookie banner
- Smooth transitions

`.trim();

// Image strategy - Basic (reliable random photos)
const IMAGE_STRATEGY_BASIC = `
🚨🚨🚨 CRITICAL IMAGE RULES - MANDATORY 🚨🚨🚨

**USE picsum.photos FOR ALL IMAGES - THIS IS NON-NEGOTIABLE:**

**1. HERO VISUAL (NO background-image, NO inline style on hero section):**
Use the split hero with a single <img> inside .hero-visual:

\`\`\`html
<section class="page-hero homepage-hero">
  <div class="hero-inner">
    <div class="hero-copy">
      <span class="badge">Tagline here</span>
      <h1>Title</h1>
      <p>Subtitle</p>
      <div class="hero-actions">
        <a href="contact.html" class="cta-button">CTA Button</a>
      </div>
    </div>
    <div class="hero-visual">
      <img src="https://picsum.photos/seed/hero-main/820/580" alt="Hero visual" loading="lazy">
    </div>
  </div>
</section>
\`\`\`

**2. CONTENT IMAGES (single <img>):**
<img src="https://picsum.photos/seed/section-1/800/600" alt="[Description in site language]" loading="lazy">

**3. CARD IMAGES (optional):**
<img src="https://picsum.photos/seed/card-1/600/400" alt="[Description]" loading="lazy">

**4. TEAM/PORTRAIT IMAGES:**
<img src="https://picsum.photos/seed/team-1/400/400" alt="[Person name]" loading="lazy">

**5. GALLERY/FEATURE IMAGES:**
<img src="https://picsum.photos/seed/gallery-1/500/350" alt="[Description]" loading="lazy">

⚠️ MANDATORY RULES:
- Prefer stable /seed URLs: https://picsum.photos/seed/<unique>/WxH
- NEVER use SVG icons as main content images
- NEVER use placeholder.svg or any placeholder images
- NEVER use data:image URLs
- EVERY <img> tag MUST have src with picsum.photos or a real photo URL
- NEVER set background-image on hero sections (or any element that also contains an <img>)
- NEVER position images absolutely
- Alt text MUST be in the same language as website content

**WRONG (NEVER DO):**
❌ <img src="placeholder.svg">
❌ <svg class="hero-icon">...</svg>
❌ <img src="">
❌ <img src="icon.svg">
❌ <section class="page-hero" style="background-image: ..."> ... <img ...> ...

**CORRECT:**
✅ <img src="https://picsum.photos/seed/service-7/800/600" alt="Professional service" loading="lazy">
✅ <section class="page-hero homepage-hero"> ... <div class="hero-visual"><img ...></div> ...

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

**Usage in HTML:**
<img src="https://logo.clearbit.com/stripe.com" alt="Stripe" class="partner-logo" loading="lazy">
<img src="https://logo.clearbit.com/visa.com" alt="Visa" class="payment-logo" loading="lazy">

**RULES:**
- NEVER use placeholder logos or generic icons for brand logos
- Choose logos that make sense for the website's industry
- Use 4-8 partner/client logos in "Partners" or "Trusted By" sections
- Include relevant payment logos on e-commerce sites
- Add certification logos for professional services
`.trim();

// Pexels API helper function
async function fetchPexelsPhotos(query: string, count: number = 15): Promise<string[]> {
  const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_API_KEY) {
    console.log("PEXELS_API_KEY not configured, falling back to picsum");
    return [];
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: { Authorization: PEXELS_API_KEY },
      }
    );

    if (!response.ok) {
      console.error("Pexels API error:", response.status);
      return [];
    }

    const data = await response.json();
    const photos = data.photos || [];
    
    console.log(`📸 Pexels: Found ${photos.length} photos for "${query}"`);
    
    return photos.map((photo: { src: { large2x: string; large: string; medium: string } }) => 
      photo.src.large2x || photo.src.large || photo.src.medium
    );
  } catch (error) {
    console.error("Pexels API error:", error);
    return [];
  }
}

// AI-powered keyword extraction for better Pexels search
async function extractKeywordsAI(prompt: string, apiKey: string, isJunior: boolean): Promise<string> {
  try {
    const apiUrl = isJunior
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const model = isJunior ? "gpt-4o-mini" : "google/gemini-2.5-flash";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You extract the main visual topic for stock photo search. 
Return ONLY 2-4 English words that describe what photos would fit this website.
Examples:
- "Сайт для ветеринарної клініки" → "veterinary clinic pets"
- "Restaurant landing page Italian food" → "italian restaurant food"
- "Fitness gym website" → "gym fitness workout"
- "Продаж автозапчастин" → "car parts automotive"
- "Dog grooming salon" → "dog grooming salon"
NO explanations, NO quotes, ONLY the search keywords in English.`
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      console.log("AI keyword extraction failed, using fallback");
      return extractKeywordsFallback(prompt);
    }

    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content?.trim() || "";
    
    if (keywords && keywords.length > 2 && keywords.length < 50) {
      console.log(`🔍 AI extracted keywords: "${keywords}"`);
      return keywords;
    }
    
    return extractKeywordsFallback(prompt);
  } catch (error) {
    console.error("Keyword extraction error:", error);
    return extractKeywordsFallback(prompt);
  }
}

// Fallback keyword extraction (no AI)
function extractKeywordsFallback(prompt: string): string {
  // Translation map for common Ukrainian business terms
  const translations: Record<string, string> = {
    "ресторан": "restaurant food",
    "кафе": "cafe coffee",
    "піца": "pizza restaurant",
    "суші": "sushi japanese food",
    "ветеринар": "veterinary pets animals",
    "собак": "dogs pets",
    "кішок": "cats pets",
    "тварин": "animals pets",
    "авто": "cars automotive",
    "машин": "cars automotive",
    "запчастин": "car parts automotive",
    "будівництв": "construction building",
    "ремонт": "repair renovation",
    "фітнес": "fitness gym workout",
    "спорт": "sports fitness",
    "краса": "beauty salon spa",
    "салон": "beauty salon",
    "перукар": "hairdresser salon",
    "юрист": "lawyer legal office",
    "адвокат": "lawyer legal",
    "медицин": "medical healthcare",
    "стоматолог": "dentist dental",
    "подорож": "travel vacation",
    "туризм": "tourism travel",
    "готель": "hotel hospitality",
    "нерухом": "real estate property",
    "освіта": "education school",
    "школ": "school education",
    "технолог": "technology business",
    "програм": "software technology",
    "магазин": "shop retail store",
    "одяг": "fashion clothing",
    "взуття": "shoes footwear",
    "меблі": "furniture interior",
    "квіти": "flowers florist",
    "весілля": "wedding celebration",
    "фото": "photography camera",
  };

  const lowerPrompt = prompt.toLowerCase();
  
  // Find matching translation
  for (const [ukr, eng] of Object.entries(translations)) {
    if (lowerPrompt.includes(ukr)) {
      console.log(`🔍 Fallback keywords (matched "${ukr}"): "${eng}"`);
      return eng;
    }
  }

  // Generic extraction as last resort
  const cleanPrompt = prompt
    .replace(/сайт|website|web|page|create|generate|for|the|a|an|і|та|для|про|створ|генер/gi, "")
    .trim();
  
  const words = cleanPrompt.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  const result = words.join(" ") || "business professional";
  console.log(`🔍 Fallback keywords (generic): "${result}"`);
  return result;
}

// Build image strategy with Pexels URLs
function buildPexelsImageStrategy(pexelsUrls: string[]): string {
  if (pexelsUrls.length === 0) {
    return `
**IMAGE STRATEGY - RELIABLE RANDOM PHOTOS:**
Use picsum.photos for ALL images - it's reliable and always loads:

**Hero background:** url('https://picsum.photos/1920/1080?random=1')
**Content images:** <img src="https://picsum.photos/800/600?random=2" alt="[Description]" loading="lazy">
**Card images:** <img src="https://picsum.photos/600/400?random=3" alt="[Description]" loading="lazy">
**Portrait images:** <img src="https://picsum.photos/400/400?random=4" alt="[Description]" loading="lazy">

Use DIFFERENT random= numbers for each image!
`.trim();
  }

  // Distribute URLs for different purposes
  const heroUrl = pexelsUrls[0] || "https://picsum.photos/1920/1080?random=1";
  const contentUrls = pexelsUrls.slice(1, 6);
  const cardUrls = pexelsUrls.slice(6, 12);
  const portraitUrls = pexelsUrls.slice(12, 15);

  return `
**IMAGE STRATEGY - HIGH QUALITY STOCK PHOTOS FROM PEXELS:**
Use these PRE-SELECTED high-quality Pexels photos. Each URL is unique and themed to the website topic.

**HERO BACKGROUND (use this exact URL):**
url('${heroUrl}')

**CONTENT IMAGES (use these for main sections, about page, features):**
${contentUrls.map((url, i) => `Image ${i + 1}: ${url}`).join("\n")}

**CARD/FEATURE IMAGES (use these for service cards, gallery, products):**
${cardUrls.map((url, i) => `Card ${i + 1}: ${url}`).join("\n")}

**PORTRAIT/TEAM IMAGES (use these for testimonials, team members):**
${portraitUrls.length > 0 ? portraitUrls.map((url, i) => `Portrait ${i + 1}: ${url}`).join("\n") : "Use https://picsum.photos/400/400?random=X with different numbers"}

**FALLBACK:** If you need more images than provided above, use: https://picsum.photos/{width}/{height}?random={unique_number}

**IMPORTANT:**
- Use EACH Pexels URL only ONCE (they are unique photos)
- Alt text MUST be in the same language as the website content
- Add loading="lazy" to all images
- For CSS backgrounds: url('...') format
- For img tags: <img src="..." alt="[Description in site language]" loading="lazy">
`.trim();
}

// CSS for images - common to both strategies
const IMAGE_CSS = `
**REQUIRED CSS FOR IMAGES:**
.hero {
  position: relative;
  min-height: 80vh;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}
.hero-content { position: relative; z-index: 1; color: white; text-align: center; }
img { max-width: 100%; height: auto; display: block; }
.card img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; }

**MOBILE-FIRST BREAKPOINTS:**
/* Mobile (default) */
/* Tablet: 768px */
@media (min-width: 768px) { ... }
/* Desktop: 1024px */
@media (min-width: 1024px) { ... }
/* Large: 1280px */
@media (min-width: 1280px) { ... }

**MOBILE MENU (MANDATORY in script.js):**
- Hamburger button visible on mobile
- Toggle menu open/close
- Close menu when clicking a link

**COOKIE BANNER - DESIGN INTEGRATED:**
- Subtle, non-intrusive design at bottom
- Matches site color scheme
- Clear Accept/Decline buttons
- position: fixed; bottom: 0

**OUTPUT FORMAT (MANDATORY):**
<!-- FILE: styles.css -->
[Complete CSS 300+ lines with all styles including image handling]

<!-- FILE: index.html -->
[Homepage with hero background image, feature cards with images, WORKING navigation with href="page.html" format]

<!-- FILE: about.html -->
[SAME header/footer with IDENTICAL navigation, about content]

<!-- FILE: services.html -->
[SAME header/footer with IDENTICAL navigation, services content]

<!-- FILE: contact.html -->
[SAME header/footer with IDENTICAL navigation, contact form]

<!-- FILE: privacy.html -->
[SAME header/footer with IDENTICAL navigation, privacy policy]

<!-- FILE: script.js -->
[Cookie banner, mobile menu toggle]

<!-- FILE: robots.txt -->
User-agent: *
Allow: /

<!-- FILE: sitemap.xml -->
[Complete sitemap with relative URLs]

CRITICAL: ALL navigation links MUST use relative paths like href="about.html", NOT absolute paths. Header and footer HTML structure MUST be identical across all HTML files with working links between pages.`;


type GeneratedFile = { path: string; content: string };

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

// Retry helper with exponential backoff for AI API calls
// Optimized: shorter timeout (90s), fewer retries (2) to stay within edge function limits
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  baseDelay = 1500,
  timeoutMs = 90000 // 90 seconds default timeout
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt + 1}/${maxRetries} (timeout: ${timeoutMs/1000}s)...`);
      
      // Create AbortController with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If we get a response (even error), return it
      if (response) {
        console.log(`✅ Fetch successful on attempt ${attempt + 1}, status: ${response.status}`);
        return response;
      }
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError?.message || String(error);
      console.error(`❌ Fetch attempt ${attempt + 1} failed: ${errorMessage}`);
      
      // Check if it's a connection error worth retrying
      const isRetryable = 
        errorMessage.includes('error reading a body from connection') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network') ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT');
      
      if (!isRetryable) {
        // Non-retryable error - fail immediately
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        // Quick retry: 1.5s, 3s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('All fetch retries exhausted');
}

// Pricing per 1000 tokens (in USD)
const TOKEN_PRICING = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "google/gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
  "google/gemini-2.5-pro": { input: 0.00125, output: 0.005 },
};

const calculateCost = (usage: TokenUsage, model: string): number => {
  const pricing = TOKEN_PRICING[model as keyof typeof TOKEN_PRICING];
  if (!pricing) {
    console.log(`Unknown model for pricing: ${model}, using default`);
    return 0;
  }
  const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1000) * pricing.output;
  const totalCost = inputCost + outputCost;
  console.log(`💰 Token usage for ${model}: ${usage.prompt_tokens} in, ${usage.completion_tokens} out = $${totalCost.toFixed(6)}`);
  return totalCost;
};

type GenerationResult = {
  success: boolean;
  files?: GeneratedFile[];
  refinedPrompt?: string;
  totalFiles?: number;
  fileList?: string[];
  error?: string;
  rawResponse?: string;
  totalCost?: number;
  specificModel?: string;
};

const cleanFileContent = (content: string) => {
  let c = content.trim();
  c = c.replace(/^```[a-z0-9_-]*\s*\n/i, "");
  c = c.replace(/\n```\s*$/i, "");
  return c.trim();
};

const parseFilesFromModelText = (rawText: string) => {
  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const filesMap = new Map<string, string>();

  const upsertFile = (path: string, content: string, source: string) => {
    const cleanPath = path.trim();
    const cleanContent = cleanFileContent(content);
    if (!cleanPath || cleanContent.length <= 10) return;
    filesMap.set(cleanPath, cleanContent);
    console.log(`✅ Found (${source}): ${cleanPath} (${cleanContent.length} chars)`);
  };

  const filePattern1 = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;
  let match;
  while ((match = filePattern1.exec(normalizedText)) !== null) {
    upsertFile(match[1], match[2], "format1");
  }

  if (filesMap.size === 0) {
    console.log("Trying OpenAI markdown headings format...");

    const headers: { path: string; start: number; contentStart: number }[] = [];
    const headerRegex = /(^|\n)(?:###\s*(?:File:\s*)?(?:[A-Za-z]+\s*\()?\s*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\)?|\*\*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\*\*)/gi;

    while ((match = headerRegex.exec(normalizedText)) !== null) {
      const fileName = (match[2] || match[3] || "").trim();
      if (!fileName) continue;

      const afterHeader = match.index + match[0].length;
      const lineBreak = normalizedText.indexOf("\n", afterHeader);
      const contentStart = lineBreak === -1 ? normalizedText.length : lineBreak + 1;

      headers.push({ path: fileName, start: match.index, contentStart });
    }

    for (let i = 0; i < headers.length; i++) {
      const start = headers[i].contentStart;
      const end = headers[i + 1]?.start ?? normalizedText.length;
      const chunk = normalizedText.slice(start, end);
      upsertFile(headers[i].path, chunk, "format2");
    }
  }

  return Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
};

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
  const isJunior = aiModel === "junior";
  console.log(`Using ${isJunior ? "Junior AI (OpenAI GPT-4o)" : "Senior AI (Lovable AI)"} for HTML generation`);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (isJunior && !OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return { success: false, error: "OpenAI API key not configured for Junior AI" };
  }

  if (!isJunior && !LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return { success: false, error: "Lovable AI not configured for Senior AI" };
  }

  console.log("Generating HTML website for prompt:", prompt.substring(0, 100));

  const apiUrl = isJunior
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const apiKey = isJunior ? OPENAI_API_KEY : LOVABLE_API_KEY;
  const refineModel = isJunior ? "gpt-4o-mini" : "google/gemini-2.5-flash";
  const generateModel = isJunior ? "gpt-4o" : "google/gemini-2.5-pro";

  // Step 1: refined prompt (with retry logic, shorter timeout for refine step)
  let agentResponse: Response;
  try {
    agentResponse = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: refineModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + (siteName ? `\n\nCRITICAL SITE NAME REQUIREMENT: The website/business/brand name MUST be "${siteName}". Use this EXACT name in the logo, header, footer, page titles, meta tags, copyright, and all references to the business. Do NOT invent a different name.` : "") },
          {
            role: "user",
            content: `Create a detailed prompt for static HTML/CSS website generation based on this request:\n\n"${prompt}"${siteName ? `\n\nIMPORTANT: The website name/brand MUST be "${siteName}".` : ""}\n\nTARGET CONTENT LANGUAGE: ${language === "uk" ? "Ukrainian" : language === "en" ? "English" : language === "de" ? "German" : language === "pl" ? "Polish" : language === "ru" ? "Russian" : language || "auto-detect from user's request, default to English"}`,
          },
        ],
      }),
    }, 2, 1000, 30000); // 2 retries, 1s delay, 30s timeout for refine
  } catch (fetchError) {
    const errorMsg = (fetchError as Error)?.message || String(fetchError);
    console.error("Agent AI fetch failed after retries:", errorMsg);
    return { success: false, error: errorMsg };
  }

  if (!agentResponse.ok) {
    const errorText = await agentResponse.text();
    console.error("Agent AI error:", agentResponse.status, errorText);

    if (agentResponse.status === 429) return { success: false, error: "Rate limit exceeded. Please try again later." };
    if (agentResponse.status === 402) return { success: false, error: "AI credits exhausted. Please add funds." };

    return { success: false, error: "AI agent error" };
  }

  const agentData = await agentResponse.json();
  const refinedPrompt = agentData.choices?.[0]?.message?.content || prompt;
  
  // Track token usage for refine step
  let totalCost = 0;
  const agentUsage = agentData.usage as TokenUsage | undefined;
  if (agentUsage) {
    totalCost += calculateCost(agentUsage, refineModel);
  }
  
  console.log("Refined prompt generated, now generating HTML website...");

  // Select layout: use provided layoutStyle or random
  const selectedLayout = layoutStyle 
    ? LAYOUT_VARIATIONS.find(l => l.id === layoutStyle) || LAYOUT_VARIATIONS[Math.floor(Math.random() * LAYOUT_VARIATIONS.length)]
    : LAYOUT_VARIATIONS[Math.floor(Math.random() * LAYOUT_VARIATIONS.length)];
  console.log(`Selected layout variation: ${selectedLayout.name} (${layoutStyle ? 'manual' : 'random'})`);

  // Fetch Pexels photos if AI image source selected
  let imageStrategy = IMAGE_STRATEGY_BASIC;
  if (imageSource === "ai") {
    const keywords = await extractKeywordsAI(prompt, apiKey!, isJunior);
    console.log(`📸 Fetching Pexels photos for keywords: "${keywords}"`);
    const pexelsUrls = await fetchPexelsPhotos(keywords, 15);
    imageStrategy = buildPexelsImageStrategy(pexelsUrls);
  }

  // Step 2: Static HTML website generation
  const websiteRequestBody: Record<string, unknown> = {
    model: generateModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert HTML/CSS/JS generator. Return ONLY file blocks using exact markers like: <!-- FILE: index.html -->. No explanations. No markdown.",
      },
      {
        role: "user",
        content: `${HTML_GENERATION_PROMPT}\n\n${imageStrategy}\n\n${IMAGE_CSS}\n\n=== MANDATORY LAYOUT STRUCTURE (FOLLOW EXACTLY) ===\n${selectedLayout.description}\n\n=== USER'S ORIGINAL REQUEST (MUST FOLLOW EXACTLY) ===\n${prompt}\n\n=== TARGET WEBSITE LANGUAGE (CRITICAL - MUST FOLLOW EXACTLY) ===\nALL website content MUST be in: ${language === "uk" ? "UKRAINIAN language" : language === "en" ? "ENGLISH language" : language === "de" ? "GERMAN language" : language === "pl" ? "POLISH language" : language === "ru" ? "RUSSIAN language" : language === "fr" ? "FRENCH language" : language === "es" ? "SPANISH language" : language ? language.toUpperCase() + " language" : "ENGLISH language (default)"}\n\nThis includes: navigation, buttons, headings, paragraphs, footer, cookie banner, ALL text content. DO NOT MIX LANGUAGES.\n\n=== ENHANCED DETAILS (KEEP FIDELITY TO ORIGINAL) ===\n${refinedPrompt}`,
      },
    ],
  };

  // Set max_tokens for both models to ensure complete generation
  // Junior: 16000 tokens, Senior: 32000 tokens for comprehensive multi-page websites
  websiteRequestBody.max_tokens = isJunior ? 16000 : 32000;

  // Step 2: Website generation with retry logic (main generation needs longer timeout)
  let websiteResponse: Response;
  try {
    websiteResponse = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(websiteRequestBody),
    }, 2, 2000, 180000); // 2 retries, 2s delay, 3 min timeout for main generation
  } catch (fetchError) {
    const errorMsg = (fetchError as Error)?.message || String(fetchError);
    console.error("Website generation fetch failed after retries:", errorMsg);
    return { success: false, error: errorMsg, totalCost };
  }

  if (!websiteResponse.ok) {
    const errorText = await websiteResponse.text();
    console.error("Website generation error:", websiteResponse.status, errorText);

    if (websiteResponse.status === 429) return { success: false, error: "Rate limit exceeded. Please try again later.", totalCost };
    if (websiteResponse.status === 402) return { success: false, error: "AI credits exhausted. Please add funds.", totalCost };

    return { success: false, error: "Website generation failed", totalCost };
  }

  // Parse JSON response with error handling for truncated responses
  // CRITICAL: Clone response before consuming to avoid "Body already consumed" error
  let websiteData: Record<string, unknown>;
  let rawText: string;
  
  // First, get the raw text to have a fallback
  const rawResponse = await websiteResponse.text();
  console.log("Raw response length:", rawResponse.length);
  
  try {
    // Parse the text as JSON
    websiteData = JSON.parse(rawResponse);
    rawText = (websiteData.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content || "";
  } catch (jsonError) {
    // If JSON parsing fails, try to extract content from partial JSON
    console.error("JSON parsing failed, attempting text extraction:", jsonError);
    
    // Try to extract content from partial JSON
    const contentMatch = rawResponse.match(/"content"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|\s*$)/);
    if (contentMatch && contentMatch[1]) {
      rawText = contentMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      console.log("Extracted content from partial JSON, length:", rawText.length);
    } else {
      // Last resort: try to find FILE markers directly in the raw response
      if (rawResponse.includes("<!-- FILE:") || rawResponse.includes("// FILE:")) {
        rawText = rawResponse;
        console.log("Using raw response as text, contains FILE markers");
      } else {
        return { success: false, error: "Failed to parse AI response - incomplete JSON", totalCost };
      }
    }
    websiteData = {};
  }

  // Track token usage for generation step (if available)
  const websiteUsage = (websiteData.usage as { prompt_tokens?: number; completion_tokens?: number }) || undefined;
  if (websiteUsage) {
    totalCost += calculateCost(websiteUsage as TokenUsage, generateModel);
  }
  
  console.log(`💰 Total generation cost: $${totalCost.toFixed(6)}`);

  console.log("HTML website generated, parsing files...");
  console.log("Raw response length:", rawText.length);

  let files = parseFilesFromModelText(rawText);
  console.log(`📁 Total files parsed: ${files.length}`);

  if (files.length === 0) {
    console.error("No files parsed from response");
    return {
      success: false,
      error: "Failed to parse generated files",
      rawResponse: rawText.substring(0, 500),
      totalCost,
    };
  }

  // MANDATORY: Create separate cookie-banner.js file and include in all HTML files
  const ensureCookieBannerFile = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const COOKIE_BANNER_JS = `/**
 * Cookie Banner - MANDATORY FILE
 * This file handles cookie consent for GDPR compliance
 */
(function() {
  'use strict';
  
  // Cookie Banner HTML
  var bannerHTML = '<div id="cookie-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.95);color:#fff;padding:20px;z-index:99999;box-shadow:0 -4px 20px rgba(0,0,0,0.3);font-family:system-ui,-apple-system,sans-serif;">' +
    '<div style="max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:15px;">' +
    '<p style="margin:0;flex:1;min-width:200px;font-size:14px;line-height:1.5;">We use cookies to enhance your browsing experience and analyze site traffic. By clicking "Accept", you consent to our use of cookies.</p>' +
    '<div style="display:flex;gap:10px;">' +
    '<button id="cookie-accept" style="background:#22c55e;color:#fff;border:none;padding:12px 24px;cursor:pointer;font-weight:600;border-radius:6px;transition:all 0.2s;">Accept</button>' +
    '<button id="cookie-decline" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.3);padding:12px 24px;cursor:pointer;font-weight:600;border-radius:6px;transition:all 0.2s;">Decline</button>' +
    '</div></div></div>';

  function initCookieBanner() {
    // Check if consent already given
    if (localStorage.getItem('cookieConsent')) {
      return;
    }
    
    // Inject banner into page
    var container = document.createElement('div');
    container.innerHTML = bannerHTML;
    document.body.appendChild(container.firstChild);
    
    var banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.style.display = 'flex';
      
      // Accept button
      var acceptBtn = document.getElementById('cookie-accept');
      if (acceptBtn) {
        acceptBtn.addEventListener('click', function() {
          localStorage.setItem('cookieConsent', 'accepted');
          banner.style.display = 'none';
        });
      }
      
      // Decline button
      var declineBtn = document.getElementById('cookie-decline');
      if (declineBtn) {
        declineBtn.addEventListener('click', function() {
          localStorage.setItem('cookieConsent', 'declined');
          banner.style.display = 'none';
        });
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
  } else {
    initCookieBanner();
  }
})();`;

    // Always add cookie-banner.js file
    const hasCookieBannerFile = generatedFiles.some(f => f.path === 'cookie-banner.js');
    if (!hasCookieBannerFile) {
      console.log("📁 Adding mandatory cookie-banner.js file");
      generatedFiles.push({
        path: "cookie-banner.js",
        content: COOKIE_BANNER_JS
      });
    }

    // Ensure all HTML files include the cookie-banner.js script
    return generatedFiles.map(file => {
      if (!file.path.endsWith('.html')) return file;
      
      let content = file.content;
      const hasCookieScript = content.includes('cookie-banner.js') || content.includes('cookie-banner') || content.includes('cookieConsent');
      
      if (!hasCookieScript) {
        console.log(`⚠️ Adding cookie-banner.js script to ${file.path}`);
        
        // Add script tag before </body>
        if (content.includes('</body>')) {
          content = content.replace('</body>', '  <script src="cookie-banner.js"></script>\n</body>');
        } else if (content.includes('</html>')) {
          content = content.replace('</html>', '<script src="cookie-banner.js"></script>\n</html>');
        } else {
          content = content + '\n<script src="cookie-banner.js"></script>';
        }
      }
      
      return { ...file, content };
    });
  };

  // MANDATORY: Ensure all required legal pages exist and have proper content
  // Also replaces incomplete/empty pages (less than 2000 chars for legal pages)
  const ensureMandatoryPages = (generatedFiles: GeneratedFile[], lang: string = "en"): GeneratedFile[] => {
    const fileMap = new Map(generatedFiles.map(f => [f.path.toLowerCase(), f]));
    
    // Extract header/footer from index.html for consistent styling
    const indexFile = fileMap.get("index.html");
    let headerHtml = "";
    let footerHtml = "";
    let siteName = "Company";
    let cssLink = '<link rel="stylesheet" href="styles.css">';
    
    if (indexFile) {
      const content = indexFile.content;
      // Extract header
      const headerMatch = content.match(/<header[\s\S]*?<\/header>/i);
      if (headerMatch) headerHtml = headerMatch[0];
      // Extract footer
      const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
      if (footerMatch) footerHtml = footerMatch[0];
      // Extract site name from title
      const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) siteName = titleMatch[1].split(/[-|]/)[0].trim();
      // Extract CSS link for consistent styling
      const cssMatch = content.match(/<link[^>]*stylesheet[^>]*>/i);
      if (cssMatch) cssLink = cssMatch[0];
    }
    
    const mandatoryPages = [
      { file: "privacy.html", title: lang === "uk" ? "Політика конфіденційності" : lang === "ru" ? "Политика конфиденциальности" : lang === "de" ? "Datenschutzerklärung" : "Privacy Policy", minLength: 2000 },
      { file: "terms.html", title: lang === "uk" ? "Умови використання" : lang === "ru" ? "Условия использования" : lang === "de" ? "Nutzungsbedingungen" : "Terms of Service", minLength: 2000 },
      { file: "cookie-policy.html", title: lang === "uk" ? "Політика cookies" : lang === "ru" ? "Политика cookies" : lang === "de" ? "Cookie-Richtlinie" : "Cookie Policy", minLength: 2000 },
      { file: "thank-you.html", title: lang === "uk" ? "Дякуємо" : lang === "ru" ? "Спасибо" : lang === "de" ? "Danke" : "Thank You", minLength: 500 },
    ];
    
    // Filter out incomplete mandatory pages and add proper versions
    const filteredFiles = generatedFiles.filter(f => {
      const fileName = f.path.toLowerCase();
      const mandatoryPage = mandatoryPages.find(mp => mp.file === fileName);
      if (mandatoryPage) {
        // Check if page is too short (incomplete)
        if (f.content.length < mandatoryPage.minLength) {
          console.log(`⚠️ Replacing incomplete page ${f.path} (${f.content.length} chars < ${mandatoryPage.minLength} min)`);
          return false; // Remove this file, will be regenerated
        }
      }
      return true;
    });
    
    const filteredFileMap = new Map(filteredFiles.map(f => [f.path.toLowerCase(), f]));
    
    for (const page of mandatoryPages) {
      if (!filteredFileMap.has(page.file)) {
        console.log(`📁 Adding/regenerating mandatory page: ${page.file}`);
        const pageContent = generateMandatoryPageContent(page.file, page.title, siteName, headerHtml, footerHtml, lang);
        filteredFiles.push({ path: page.file, content: pageContent });
      }
    }
    
    return filteredFiles;
  };

  const generateMandatoryPageContent = (fileName: string, title: string, siteName: string, header: string, footer: string, lang: string): string => {
    const backText = lang === "uk" ? "Повернутися на головну" : lang === "ru" ? "Вернуться на главную" : lang === "de" ? "Zurück zur Startseite" : "Back to Home";
    
    if (fileName === "thank-you.html") {
      const thankYouTitle = lang === "uk" ? "Дякуємо за звернення!" : lang === "ru" ? "Спасибо за обращение!" : lang === "de" ? "Danke für Ihre Nachricht!" : "Thank You for Contacting Us!";
      const thankYouText = lang === "uk" ? "Ми отримали ваше повідомлення і зв'яжемося з вами найближчим часом." : lang === "ru" ? "Мы получили ваше сообщение и свяжемся с вами в ближайшее время." : lang === "de" ? "Wir haben Ihre Nachricht erhalten und werden uns in Kürze bei Ihnen melden." : "We have received your message and will get back to you shortly.";
      
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${siteName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    ${header}
    <main class="thank-you-page" style="min-height: 60vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 80px 20px;">
        <div class="container">
            <div style="font-size: 80px; margin-bottom: 30px;">✓</div>
            <h1 style="font-size: 2.5rem; margin-bottom: 20px;">${thankYouTitle}</h1>
            <p style="font-size: 1.2rem; color: #666; margin-bottom: 40px;">${thankYouText}</p>
            <a href="index.html" class="btn" style="display: inline-block; padding: 15px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">${backText}</a>
        </div>
    </main>
    ${footer}
    <script src="cookie-banner.js"></script>
</body>
</html>`;
    }
    
    // Generate legal page content
    const legalContent = generateLegalContent(fileName, siteName, lang);
    
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${siteName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    ${header}
    <main class="legal-page" style="padding: 80px 20px; max-width: 900px; margin: 0 auto;">
        <h1 style="font-size: 2.5rem; margin-bottom: 40px;">${title}</h1>
        ${legalContent}
        <p style="margin-top: 40px;"><a href="index.html">${backText}</a></p>
    </main>
    ${footer}
    <script src="cookie-banner.js"></script>
</body>
</html>`;
  };

  const generateLegalContent = (fileName: string, siteName: string, lang: string): string => {
    if (fileName === "privacy.html") {
      if (lang === "uk" || lang === "ru") {
        return `<section style="margin-bottom: 30px;"><h2>1. Загальні положення</h2><p>Ця Політика конфіденційності описує, як ${siteName} збирає, використовує та захищає вашу особисту інформацію.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Які дані ми збираємо</h2><p>Ми можемо збирати: контактну інформацію (ім'я, email, телефон), технічні дані (IP-адреса, тип браузера), файли cookies.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Як ми використовуємо дані</h2><p>Дані використовуються для: надання послуг, покращення сервісу, зв'язку з вами, аналітики.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Захист даних</h2><p>Ми вживаємо всіх необхідних заходів для захисту ваших персональних даних.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Ваші права</h2><p>Ви маєте право на доступ, виправлення та видалення ваших даних.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Контакти</h2><p>З питань конфіденційності зв'яжіться з нами через контактну форму.</p></section>`;
      }
      return `<section style="margin-bottom: 30px;"><h2>1. Introduction</h2><p>This Privacy Policy describes how ${siteName} collects, uses, and protects your personal information when you use our website.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Information We Collect</h2><p>We may collect: contact information (name, email, phone), technical data (IP address, browser type), cookies and usage data.</p></section>
<section style="margin-bottom: 30px;"><h2>3. How We Use Your Information</h2><p>Your data is used to: provide our services, improve user experience, communicate with you, analyze website usage.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Data Protection</h2><p>We implement appropriate security measures to protect your personal data from unauthorized access.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Your Rights</h2><p>You have the right to access, correct, and delete your personal data at any time.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Contact Us</h2><p>For privacy-related questions, please contact us through our contact form.</p></section>`;
    }
    
    if (fileName === "terms.html") {
      if (lang === "uk" || lang === "ru") {
        return `<section style="margin-bottom: 30px;"><h2>1. Прийняття умов</h2><p>Використовуючи наш веб-сайт, ви погоджуєтеся з цими Умовами використання.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Опис послуг</h2><p>${siteName} надає інформаційні та консультаційні послуги.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Правила користування</h2><p>Ви погоджуєтеся використовувати сайт лише в законних цілях.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Інтелектуальна власність</h2><p>Весь контент сайту є власністю ${siteName} і захищений законом.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Обмеження відповідальності</h2><p>Ми не несемо відповідальності за будь-які прямі чи непрямі збитки.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Зміни умов</h2><p>Ми залишаємо за собою право змінювати ці умови в будь-який час.</p></section>`;
      }
      return `<section style="margin-bottom: 30px;"><h2>1. Acceptance of Terms</h2><p>By using our website, you agree to be bound by these Terms of Service.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Description of Services</h2><p>${siteName} provides informational and consulting services as described on our website.</p></section>
<section style="margin-bottom: 30px;"><h2>3. User Conduct</h2><p>You agree to use our website only for lawful purposes and in compliance with all applicable laws.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Intellectual Property</h2><p>All content on this website is the property of ${siteName} and protected by copyright law.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Limitation of Liability</h2><p>We shall not be liable for any direct, indirect, incidental, or consequential damages.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Changes to Terms</h2><p>We reserve the right to modify these terms at any time without prior notice.</p></section>`;
    }
    
    if (fileName === "cookie-policy.html") {
      if (lang === "uk" || lang === "ru") {
        return `<section style="margin-bottom: 30px;"><h2>1. Що таке cookies</h2><p>Cookies — це невеликі текстові файли, які зберігаються на вашому пристрої при відвідуванні веб-сайту.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Як ми використовуємо cookies</h2><p>Ми використовуємо cookies для: запам'ятовування ваших налаштувань, аналітики, покращення функціональності сайту.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Типи cookies</h2>
<table style="width:100%; border-collapse: collapse; margin: 20px 0;"><thead><tr style="background:#f5f5f5;"><th style="padding:12px; border:1px solid #ddd;">Назва</th><th style="padding:12px; border:1px solid #ddd;">Тип</th><th style="padding:12px; border:1px solid #ddd;">Термін</th><th style="padding:12px; border:1px solid #ddd;">Призначення</th></tr></thead><tbody><tr><td style="padding:12px; border:1px solid #ddd;">cookieConsent</td><td style="padding:12px; border:1px solid #ddd;">Необхідний</td><td style="padding:12px; border:1px solid #ddd;">1 рік</td><td style="padding:12px; border:1px solid #ddd;">Зберігає згоду на cookies</td></tr></tbody></table></section>
<section style="margin-bottom: 30px;"><h2>4. Управління cookies</h2><p>Ви можете видалити або заблокувати cookies в налаштуваннях вашого браузера.</p></section>`;
      }
      return `<section style="margin-bottom: 30px;"><h2>1. What Are Cookies</h2><p>Cookies are small text files stored on your device when you visit a website.</p></section>
<section style="margin-bottom: 30px;"><h2>2. How We Use Cookies</h2><p>We use cookies to: remember your preferences, analyze website traffic, improve site functionality.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Types of Cookies</h2>
<table style="width:100%; border-collapse: collapse; margin: 20px 0;"><thead><tr style="background:#f5f5f5;"><th style="padding:12px; border:1px solid #ddd;">Name</th><th style="padding:12px; border:1px solid #ddd;">Type</th><th style="padding:12px; border:1px solid #ddd;">Duration</th><th style="padding:12px; border:1px solid #ddd;">Purpose</th></tr></thead><tbody><tr><td style="padding:12px; border:1px solid #ddd;">cookieConsent</td><td style="padding:12px; border:1px solid #ddd;">Essential</td><td style="padding:12px; border:1px solid #ddd;">1 year</td><td style="padding:12px; border:1px solid #ddd;">Stores cookie consent</td></tr></tbody></table></section>
<section style="margin-bottom: 30px;"><h2>4. Managing Cookies</h2><p>You can delete or block cookies through your browser settings.</p></section>`;
    }
    
    return "";
  };

  // QUALITY CSS ENFORCEMENT: Ensure styles.css has proper quality and all required styles
  // Reference: Based on professional site examples with 600+ lines of comprehensive CSS
  const ensureQualityCSS = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const MINIMUM_CSS_LINES = 500; // Minimum lines for quality CSS (increased from 400)
    const MINIMUM_QUALITY_SCORE = 6; // Minimum quality score out of 10 indicators
    
    // 10 unique color schemes for variety (with RGB values for rgba usage)
    const COLOR_SCHEMES = [
      { name: 'ocean', primary: '#0d4f8b', primaryRgb: '13, 79, 139', secondary: '#1a365d', accent: '#3182ce', heading: '#1a202c', text: '#4a5568', bgLight: '#ebf8ff', border: '#bee3f8' },
      { name: 'forest', primary: '#276749', primaryRgb: '39, 103, 73', secondary: '#22543d', accent: '#38a169', heading: '#1a202c', text: '#4a5568', bgLight: '#f0fff4', border: '#9ae6b4' },
      { name: 'sunset', primary: '#c53030', primaryRgb: '197, 48, 48', secondary: '#9b2c2c', accent: '#e53e3e', heading: '#1a202c', text: '#4a5568', bgLight: '#fff5f5', border: '#feb2b2' },
      { name: 'royal', primary: '#553c9a', primaryRgb: '85, 60, 154', secondary: '#44337a', accent: '#805ad5', heading: '#1a202c', text: '#4a5568', bgLight: '#faf5ff', border: '#d6bcfa' },
      { name: 'slate', primary: '#2d3748', primaryRgb: '45, 55, 72', secondary: '#1a202c', accent: '#4a5568', heading: '#1a202c', text: '#4a5568', bgLight: '#f7fafc', border: '#e2e8f0' },
      { name: 'teal', primary: '#234e52', primaryRgb: '35, 78, 82', secondary: '#1d4044', accent: '#319795', heading: '#1a202c', text: '#4a5568', bgLight: '#e6fffa', border: '#81e6d9' },
      { name: 'coral', primary: '#c05621', primaryRgb: '192, 86, 33', secondary: '#9c4221', accent: '#dd6b20', heading: '#1a202c', text: '#4a5568', bgLight: '#fffaf0', border: '#fbd38d' },
      { name: 'midnight', primary: '#1a1a2e', primaryRgb: '26, 26, 46', secondary: '#16213e', accent: '#2563eb', heading: '#1a202c', text: '#4a5568', bgLight: '#f7fafc', border: '#e2e8f0' },
      { name: 'rose', primary: '#97266d', primaryRgb: '151, 38, 109', secondary: '#702459', accent: '#d53f8c', heading: '#1a202c', text: '#4a5568', bgLight: '#fff5f7', border: '#fbb6ce' },
      { name: 'emerald', primary: '#047857', primaryRgb: '4, 120, 87', secondary: '#065f46', accent: '#10b981', heading: '#1a202c', text: '#4a5568', bgLight: '#ecfdf5', border: '#6ee7b7' },
    ];
    
    // 5 unique border-radius styles
    const RADIUS_STYLES = [
      { sm: '4px', md: '8px', lg: '12px' },      // Sharp
      { sm: '8px', md: '12px', lg: '20px' },     // Rounded
      { sm: '12px', md: '16px', lg: '24px' },    // Soft
      { sm: '0', md: '0', lg: '0' },             // Square/Brutalist
      { sm: '50px', md: '50px', lg: '50px' },    // Pill
    ];
    
    // 5 unique shadow styles
    const SHADOW_STYLES = [
      { sm: '0 1px 3px rgba(0,0,0,0.08)', md: '0 4px 12px rgba(0,0,0,0.1)', lg: '0 12px 35px rgba(0,0,0,0.12)' },
      { sm: '0 2px 8px rgba(0,0,0,0.06)', md: '0 8px 25px rgba(0,0,0,0.08)', lg: '0 20px 50px rgba(0,0,0,0.1)' },
      { sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 3px 10px rgba(0,0,0,0.08)', lg: '0 8px 30px rgba(0,0,0,0.12)' },
      { sm: 'none', md: '0 4px 20px rgba(0,0,0,0.05)', lg: '0 10px 40px rgba(0,0,0,0.08)' },
      { sm: '2px 2px 0 rgba(0,0,0,0.1)', md: '4px 4px 0 rgba(0,0,0,0.15)', lg: '8px 8px 0 rgba(0,0,0,0.2)' }, // Brutalist
    ];
    
    // Randomly select style variations
    const colorScheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];
    const radiusStyle = RADIUS_STYLES[Math.floor(Math.random() * RADIUS_STYLES.length)];
    const shadowStyle = SHADOW_STYLES[Math.floor(Math.random() * SHADOW_STYLES.length)];
    
    console.log(`🎨 Selected style: ${colorScheme.name} theme, radius: ${radiusStyle.md}, shadow style: ${shadowStyle.md.substring(0, 20)}...`);
    
    // Premium baseline CSS with randomized variables
    const BASELINE_CSS = `:root {
  --primary-color: ${colorScheme.primary};
  --primary-color-rgb: ${colorScheme.primaryRgb};
  --secondary-color: ${colorScheme.secondary};
  --accent-color: ${colorScheme.accent};
  --heading-color: ${colorScheme.heading};
  --text-color: ${colorScheme.text};
  --text-muted: #718096;
  --bg-color: #f7fafc;
  --bg-light: ${colorScheme.bgLight};
  --white: #ffffff;
  --light-gray: ${colorScheme.bgLight};
  --border-color: ${colorScheme.border};
  --shadow-sm: ${shadowStyle.sm};
  --shadow-md: ${shadowStyle.md};
  --shadow-lg: ${shadowStyle.lg};
  --radius-sm: ${radiusStyle.sm};
  --radius-md: ${radiusStyle.md};
  --radius-lg: ${radiusStyle.lg};
  --transition: all 0.3s ease;
  --font-family-body: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-family-heading: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font-family-body);
  color: var(--text-color);
  background-color: var(--bg-color);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-family-heading);
  color: var(--heading-color);
  line-height: 1.3;
  font-weight: 700;
}

h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.5rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.75rem); }

a {
  color: var(--accent-color);
  text-decoration: none;
  transition: var(--transition);
}
a:hover { text-decoration: underline; }

img {
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

/* FORM ELEMENTS - ALWAYS STYLED, NEVER PLAIN */
input, select, textarea {
  font-family: var(--font-family-body);
  font-size: 1rem;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--white);
  color: var(--text-color);
  transition: var(--transition);
  width: 100%;
  box-sizing: border-box;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

input::placeholder, textarea::placeholder {
  color: var(--text-muted);
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23718096' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
  cursor: pointer;
}

textarea {
  min-height: 120px;
  resize: vertical;
}

/* Form layouts */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--heading-color);
}

.form-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.form-row .form-group {
  flex: 1;
  min-width: 200px;
}

/* Search forms */
.search-form, .filter-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.search-form input[type="search"],
.search-form input[type="text"] {
  flex: 1;
  min-width: 250px;
}

.search-form select,
.filter-form select {
  min-width: 180px;
  width: auto;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* HEADER & NAVIGATION */
.header {
  background-color: var(--white);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: var(--shadow-sm);
  border-bottom: 1px solid var(--border-color);
}

.nav, .nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.site-logo, .nav-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  text-decoration: none;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 1.5rem;
}

.nav-links a {
  color: var(--heading-color);
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  position: relative;
  padding: 0.5rem 0;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: var(--accent-color);
  transition: width 0.3s ease;
}

.nav-links a:hover::after,
.nav-links a.active::after {
  width: 100%;
}

.hamburger-menu, .nav-toggle {
  display: none;
  cursor: pointer;
  background: none;
  border: none;
  padding: 8px;
}

.hamburger-menu .bar, .nav-toggle span {
  display: block;
  width: 25px;
  height: 3px;
  margin: 5px 0;
  background-color: var(--primary-color);
  transition: var(--transition);
}

/* HERO SECTION */
.hero {
  position: relative;
  min-height: 70vh;
  max-height: 85vh;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
}

.hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(22, 33, 62, 0.6);
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 800px;
  padding: 0 20px;
}

.hero-title {
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 800;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  font-weight: 400;
  max-width: 700px;
  margin: 0 auto 2rem;
  opacity: 0.9;
}

/* IMAGES - CONSTRAINED */
.card-image, .service-card img, .feature-img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.avatar, .team-photo, .testimonial-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.gallery-item img {
  width: 100%;
  height: 250px;
  object-fit: cover;
}

.partner-logo, .client-logo {
  height: 40px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
  filter: grayscale(100%);
  opacity: 0.7;
  transition: var(--transition);
}

.partner-logo:hover { filter: grayscale(0); opacity: 1; }

/* BUTTONS */
.btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
  border: none;
  cursor: pointer;
}

.btn-primary {
  background-color: var(--accent-color);
  color: var(--white);
}

.btn-primary:hover {
  background-color: #1d4ed8;
  transform: translateY(-2px);
  text-decoration: none;
}

.btn-secondary {
  background: transparent;
  color: var(--accent-color);
  border: 2px solid var(--accent-color);
}

.btn-secondary:hover {
  background: var(--accent-color);
  color: white;
}

/* SECTIONS */
section, .section {
  padding: 80px 0;
}

section.light, .section.light {
  background: var(--light-gray);
}

.section-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 60px;
}

.section-label {
  display: inline-block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-color);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.section-title {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  margin-bottom: 16px;
}

.section-subtitle {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.7;
}

/* HERO - SPLIT LAYOUT */
.page-hero, .homepage-hero {
  padding: 100px 0 80px;
  background: var(--white);
}

.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.hero-copy {
  max-width: 560px;
}

.hero-copy .badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--light-gray), #e8f4f8);
  color: var(--heading-color);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 20px;
}

.hero-copy h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 20px;
}

.hero-copy > p {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 28px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.cta-button {
  display: inline-block;
  background: var(--accent-color);
  color: var(--white);
  padding: 14px 28px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}

.cta-button:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
  text-decoration: none;
}

.button-outline {
  display: inline-block;
  background: transparent;
  color: var(--accent-color);
  padding: 14px 28px;
  border: 2px solid var(--accent-color);
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}

.button-outline:hover {
  background: var(--accent-color);
  color: var(--white);
  text-decoration: none;
}

/* TAG PILLS / FILTER BUTTONS - THEMED STYLING */
.tag-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.tag-pills span {
  font-family: var(--font-family-body);
  background: linear-gradient(135deg, rgba(var(--primary-color-rgb, 37, 99, 235), 0.08) 0%, rgba(var(--primary-color-rgb, 37, 99, 235), 0.15) 100%);
  color: var(--primary-color);
  border: 1px solid rgba(var(--primary-color-rgb, 37, 99, 235), 0.25);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  backdrop-filter: blur(4px);
}

.tag-pills span:hover {
  background: var(--primary-color);
  color: var(--white);
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(var(--primary-color-rgb, 37, 99, 235), 0.25);
}

.tag-pills span.active {
  background: var(--primary-color);
  color: var(--white);
  border-color: var(--primary-color);
}

/* FILTER TABS - Alternative styled tabs for filtering */
.filter-tabs, .category-tabs, .service-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px;
  background: var(--bg-light);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.filter-tabs button, .category-tabs button, .service-tabs button,
.filter-tabs a, .category-tabs a, .service-tabs a {
  font-family: var(--font-family-body);
  background: transparent;
  color: var(--text-muted);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  text-decoration: none;
}

.filter-tabs button:hover, .category-tabs button:hover, .service-tabs button:hover,
.filter-tabs a:hover, .category-tabs a:hover, .service-tabs a:hover {
  background: rgba(var(--primary-color-rgb, 37, 99, 235), 0.1);
  color: var(--primary-color);
}

.filter-tabs button.active, .category-tabs button.active, .service-tabs button.active,
.filter-tabs a.active, .category-tabs a.active, .service-tabs a.active {
  background: var(--primary-color);
  color: var(--white);
  box-shadow: 0 2px 8px rgba(var(--primary-color-rgb, 37, 99, 235), 0.3);
}

/* BADGE/CHIP STYLING */
.badge, .chip, .tag {
  font-family: var(--font-family-body);
  display: inline-block;
  padding: 6px 14px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
  color: var(--white);
}

.badge.outline, .chip.outline, .tag.outline {
  background: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
}

.badge.secondary, .chip.secondary, .tag.secondary {
  background: var(--bg-light);
  color: var(--text-muted);
}

/* HERO VISUAL - PREVENT IMAGE OVERLAP */
.hero-visual {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  z-index: 1;
  isolation: isolate;
}

.hero-visual img {
  position: relative !important;
  display: block;
  width: 100%;
  max-width: 820px;
  height: auto;
  max-height: 580px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1;
}

/* Prevent any absolute positioned elements inside hero-visual */
.hero-visual::before,
.hero-visual::after {
  display: none !important;
}

.hero-visual * {
  position: relative !important;
}

/* STATS SECTION */
.stats-highlight {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: start;
}

.highlight-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.highlight-list li {
  position: relative;
  padding-left: 28px;
  margin-bottom: 20px;
  line-height: 1.7;
  color: var(--text-color);
}

.highlight-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 8px;
  height: 8px;
  background: var(--accent-color);
  border-radius: 50%;
}

.stats-numbers {
  display: grid;
  gap: 24px;
}

.stat-number {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  color: var(--accent-color);
  line-height: 1;
  margin-bottom: 8px;
}

.stat-caption {
  font-size: 0.95rem;
  color: var(--text-muted);
}

/* FEATURED GRID */
.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}

.featured-grid .card {
  background: var(--white);
  padding: 28px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: var(--transition);
}

.featured-grid .card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}

.featured-grid .card h3 {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.featured-grid .card p {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 16px;
}

.card-meta {
  font-size: 0.85rem;
  color: var(--accent-color);
  font-weight: 500;
}

/* MEDIA OBJECT */
.media-object {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.media-copy {
  max-width: 520px;
}

.media-copy h3 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  margin-bottom: 16px;
}

.media-copy > p {
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 20px;
}

.media-copy ul {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
}

.media-copy ul li {
  position: relative;
  padding-left: 24px;
  margin-bottom: 12px;
  line-height: 1.6;
}

.media-copy ul li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 6px;
  height: 6px;
  background: var(--accent-color);
  border-radius: 50%;
}

.cta-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

/* MEDIA VISUAL - PREVENT IMAGE OVERLAP */
.media-visual {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  z-index: 1;
  isolation: isolate;
}

.media-visual img {
  position: relative !important;
  display: block;
  width: 100%;
  max-width: 760px;
  height: auto;
  max-height: 560px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 1;
}

/* Prevent any absolute positioned elements inside media-visual */
.media-visual::before,
.media-visual::after {
  display: none !important;
}

.media-visual * {
  position: relative !important;
}

/* TIMELINE */
.timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 32px;
}

.timeline-step {
  position: relative;
  padding: 24px;
  background: var(--white);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.timeline-step h3 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--heading-color);
}

.timeline-step p {
  color: var(--text-muted);
  line-height: 1.6;
}

/* FORM CARD */
.form-card {
  background: var(--white);
  padding: 40px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-width: 700px;
  margin: 0 auto;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* RESPONSIVE */
@media (max-width: 992px) {
  .hero-inner, .media-object, .stats-highlight {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  
  .form-grid.two-columns {
    grid-template-columns: 1fr;
  }
}

/* CARDS & GRIDS */
.cards-grid, .grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

.card {
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: visible;
  box-shadow: var(--shadow-md);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}

.card-body {
  padding: 24px;
  overflow: visible;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--heading-color);
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.card-text {
  color: var(--text-muted);
  line-height: 1.6;
  font-size: 0.95rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* FORMS */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--heading-color);
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.form-control:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

textarea.form-control {
  min-height: 150px;
  resize: vertical;
}

/* FOOTER */
.footer {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0;
  padding: 60px 0 30px;
  margin-top: 80px;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-brand {
  max-width: 280px;
}

.footer-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 16px;
  display: block;
}

.footer-description {
  font-size: 0.9rem;
  line-height: 1.6;
  color: #a0a0a0;
  margin-bottom: 20px;
}

.footer-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--white);
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.footer-links {
  list-style: none;
}

.footer-links li {
  margin-bottom: 12px;
}

.footer-links a {
  color: #a0a0a0;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.footer-links a:hover {
  color: var(--white);
}

.footer-contact-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 0.9rem;
  color: #a0a0a0;
}

.footer-contact-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--accent-color);
}

.footer-social {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.footer-social a {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  transition: var(--transition);
}

.footer-social a:hover {
  background: var(--accent-color);
  transform: translateY(-3px);
}

.footer-divider {
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 30px 0;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.footer-copyright {
  font-size: 0.85rem;
  color: #707070;
}

.footer-legal-links {
  display: flex;
  gap: 24px;
}

.footer-legal-links a {
  font-size: 0.85rem;
  color: #707070;
  text-decoration: none;
}

.footer-legal-links a:hover {
  color: var(--white);
}

.disclaimer-section {
  color: #707070;
  font-size: 0.8rem;
  line-height: 1.5;
  padding-top: 20px;
}

/* LEGAL PAGES */
.legal-content {
  background: var(--white);
  padding: 40px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.legal-content h2 {
  font-size: 1.6rem;
  margin-top: 2rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.legal-content p, .legal-content ul {
  font-size: 1rem;
  line-height: 1.7;
  margin-bottom: 1rem;
}

/* ANIMATIONS */
.fade-in {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.fade-in.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* RESPONSIVE */
@media (max-width: 992px) {
  .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  .nav-toggle, .hamburger-menu { display: block; }
  .nav-links {
    position: fixed;
    top: 70px;
    left: -100%;
    width: 100%;
    height: calc(100vh - 70px);
    background-color: var(--white);
    flex-direction: column;
    align-items: center;
    padding-top: 2rem;
    transition: left 0.3s ease;
    gap: 1rem;
  }
  .nav-links.active { left: 0; }
  .hamburger-menu.active .bar:nth-child(2) { opacity: 0; }
  .hamburger-menu.active .bar:nth-child(1) { transform: translateY(8px) rotate(45deg); }
  .hamburger-menu.active .bar:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }
}

@media (max-width: 576px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; text-align: center; }
  .footer-brand { max-width: 100%; }
  .footer-bottom { flex-direction: column; text-align: center; }
  .footer-social { justify-content: center; }
}

/* COOKIE BANNER */
#cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0,0,0,0.95);
  color: var(--white);
  padding: 1.5rem;
  z-index: 10000;
  display: none;
}

/* TWO COLUMN LAYOUTS */
.two-col-section, .two-column-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.two-col-section.reverse .two-col-image,
.two-column-layout.reverse .column-image {
  order: -1;
}

.two-col-image img, .column-image img {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  height: auto;
}

.about-image {
  max-width: 500px;
  width: 100%;
  height: 350px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* ARTICLE STYLES */
.article-content {
  max-width: 800px;
  margin: 0 auto;
}

.article-header {
  text-align: center;
  margin-bottom: 3rem;
}

.article-title {
  font-size: clamp(2rem, 6vw, 3.5rem);
  font-weight: 800;
  margin-bottom: 1rem;
}

.article-subtitle {
  font-size: 1.3rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.article-hero-image {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  margin: 2rem 0 3rem;
  box-shadow: var(--shadow-lg);
}

.article-body {
  font-size: 1.1rem;
  line-height: 1.8;
}

.article-body h2 {
  font-size: 1.8rem;
  margin: 2.5rem 0 1rem;
}

.article-body h3 {
  font-size: 1.4rem;
  margin: 2rem 0 1rem;
}

.article-body p, .article-body ul, .article-body ol {
  margin-bottom: 1.5rem;
}

.article-body blockquote {
  border-left: 4px solid var(--accent-color);
  padding-left: 1.5rem;
  margin: 2rem 0;
  font-style: italic;
  font-size: 1.2rem;
  color: var(--heading-color);
}

.article-meta {
  margin-top: auto;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* PAGE HEADER */
.page-header {
  background: var(--primary-color);
  color: var(--white);
  padding: 5rem 0;
  text-align: center;
}

.page-title {
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  font-weight: 800;
  color: var(--white);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  font-size: 1.1rem;
  color: rgba(255,255,255,0.8);
  max-width: 600px;
  margin: 0 auto;
}

/* TABLES */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 30px 0;
  font-size: 0.95rem;
  background-color: var(--white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

thead {
  background: var(--light-gray);
}

th, td {
  padding: 15px 20px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: var(--light-gray);
}

/* THANK YOU PAGE */
.thank-you-section {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 20px;
}

.thank-you-icon {
  width: 80px;
  height: 80px;
  background: var(--accent-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30px;
  color: var(--white);
  font-size: 2.5rem;
}

/* CONTACT GRID */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 3rem;
  background-color: var(--white);
  padding: 3rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.contact-info h2 { margin-bottom: 1.5rem; }
.contact-info p { color: var(--text-muted); margin-bottom: 2rem; }

.contact-details li {
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.contact-details .icon {
  color: var(--accent-color);
  font-size: 1.5rem;
}

/* MAP CONTAINER */
.map-container {
  width: 100%;
  height: 450px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  margin-top: 4rem;
}

.map-container iframe { 
  width: 100%; 
  height: 100%; 
  border: none; 
}

/* DISCLAIMER SECTION */
.disclaimer-section {
  background-color: var(--light-gray);
  color: var(--text-muted);
  padding: 20px 30px;
  margin: 3rem auto;
  border-radius: var(--radius-md);
  text-align: center;
  font-size: 0.85rem;
  line-height: 1.6;
  max-width: 900px;
}

.disclaimer-section strong {
  display: block;
  margin-bottom: 8px;
  color: var(--heading-color);
}

/* ADDITIONAL RESPONSIVE */
@media (max-width: 992px) {
  .two-col-section, .two-column-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .two-col-section.reverse .two-col-image,
  .two-column-layout.reverse .column-image {
    order: 0;
  }
  .contact-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .map-container { height: 350px; }
  .contact-grid { padding: 2rem; }
}

/* CATEGORY LIST - STYLED CARDS */
.category-list, .services-list, .features-list, .sector-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-item, .service-item, .feature-item, .sector-item {
  background: var(--white);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border-left: 4px solid var(--accent-color);
  transition: all 0.3s ease;
}

.category-item:hover, .service-item:hover, .feature-item:hover, .sector-item:hover {
  transform: translateX(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.category-item h3, .service-item h3, .feature-item h3, .sector-item h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--heading-color);
}

.category-item p, .service-item p, .feature-item p, .sector-item p {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.category-item a, .service-item a, .feature-item a, .sector-item a {
  color: var(--accent-color);
  text-decoration: none;
}

.category-item a:hover, .service-item a:hover {
  text-decoration: underline;
}

/* NEWSLETTER/CTA SECTIONS - PROPERLY STYLED */
.newsletter-section, .cta-section, .subscribe-section {
  background: linear-gradient(135deg, var(--light-gray) 0%, #e8f4f8 100%);
  padding: 60px 20px;
  text-align: center;
  border-radius: 0;
}

.newsletter-section h2, .cta-section h2, .subscribe-section h2 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  margin-bottom: 12px;
}

.newsletter-section p, .cta-section p, .subscribe-section p {
  color: var(--text-muted);
  margin-bottom: 24px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.newsletter-form, .subscribe-form {
  display: flex;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto;
  flex-wrap: wrap;
  justify-content: center;
}

.newsletter-form input, .subscribe-form input {
  flex: 1;
  min-width: 250px;
  padding: 14px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  background: var(--white);
}

.newsletter-form input:focus, .subscribe-form input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.newsletter-form button, .subscribe-form button {
  padding: 14px 28px;
  background: var(--accent-color);
  color: var(--white);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.newsletter-form button:hover, .subscribe-form button:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
}

/* PREVENT OVERSIZED IMAGES */
section img:not(.avatar):not(.partner-logo):not(.client-logo):not(.testimonial-img):not(.team-photo) {
  max-height: 400px;
}

/* CONSISTENT SECTION BACKGROUNDS */
.bg-light, .section-light {
  background: var(--light-gray);
}

.bg-dark, .section-dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0;
}

.bg-dark h2, .bg-dark h3, .section-dark h2, .section-dark h3 {
  color: var(--white);
}

@media (max-width: 576px) {
  .newsletter-form, .subscribe-form {
    flex-direction: column;
  }
  .newsletter-form input, .subscribe-form input {
    min-width: 100%;
  }
  .category-list, .services-list, .features-list {
    grid-template-columns: 1fr;
  }
}`;

    // Check if styles.css exists
    const hasStylesCSS = generatedFiles.some(f => f.path === 'styles.css');
    
    // If no styles.css exists at all, CREATE it with baseline CSS
    if (!hasStylesCSS) {
      console.log(`🚨 CRITICAL: styles.css NOT FOUND! Creating with full baseline CSS.`);
      generatedFiles.push({
        path: 'styles.css',
        content: BASELINE_CSS
      });
      
      // Also ensure all HTML files link to styles.css
      generatedFiles = generatedFiles.map(file => {
        if (!file.path.endsWith('.html')) return file;
        
        let content = file.content;
        // Check if already has stylesheet link
        if (!content.includes('styles.css') && !content.includes('<link rel="stylesheet"')) {
          // Add stylesheet link in <head>
          if (content.includes('</head>')) {
            content = content.replace('</head>', '  <link rel="stylesheet" href="styles.css">\n</head>');
            console.log(`📎 Added styles.css link to ${file.path}`);
          }
        }
        return { ...file, content };
      });
      
      return generatedFiles;
    }
    
    // If styles.css exists, check and enhance quality
    return generatedFiles.map(file => {
      if (file.path !== 'styles.css') return file;
      
      const existingCSS = file.content;
      const lineCount = existingCSS.split('\n').length;
      const charCount = existingCSS.length;
      
      // Expanded quality indicators (10 total) for comprehensive check
      const qualityIndicators = {
        hasRootVars: existingCSS.includes(':root'),
        hasContainer: existingCSS.includes('.container'),
        hasFooter: existingCSS.includes('.footer') || existingCSS.includes('footer'),
        hasCard: existingCSS.includes('.card'),
        hasResponsive: existingCSS.includes('@media'),
        hasHeader: existingCSS.includes('.header') || existingCSS.includes('header'),
        hasHero: existingCSS.includes('.hero'),
        hasButton: existingCSS.includes('.btn'),
        hasForm: existingCSS.includes('.form') || existingCSS.includes('input'),
        hasNav: existingCSS.includes('.nav') || existingCSS.includes('nav-links'),
      };
      
      const qualityScore = Object.values(qualityIndicators).filter(Boolean).length;
      const hasMinimumLength = lineCount >= MINIMUM_CSS_LINES || charCount >= 15000;
      
      console.log(`📊 CSS Quality Check: ${lineCount} lines, ${charCount} chars, quality score: ${qualityScore}/10`);
      console.log(`📋 Quality indicators:`, JSON.stringify(qualityIndicators));
      
      // Enhanced logic: Apply baseline if CSS is too short OR missing critical patterns
      // Using stricter thresholds to ensure professional quality
      const needsEnhancement = !hasMinimumLength || qualityScore < MINIMUM_QUALITY_SCORE;
      
      if (needsEnhancement) {
        console.log(`⚠️ CSS quality insufficient (${lineCount} lines, score ${qualityScore}/${MINIMUM_QUALITY_SCORE} min). ENHANCING with baseline CSS.`);
        
        // Merge: baseline first, then generated CSS (generated can override)
        const enhancedCSS = BASELINE_CSS + '\n\n/* ===== SITE-SPECIFIC STYLES ===== */\n\n' + existingCSS;
        
        console.log(`✅ Enhanced CSS: ${enhancedCSS.split('\n').length} lines, ${enhancedCSS.length} chars`);
        
        return { ...file, content: enhancedCSS };
      }
      
      console.log(`✅ CSS quality sufficient - no enhancement needed`);
      return file;
    });
  };

  // NEW: Fix placeholder images, ensure proper hero backgrounds, and fix styling issues
  const fixPlaceholderImages = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    let imageCounter = 1;
    
    return generatedFiles.map(file => {
      if (!file.path.endsWith('.html')) return file;
      
      let content = file.content;
      let fixedCount = 0;
      
      // Fix 1: Replace SVG/placeholder src in img tags
      const badImagePatterns = [
        /src=["'](?:placeholder\.svg|icon\.svg|logo\.svg|image\.svg)["']/gi,
        /src=["'](?:data:image\/svg\+xml[^"']*)["']/gi,
        /src=["'](?:#|javascript:|about:blank)["']/gi,
        /src=["'][\s]*["']/g, // empty src
      ];
      
      for (const pattern of badImagePatterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, () => {
            fixedCount++;
            const randomNum = 100 + imageCounter++;
            return 'src="https://picsum.photos/600/400?random=' + randomNum + '"';
          });
        }
      }
      
      // Fix 2: Replace large inline SVGs that are used as hero/main images (not small icons)
      // Match SVG elements with width/height > 100 or viewBox suggesting large size
      const largeSvgPattern = /<svg[^>]*(?:width=["'](?:[2-9]\d{2}|[1-9]\d{3,})["']|height=["'](?:[2-9]\d{2}|[1-9]\d{3,})["']|class=["'][^"']*(?:hero|banner|main|feature)[^"']*["'])[^>]*>[\s\S]*?<\/svg>/gi;
      if (largeSvgPattern.test(content)) {
        content = content.replace(largeSvgPattern, () => {
          fixedCount++;
          const randomNum = 100 + imageCounter++;
          return '<img src="https://picsum.photos/600/400?random=' + randomNum + '" alt="Feature image" loading="lazy" class="feature-image">';
        });
      }
      
      // Fix 3: REMOVE background-image from hero sections that have <img> inside hero-visual
      // This prevents image overlap issues
      const heroSectionPattern = /<section([^>]*class=["'][^"']*(?:page-hero|homepage-hero)[^"']*["'])([^>]*)>/gi;
      content = content.replace(heroSectionPattern, (match, classAttr, restAttrs) => {
        // Remove style attribute with background-image
        if (restAttrs.includes('background-image')) {
          console.log(`🧹 Removing background-image from hero section in ${file.path} (conflicts with hero-visual img)`);
          restAttrs = restAttrs.replace(/\s*style=["'][^"']*background-image[^"']*["']/gi, '');
          fixedCount++;
        }
        return `<section${classAttr}${restAttrs}>`;
      });
      
      // Fix 4: Fix duplicate class="" attributes (CRITICAL - invalid HTML)
      // Pattern: class="something" followed by another class="something"
      content = content.replace(
        /<([a-z][a-z0-9]*)\s+([^>]*class=["'][^"']*["'])([^>]*)(class=["'][^"']*["'])([^>]*)>/gi,
        (match, tag, firstClass, middle, duplicateClass, rest) => {
          // Merge the classes
          const class1Match = firstClass.match(/class=["']([^"']*)["']/);
          const class2Match = duplicateClass.match(/class=["']([^"']*)["']/);
          
          if (class1Match && class2Match) {
            const mergedClasses = `${class1Match[1]} ${class2Match[1]}`.trim();
            console.log(`🔧 Fixed duplicate class attributes in ${file.path}: merging "${class1Match[1]}" + "${class2Match[1]}"`);
            fixedCount++;
            return `<${tag} class="${mergedClasses}"${middle}${rest}>`;
          }
          return match;
        }
      );
      
      // Fix 5: Remove background-image from style if section contains hero-visual with img
      // More aggressive cleanup for hero sections
      const heroWithBgAndImg = /<section([^>]*class=["'][^"']*hero[^"']*["'][^>]*style=["'][^"']*background-image[^"']*["'][^>]*)>([\s\S]*?<div[^>]*class=["'][^"']*hero-visual[^"']*["'][^>]*>[\s\S]*?<img[\s\S]*?<\/div>)/gi;
      content = content.replace(heroWithBgAndImg, (match, sectionAttrs, innerContent) => {
        // Remove background-image from section style
        const cleanedAttrs = sectionAttrs.replace(/style=["'][^"']*["']/gi, '');
        console.log(`🧹 Removed conflicting background-image from hero with img in ${file.path}`);
        fixedCount++;
        return `<section${cleanedAttrs}>${innerContent}`;
      });
      
      // Fix 5: Constrain image sizes - add max-height to any images missing it
      // Replace full-width images with constrained versions
      content = content.replace(
        /<img([^>]*)(style=["'][^"']*)(width:\s*100vw|width:\s*100%[^;]*;[^"']*height:\s*100vh)([^"']*["'])/gi,
        '<img$1$2max-height: 400px; object-fit: cover$4'
      );
      
      // Fix 6: Add proper class to unstyled sections with lists (category-like sections)
      // Convert plain dt/dd lists to styled format
      content = content.replace(
        /<dl([^>]*)>\s*(<dt>)/gi,
        '<dl$1 class="category-list"><$2'
      );
      
      // Fix 7: Wrap unstyled h3+p combinations in cards
      // This targets patterns like: <h3>Energy</h3><p>Oil, gas...</p>
      const unstyledListPattern = /<section[^>]*>[\s\S]*?(<h3>[^<]+<\/h3>\s*<p>[^<]+<\/p>\s*){3,}/gi;
      if (unstyledListPattern.test(content)) {
        console.log("🎨 Detected unstyled list section in " + file.path + " - adding style classes");
        
        // Add container class to sections without it
        content = content.replace(
          /<section([^>]*)>\s*<h2([^>]*)>([^<]+)<\/h2>/gi,
          '<section$1 class="section"><div class="container"><div class="section-header"><h2$2 class="section-title">$3</h2></div>'
        );
      }
      
      // Fix 8: Ensure newsletter sections have proper styling
      const newsletterPattern = /<section[^>]*class=["'][^"']*(?:newsletter|subscribe|cta)[^"']*["'][^>]*>/gi;
      if (!newsletterPattern.test(content)) {
        // Find newsletter-like sections by content and add class
        content = content.replace(
          /<section([^>]*)>([\s\S]*?(?:newsletter|subscribe|email address|inbox)[\s\S]*?)<\/section>/gi,
          '<section$1 class="newsletter-section">$2</section>'
        );
      }
      
      if (fixedCount > 0) {
        console.log("🔧 Fixed " + fixedCount + " issues in " + file.path);
      }
      
      return { ...file, content };
    });
  };

  // NEW: Validate HTML content is not empty/broken
  const validateHtmlContent = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    return generatedFiles.map(file => {
      if (!file.path.endsWith('.html')) return file;
      
      let content = file.content;
      
      // Check for common signs of broken HTML
      const hasBody = content.includes('<body') && content.includes('</body>');
      const hasHtml = content.includes('<html') && content.includes('</html>');
      const hasHead = content.includes('<head') && content.includes('</head>');
      const contentLength = content.length;
      
      // If HTML structure is fundamentally broken, log warning
      if (!hasBody || !hasHtml || !hasHead) {
        console.log(`⚠️ WARNING: ${file.path} has broken HTML structure (body: ${hasBody}, html: ${hasHtml}, head: ${hasHead})`);
      }
      
      // If page is too short (likely empty/broken), log warning
      if (contentLength < 500 && file.path === 'index.html') {
        console.log(`⚠️ WARNING: ${file.path} is suspiciously short (${contentLength} chars)`);
      }
      
      // Check for content inside body (not just structure)
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        const bodyContent = bodyMatch[1].trim();
        // Remove scripts and whitespace to check actual content
        const cleanBody = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\s+/g, ' ').trim();
        
        if (cleanBody.length < 200 && file.path === 'index.html') {
          console.log(`⚠️ WARNING: ${file.path} has very little content in body (${cleanBody.length} chars after cleanup)`);
        }
      }
      
      // Ensure proper encoding for Cyrillic if detected
      if (/[а-яА-ЯїЇєЄіІґҐёЁ]/.test(content) && !content.includes('charset=')) {
        content = content.replace('<head>', '<head>\n    <meta charset="UTF-8">');
        console.log(`📝 Added charset UTF-8 to ${file.path} for Cyrillic support`);
      }
      
      return { ...file, content };
    });
  };

  // Apply all mandatory file checks
  let finalFiles = ensureCookieBannerFile(files);
  finalFiles = ensureQualityCSS(finalFiles);
  finalFiles = fixPlaceholderImages(finalFiles); // Fix placeholder images
  finalFiles = validateHtmlContent(finalFiles); // Validate HTML content
  finalFiles = ensureMandatoryPages(finalFiles, language || "en");
  console.log(`📁 Final files count (with all mandatory files): ${finalFiles.length}`);

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
  salePrice: number = 0,
  siteName?: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[BG] Starting background generation for history ID: ${historyId}, team: ${teamId}, salePrice: $${salePrice}`);

  try {
    // Balance was already deducted in main handler - just update status to generating
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    const result = await runGeneration({ prompt, language, aiModel, layoutStyle, imageSource, siteName });

    if (result.success && result.files) {
      // Create zip base64
      const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
      const zip = new JSZip();
      result.files.forEach((file) => zip.file(file.path, file.content));
      const zipBase64 = await zip.generateAsync({ type: "base64" });

      // Update with success including generation cost and completion time
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

      // Create notification for user
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_complete",
        title: "Сайт згенеровано",
        message: `HTML сайт успішно створено (${result.files.length} файлів)`,
        data: { historyId, filesCount: result.files.length }
      });

      console.log(`[BG] Generation completed for ${historyId}: ${result.files.length} files, sale: $${salePrice}, cost: $${generationCost.toFixed(4)}`);
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

      // Update with error
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "Generation failed",
          sale_price: 0, // Reset sale_price since refunded
        })
        .eq("id", historyId);

      // Create notification for user about failure
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_failed",
        title: "Помилка генерації",
        message: result.error || "Не вдалося згенерувати сайт",
        data: { historyId, error: result.error }
      });

      console.error(`[BG] Generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] Background generation error for ${historyId}:`, error);

    // REFUND balance on error
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
        sale_price: 0, // Reset sale_price since refunded
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

    // Validate JWT (server-side) using auth.getUser(token). This is more reliable than local verification.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!authHeader.startsWith("Bearer ")) {
      console.warn("Request rejected: invalid authorization header format");
      return new Response(JSON.stringify({ code: 401, message: "Invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Create client with user's token for validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("JWT validation failed (getUser):", userError);
      return new Response(JSON.stringify({ code: 401, message: "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Authenticated request from user:", userId);

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
    
    // Store the original prompt (what user submitted) and improved prompt separately
    const promptToSave = originalPrompt || prompt;
    const improvedPromptToSave = improvedPrompt || null;

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IMMEDIATELY determine team and deduct balance BEFORE starting generation
    let teamId: string | null = overrideTeamId || null;
    let salePrice = 0;

    // If no override teamId, get user's team membership
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

      salePrice = pricing?.html_price || 0;
      
      // Add $2 for AI photo search
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
          
          // Check if new balance would exceed credit limit
          // credit_limit is the maximum allowed debt (stored as positive number)
          if (newBalance < -creditLimit) {
            console.log(`🚫 BLOCKED: Team ${teamId} would exceed credit limit. Balance: $${currentBalance}, Cost: $${salePrice}, Credit limit: $${creditLimit}`);
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
          console.log(`💰 IMMEDIATELY deducted $${salePrice} from team ${teamId} BEFORE starting generation. New balance: $${newBalance}`);
        }
      }
    }

    // Create history entry immediately with pending status AND sale_price AND team_id
    // Save original prompt (what user sees) and improved prompt separately (for admins only)
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
        website_type: "html",
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

    console.log("Created history entry:", historyEntry.id);

    // Start background generation using EdgeRuntime.waitUntil
    // Pass salePrice and teamId for potential refund on error
    // IMPORTANT: Use promptForGeneration which includes language and geo instructions
    EdgeRuntime.waitUntil(
      runBackgroundGeneration(historyEntry.id, userId, promptForGeneration, language, aiModel, layoutStyle, imageSource, teamId, salePrice, siteName)
    );

    // Return immediately with the history entry ID
    return new Response(
      JSON.stringify({
        success: true,
        historyId: historyEntry.id,
        message: "Generation started in background",
      }),
      {
        status: 202,
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
