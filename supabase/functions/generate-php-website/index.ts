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

const PHP_GENERATION_PROMPT = `CRITICAL: CREATE EXCEPTIONAL MULTI-PAGE PHP WEBSITE WITH PROPER PHP STRUCTURE AND WORKING NAVIGATION

**⚠️ MANDATORY MULTI-PAGE REQUIREMENT - NON-NEGOTIABLE:**
You MUST create a MINIMUM of 6 SEPARATE PHP PAGE FILES. This is ABSOLUTELY REQUIRED:

REQUIRED PAGES (ALL MANDATORY):
1. index.php - Homepage with hero, features, about preview, services preview, testimonials, CTA
2. about.php - About Us page with company history, mission, vision, team section, values
3. services.php - Services/Products page with detailed service descriptions, benefits, process
4. contact.php - Contact page with WORKING form, map placeholder, contact info, working hours
5. thank-you.php - Thank you page after form submission
6. privacy.php - Privacy policy page with full legal text

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
privacy.php       - Privacy policy (REQUIRED)
css/
  style.css       - Main stylesheet (REQUIRED)
js/
  script.js       - JavaScript functionality (REQUIRED)
\`\`\`

**EXAMPLE config.php:**
\`\`\`php
<?php
// Site Configuration
define('SITE_NAME', 'Company Name');
define('SITE_EMAIL', 'info@company.com');
define('SITE_PHONE', '+1 (555) 123-4567');
define('SITE_ADDRESS', '123 Main Street, City, Country');
?>
\`\`\`

**EXAMPLE header.php (MUST include ALL page links):**
\`\`\`php
<?php require_once 'config.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo isset($page_title) ? $page_title . ' - ' . SITE_NAME : SITE_NAME; ?></title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <header>
        <nav class="navbar">
            <a href="index.php" class="logo"><?php echo SITE_NAME; ?></a>
            <ul class="nav-links">
                <li><a href="index.php">Home</a></li>
                <li><a href="about.php">About</a></li>
                <li><a href="services.php">Services</a></li>
                <li><a href="contact.php">Contact</a></li>
            </ul>
            <button class="mobile-menu-btn" onclick="toggleMobileMenu()">☰</button>
        </nav>
    </header>
    <main>
\`\`\`

**EXAMPLE footer.php:**
\`\`\`php
    </main>
    <footer>
        <div class="footer-content">
            <div class="footer-links">
                <a href="index.php">Home</a>
                <a href="about.php">About</a>
                <a href="services.php">Services</a>
                <a href="contact.php">Contact</a>
                <a href="privacy.php">Privacy Policy</a>
            </div>
            <p>&copy; <?php echo date('Y'); ?> <?php echo SITE_NAME; ?>. All rights reserved.</p>
            <p>
                <a href="tel:<?php echo SITE_PHONE; ?>"><?php echo SITE_PHONE; ?></a> |
                <a href="mailto:<?php echo SITE_EMAIL; ?>"><?php echo SITE_EMAIL; ?></a>
            </p>
        </div>
    </footer>
    <script src="js/script.js"></script>
</body>
</html>
\`\`\`

**⚠️ CONTACT PAGE - CRITICAL REQUIREMENTS (contact.php):**
The contact page MUST have a FULLY FUNCTIONAL form. This is NON-NEGOTIABLE:

\`\`\`php
<?php
$page_title = 'Contact Us';
include 'includes/header.php';
?>

<section class="contact-hero">
    <h1>Contact Us</h1>
    <p>Get in touch with our team</p>
</section>

<section class="contact-section">
    <div class="contact-container">
        <div class="contact-info">
            <h2>Get In Touch</h2>
            <div class="info-item">
                <span class="icon">📍</span>
                <p><?php echo SITE_ADDRESS; ?></p>
            </div>
            <div class="info-item">
                <span class="icon">📞</span>
                <p><a href="tel:<?php echo SITE_PHONE; ?>"><?php echo SITE_PHONE; ?></a></p>
            </div>
            <div class="info-item">
                <span class="icon">✉️</span>
                <p><a href="mailto:<?php echo SITE_EMAIL; ?>"><?php echo SITE_EMAIL; ?></a></p>
            </div>
            <div class="working-hours">
                <h3>Working Hours</h3>
                <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                <p>Saturday: 10:00 AM - 4:00 PM</p>
                <p>Sunday: Closed</p>
            </div>
        </div>
        
        <div class="contact-form-wrapper">
            <h2>Send Us a Message</h2>
            <form action="form-handler.php" method="POST" class="contact-form">
                <div class="form-group">
                    <label for="name">Full Name *</label>
                    <input type="text" id="name" name="name" required placeholder="Your Name">
                </div>
                <div class="form-group">
                    <label for="email">Email Address *</label>
                    <input type="email" id="email" name="email" required placeholder="your@email.com">
                </div>
                <div class="form-group">
                    <label for="phone">Phone Number</label>
                    <input type="tel" id="phone" name="phone" placeholder="+1 (555) 000-0000">
                </div>
                <div class="form-group">
                    <label for="subject">Subject *</label>
                    <input type="text" id="subject" name="subject" required placeholder="How can we help?">
                </div>
                <div class="form-group">
                    <label for="message">Message *</label>
                    <textarea id="message" name="message" rows="5" required placeholder="Your message..."></textarea>
                </div>
                <button type="submit" class="submit-btn">Send Message</button>
            </form>
        </div>
    </div>
</section>

<?php include 'includes/footer.php'; ?>
\`\`\`

**EXAMPLE form-handler.php (MUST WORK):**
\`\`\`php
<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Sanitize input
    $name = htmlspecialchars(trim($_POST['name'] ?? ''));
    $email = filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);
    $phone = htmlspecialchars(trim($_POST['phone'] ?? ''));
    $subject = htmlspecialchars(trim($_POST['subject'] ?? ''));
    $message = htmlspecialchars(trim($_POST['message'] ?? ''));
    
    // Validate required fields
    if (!empty($name) && filter_var($email, FILTER_VALIDATE_EMAIL) && !empty($message)) {
        // Form is valid - redirect to thank you page
        header('Location: thank-you.php');
        exit;
    } else {
        // Validation failed - redirect back with error
        header('Location: contact.php?error=1');
        exit;
    }
} else {
    // Not a POST request
    header('Location: contact.php');
    exit;
}
?>
\`\`\`

**CONTACT FORM CSS (MANDATORY in style.css):**
\`\`\`css
.contact-section {
    padding: 80px 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.contact-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
}

@media (max-width: 768px) {
    .contact-container {
        grid-template-columns: 1fr;
        gap: 40px;
    }
}

.contact-info {
    padding: 40px;
    background: var(--bg-secondary, #f8f9fa);
    border-radius: 12px;
}

.info-item {
    display: flex;
    align-items: flex-start;
    gap: 15px;
    margin-bottom: 20px;
}

.info-item .icon {
    font-size: 1.5rem;
}

.contact-form-wrapper {
    padding: 40px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.contact-form .form-group {
    margin-bottom: 20px;
}

.contact-form label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
}

.contact-form input,
.contact-form textarea {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.3s;
}

.contact-form input:focus,
.contact-form textarea:focus {
    outline: none;
    border-color: var(--primary-color, #007bff);
}

.submit-btn {
    width: 100%;
    padding: 16px 32px;
    background: var(--primary-color, #007bff);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
}

.submit-btn:hover {
    background: var(--primary-dark, #0056b3);
}
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
- privacy.php: Full privacy policy text (minimum 300 words)

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

**DESIGN PHILOSOPHY - 10X BETTER UI:**
- Start with FUNCTIONAL and BEAUTIFUL base UI
- Use advanced CSS patterns - CSS Grid, Flexbox, custom properties
- Modern responsive design with mobile menu
- Professional color schemes

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
1. REALISTIC and RANDOM for the specified country
2. CLICKABLE with tel: links

**🏠 ADDRESSES - MANDATORY REQUIREMENTS:**
All physical addresses MUST be realistic and from the specified country/city.

**📧 EMAIL ADDRESSES - MANDATORY CLICKABLE LINKS:**
All email addresses MUST be clickable with mailto: links.

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
  const makeAPICall = async (systemContent: string, userContent: string, maxTokens: number, model: string, temperature = 0.7) => {
    if (useLovableAI) {
      const resp = await fetch("https://ai.lovable.dev/chat/v1/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent },
          ],
          max_tokens: maxTokens,
        }),
      });
      return resp;
    } else {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      });
      return resp;
    }
  };

  const refineResponse = await makeAPICall(
    SYSTEM_PROMPT + languageInstruction + siteNameInstruction,
    prompt + siteNameInstruction,
    1000,
    refineModel
  );

  if (!refineResponse.ok) {
    const errText = await refineResponse.text();
    console.error("Refine API error:", errText);
    return { success: false, error: `Prompt refinement failed: ${errText}` };
  }

  const refineData = await refineResponse.json();
  const refinedPrompt = refineData.choices?.[0]?.message?.content || prompt;
  const refineUsage = refineData.usage || {};
  const refineCost = calculateCost(refineUsage, refineModel);
  
  console.log(`💰 Token usage for ${refineModel}: ${refineUsage.prompt_tokens || 0} in, ${refineUsage.completion_tokens || 0} out = $${refineCost.toFixed(6)}`);
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

  const generateOnce = async (opts: { strictFormat: boolean }) => {
    const strictFormatBlock = opts.strictFormat
      ? `\n\nSTRICT OUTPUT FORMAT (MANDATORY):\n- Output ONLY file blocks in this exact format. No commentary, no markdown headings.\n\n--- FILE: includes/config.php ---\n<file contents>\n--- END FILE ---\n\n--- FILE: includes/header.php ---\n<file contents>\n--- END FILE ---\n\n(Repeat for every file.)\n\nIf you cannot comply, output nothing.`
      : "";

    const systemContent = PHP_GENERATION_PROMPT + layoutDescription + "\n\n" + imageStrategy + "\n\n" + IMAGE_CSS;
    const userContent = `Create a COMPLETE, FULLY FUNCTIONAL multi-page PHP website based on this brief:\n\n${refinedPrompt}\n\nCRITICAL GENERATION CHECKLIST - YOU MUST INCLUDE ALL:\n✅ includes/config.php - Site constants (SITE_NAME, SITE_EMAIL, SITE_PHONE, SITE_ADDRESS)\n✅ includes/header.php - Full HTML head, navigation with links to ALL pages\n✅ includes/footer.php - Footer with disclaimer, copyright, links\n✅ index.php - Homepage with hero, features, services preview, testimonials, CTA (FULL CONTENT)\n✅ about.php - About page with mission, team, values (FULL CONTENT)\n✅ services.php - Services/Products page with detailed descriptions (FULL CONTENT)\n✅ contact.php - Contact form with method=\"POST\" action=\"form-handler.php\"\n✅ form-handler.php - Form processor that redirects to thank-you.php\n✅ thank-you.php - Thank you page after form submission\n✅ privacy.php - Privacy policy page\n✅ css/style.css - Complete CSS with responsive design, mobile menu\n✅ js/script.js - JavaScript for mobile menu, interactions\n\nEach page MUST have SUBSTANTIAL, UNIQUE content (not placeholders).\nGenerate COMPLETE files with full HTML, CSS, and PHP code.\nUse proper PHP includes on every page.${strictFormatBlock}`;

    let generateResponse: Response;
    
    if (useLovableAI) {
      generateResponse = await fetch("https://ai.lovable.dev/chat/v1/messages", {
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
      });
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
      });
    }

    if (!generateResponse.ok) {
      const errText = await generateResponse.text();
      console.error("Generate API error:", errText);
      return { ok: false as const, error: `Website generation failed: ${errText}` };
    }

    const generateData = await generateResponse.json();
    const generatedText = generateData.choices?.[0]?.message?.content || "";
    const genUsage = generateData.usage || {};
    const generateCost = calculateCost(genUsage, generateModel);
    
    console.log(`💰 Token usage for ${generateModel}: ${genUsage.prompt_tokens || 0} in, ${genUsage.completion_tokens || 0} out = $${generateCost.toFixed(6)}`);

    // Parse
    const files = parseFilesFromModelText(generatedText);
    console.log(`Parsed ${files.length} files from generation`);

    return { ok: true as const, files, generateCost };
  };

  // 4. Generate the PHP website (retry once with stricter output format if required files are missing)
  const first = await generateOnce({ strictFormat: false });
  if (!first.ok) return { success: false, error: first.error };

  let files = first.files;
  let generateCost = first.generateCost;

  // If model returned something parseable but incomplete/empty-ish, retry once.
  const v1 = validateFiles(files);
  if (files.length === 0 || v1.missing.length > 0 || v1.tooShort.length > 0) {
    console.warn(
      `PHP generation invalid on attempt #1. Missing: ${v1.missing.join(", ")}; Too short: ${v1.tooShort.join(", ")}`
    );

    const second = await generateOnce({ strictFormat: true });
    if (second.ok) {
      const v2 = validateFiles(second.files);
      if (second.files.length > 0 && v2.missing.length === 0 && v2.tooShort.length === 0) {
        files = second.files;
        generateCost = second.generateCost;
      }
    }
  }

  const totalCost = refineCost + generateCost;
  console.log(
    `Generation costs: Refine=$${refineCost.toFixed(4)}, Generate=$${generateCost.toFixed(4)}, Total=$${totalCost.toFixed(4)}`
  );

  if (files.length === 0) {
    return { success: false, error: "Failed to parse generated files" };
  }

  const validation = validateFiles(files);
  if (validation.missing.length > 0 || validation.tooShort.length > 0) {
    return {
      success: false,
      error: `Generation output incomplete. Missing: ${validation.missing.join(", ")}. Too short: ${validation.tooShort.join(", ")}.`,
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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated PHP generation request from user:", user.id);

    const { prompt, originalPrompt, improvedPrompt, language, aiModel = "senior", layoutStyle, siteName, imageSource = "basic", teamId: overrideTeamId, geo } = await req.json();

    // Build prompt with geo context if provided
    let promptForGeneration = prompt;
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
        .eq("user_id", user.id)
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
        user_id: user.id,
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
    const result = await runGeneration({
      prompt: promptForGeneration,
      language,
      aiModel,
      layoutStyle,
      imageSource,
      siteName,
    });

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
