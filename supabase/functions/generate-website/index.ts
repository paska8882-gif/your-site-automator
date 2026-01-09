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

const HTML_GENERATION_PROMPT = `CRITICAL: CREATE A PREMIUM, PROFESSIONAL MULTI-PAGE WEBSITE

**🎨 CRITICAL DESIGN RULES - PREMIUM QUALITY:**

**IMAGE SIZING - ABSOLUTELY CRITICAL (PREVENTS OVERSIZED IMAGES):**
All images MUST have EXPLICIT width/height in CSS. NEVER let images grow beyond their container.

\`\`\`css
/* MANDATORY IMAGE CONSTRAINTS */
img {
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

/* Hero images - constrained height */
.hero {
  min-height: 70vh;
  max-height: 85vh;
  background-size: cover;
  background-position: center;
}

/* Card images - FIXED dimensions */
.card-image, .service-card img, .feature-img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 12px;
}

/* Larger cards */
.card-image-lg {
  height: 280px;
}

/* Team/testimonial avatars - SMALL and ROUND */
.avatar, .team-photo, .testimonial-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

/* Gallery images - GRID constrained */
.gallery-item img {
  width: 100%;
  height: 250px;
  object-fit: cover;
}

/* About section image */
.about-image {
  max-width: 500px;
  height: 350px;
  object-fit: cover;
  border-radius: 16px;
}

/* Partner/client logos - SMALL */
.partner-logo, .client-logo {
  height: 40px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
  filter: grayscale(100%);
  opacity: 0.7;
  transition: all 0.3s ease;
}
.partner-logo:hover {
  filter: grayscale(0);
  opacity: 1;
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
      
      <!-- Contact Info -->
      <div>
        <h4 class="footer-heading">Contact</h4>
        <div class="footer-contact-item">
          <svg>location icon</svg>
          <span>Address line here</span>
        </div>
        <div class="footer-contact-item">
          <svg>phone icon</svg>
          <a href="tel:+1234567890">+1 (234) 567-890</a>
        </div>
        <div class="footer-contact-item">
          <svg>email icon</svg>
          <a href="mailto:info@company.com">info@company.com</a>
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

**📐 PAGE STRUCTURE - CLEAN SECTIONS:**

\`\`\`css
/* CLEAN SECTION STRUCTURE */
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
  margin: 0 auto 60px;
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

/* Cards Grid - CONSTRAINED */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  max-width: 1200px;
}

.card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}

.card-body {
  padding: 24px;
}

.card-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.card-text {
  color: var(--text-muted, #666);
  line-height: 1.6;
  font-size: 0.95rem;
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

**📞 PHONE NUMBERS:**
- Generate realistic phone numbers for the specified country
- MUST be clickable: <a href="tel:+14155551234">+1 (415) 555-1234</a>

**📧 EMAILS:**
- MUST be clickable: <a href="mailto:info@company.com">info@company.com</a>

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
**IMAGE STRATEGY - RELIABLE RANDOM PHOTOS:**
Use picsum.photos for ALL images - it's reliable and always loads:

**Hero background:** 
url('https://picsum.photos/1920/1080?random=1')

**Content images:**
<img src="https://picsum.photos/800/600?random=2" alt="[Descriptive alt text in site language]" loading="lazy">

**Card images:**
<img src="https://picsum.photos/600/400?random=3" alt="[Description]" loading="lazy">

**Portrait images:**
<img src="https://picsum.photos/400/400?random=4" alt="[Name or role]" loading="lazy">

**IMPORTANT:** Use DIFFERENT random= numbers for each image (random=1, random=2, random=3, etc.) so images are unique!
**Alt text MUST be in the same language as the website content!**

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

  // Apply all mandatory file checks
  let finalFiles = ensureCookieBannerFile(files);
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

    // Validate JWT using getClaims - pass the token to the client via Authorization header
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const token = authHeader.replace("Bearer ", "");
    
    // Create client with user's token for validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ code: 401, message: "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    
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

2. **PHONE NUMBER**: Use ${countryName} phone format with correct country code:
   - Germany: +49 30 XXXXXXXX
   - Poland: +48 XX XXX XX XX
   - Spain: +34 XXX XXX XXX
   - France: +33 X XX XX XX XX
   - Italy: +39 XX XXXX XXXX
   - UK: +44 XX XXXX XXXX
   - USA: +1 (XXX) XXX-XXXX
   - Netherlands: +31 XX XXX XXXX
   - Czech Republic: +420 XXX XXX XXX

3. **BUSINESS CONTEXT**: All content should feel native to ${countryName} market
4. **DO NOT** use addresses or phone numbers from other countries
5. The address MUST appear in the contact section and footer`;
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
