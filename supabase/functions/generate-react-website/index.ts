import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a prompt refiner for professional, multi-page React websites.

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
- phone: <required format + must be clickable tel:>
- email: <if present>
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

const REACT_GENERATION_PROMPT = `CRITICAL: CREATE EXCEPTIONAL MULTI-PAGE REACT WEBSITE WITH 10X BETTER UI

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
   - SV = Swedish (Svenska)
   - NO = Norwegian (Norsk)
   - DA = Danish (Dansk)
   - FI = Finnish (Suomi)
   - RU = Russian (Русский)
   - TR = Turkish (Türkçe)
   - AR = Arabic (العربية) - RTL layout
   - HE = Hebrew (עברית) - RTL layout
   - ZH = Chinese (中文)
   - JA = Japanese (日本語)
   - KO = Korean (한국어)

3. **NEVER mix languages** - If the site is in German, ALL text must be German
4. **NEVER default to Ukrainian** - Only use Ukrainian if explicitly specified as UK/UA
5. **If language is "EN" or "English"** - Generate ALL content in proper English
6. **Button text examples by language:**
   - EN: "Get Started", "Learn More", "Contact Us"
   - DE: "Jetzt starten", "Mehr erfahren", "Kontakt"
   - FR: "Commencer", "En savoir plus", "Contactez-nous"
   - ES: "Comenzar", "Saber más", "Contáctenos"
   - PL: "Rozpocznij", "Dowiedz się więcej", "Kontakt"

**DESIGN PHILOSOPHY - 10X BETTER UI:**
- Start with FUNCTIONAL and BEAUTIFUL base UI - Every pixel must serve a purpose
- Always make 10X better UI than standard - Go beyond expectations
- Use advanced CSS patterns - CSS Grid, Flexbox, custom properties
- Think like a product designer - Focus on user experience first

**CRITICAL REQUIREMENT: PAGE CONTENT LENGTH**
Each page MUST have SUBSTANTIAL content with proper scroll depth:

**MAIN PAGES (Home.js, Services.js, About.js) - MINIMUM 5 SCREENS OF CONTENT:**
Each main page component MUST include AT LEAST these sections (in order):
1. Hero Section (100vh) - Full viewport hero with headline, subheadline, CTA button, background image
2. Features/Benefits Section - 6-9 feature cards in grid (2-3 rows)
3. About/Story Section - Company story with image, mission statement, values (3-4 paragraphs)
4. Services/Products Section - Detailed service cards with descriptions, icons, pricing hints
5. Testimonials Section - 3-6 client testimonials with photos, names, positions
6. Statistics/Numbers Section - 4-6 key metrics with large numbers and descriptions
7. FAQ Section - 5-8 frequently asked questions with expandable answers
8. Call-to-Action Section - Final CTA with compelling copy and prominent button
9. Partners/Clients Section - Logo grid of partner companies (6-12 logos)

**SECONDARY PAGES (Contact.js, Privacy.js, Terms.js) - MINIMUM 2 SCREENS OF CONTENT:**
- Contact: Hero + contact form + WORKING GOOGLE MAP (see Google Maps section below) + office info + working hours
- Privacy: Hero + full privacy policy text (15+ paragraphs covering all standard sections)
- Terms: Hero + full terms of service text (15+ paragraphs covering all standard sections)

**CONTENT DENSITY REQUIREMENTS:**
- Each section MUST be at least 300px in height on desktop
- Use generous padding (80px-120px vertical padding per section)
- Include detailed, realistic placeholder text (not Lorem Ipsum - write real business content)
- Every service/feature needs title, description (2-3 sentences), and icon/image

**LAYOUT REQUIREMENTS:**
- Header and Footer as REUSABLE components used in App.js layout
- Active nav link highlight using React Router
- All pages share same header/footer structure

**🍪 MANDATORY COOKIE SYSTEM - ABSOLUTELY CRITICAL, NON-NEGOTIABLE:**
Every React website MUST include a REAL, FUNCTIONAL cookie consent system that ACTUALLY COLLECTS AND STORES user choices:

**COOKIE BANNER COMPONENT REQUIREMENTS:**
1. Create dedicated CookieBanner.js component in src/components/
2. Use useState for banner visibility, useEffect for initial localStorage check
3. On mount: check localStorage.getItem('cookieConsent'), if exists - don't show
4. "Accept All" button: localStorage.setItem('cookieConsent', 'accepted') + setShowBanner(false)
5. "Decline" button: localStorage.setItem('cookieConsent', 'declined') + setShowBanner(false)
6. Banner NEVER shows again after user makes ANY choice

**COOKIE BANNER COMPONENT TEMPLATE (MUST CREATE):**
// src/components/CookieBanner.js
import React, { useState, useEffect } from 'react';
import './CookieBanner.css';

function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  
  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) setShowBanner(true);
  }, []);
  
  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setShowBanner(false);
  };
  
  const declineCookies = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setShowBanner(false);
  };
  
  if (!showBanner) return null;
  
  return (
    <div className="cookie-banner">
      <p>We use cookies to enhance your experience. By continuing, you agree to our cookie policy.</p>
      <div className="cookie-buttons">
        <button onClick={declineCookies} className="btn-decline">Decline</button>
        <button onClick={acceptCookies} className="btn-accept">Accept All</button>
      </div>
    </div>
  );
}

export default CookieBanner;

**COOKIE BANNER STYLING (MUST INCLUDE IN CSS):**
- Position: fixed at bottom (position: fixed; bottom: 0; left: 0; right: 0)
- Background: semi-transparent dark or white with box-shadow
- Z-index: 9999 (always visible on top)
- Flex layout with space-between for text and buttons
- Clear visual distinction between Accept (primary) and Decline (secondary) buttons

**INTEGRATION IN App.js:**
Import and render CookieBanner component at the end of App.js, before closing </div>

**THIS IS NOT OPTIONAL - EVERY GENERATED REACT WEBSITE MUST HAVE WORKING COOKIE CONSENT!**

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

**⚠️ MANDATORY DISCLAIMER - ABSOLUTELY CRITICAL, NON-NEGOTIABLE:**
Every React website MUST include a disclaimer section adapted to the website's theme. This is REQUIRED for Google Ads compliance:

**DISCLAIMER REQUIREMENTS:**
1. Add the disclaimer in the Footer component, ABOVE the copyright section
2. The disclaimer MUST be styled to MATCH THE WEBSITE'S DESIGN STYLE:
   - Use colors that complement the site's color palette (can be accent color, muted tone, or contrasting block)
   - Match the typography and spacing of the site
   - Make it visible but harmonious with overall design
   - Can use borders, subtle backgrounds, or other styling that fits the site aesthetic
3. The disclaimer text MUST be ADAPTED to match the website's theme/industry:
   - Keep the core meaning: "content is for general information/education only, not professional advice"
   - Adapt terminology to the specific industry (e.g., "financial advice" for finance, "medical advice" for health, "legal advice" for law, etc.)
   - Always include: not professional advice, consult qualified experts, involves risk, we don't sell [relevant products]

**DISCLAIMER COMPONENT TEMPLATE (include in Footer.js or separate Disclaimer.js):**
\`\`\`jsx
<div className="disclaimer-section">
  <p>
    <strong>Important Notice (Disclaimer) regarding Google Ads compliance:</strong>{' '}
    [ADAPTED DISCLAIMER TEXT FOR SITE THEME AND LANGUAGE]
  </p>
</div>
\`\`\`

**DISCLAIMER STYLING - ADAPT TO SITE DESIGN:**
Style the disclaimer to match the overall website aesthetic. Examples:
- Dark site: use a slightly lighter block or border accent
- Light site: use a muted background or accent border
- Colorful site: use the site's accent/secondary color
- Minimal site: use subtle borders and typography emphasis

\`\`\`css
/* Example - adapt colors to match site palette */
.disclaimer-section {
  background-color: var(--site-accent-muted, rgba(0,0,0,0.05)); /* or use site's secondary color */
  color: inherit;
  padding: 20px 30px;
  margin: 30px auto 0 auto;
  max-width: 1200px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  line-height: 1.6;
  border: 1px solid var(--site-border-color, rgba(0,0,0,0.1));
}
.disclaimer-section strong {
  display: block;
  margin-bottom: 8px;
}
\`\`\`

**LANGUAGE EXAMPLES (ADAPT TO SITE THEME):**
- EN (Finance theme): "Important Notice (Disclaimer): The content of this website is intended solely for general information and financial education. It does not constitute investment, tax, or legal advice and cannot replace individual consultations with qualified experts. Any investments involve risk. We do not sell financial products."
- EN (Health theme): "Important Notice (Disclaimer): The content of this website is intended solely for general information and health education. It does not constitute medical advice and cannot replace individual consultations with qualified healthcare professionals. Always consult a doctor before making health decisions. We do not sell medications."
- EN (Education/Courses): "Important Notice (Disclaimer): The content of this website and our courses is intended solely for general information and educational purposes. It does not constitute professional advice and cannot replace individual consultations with qualified experts. We do not guarantee specific results."
- DE (Finance): "Wichtiger Hinweis (Haftungsausschluss): Der Inhalt dieser Website dient ausschließlich der allgemeinen Information und Finanzbildung. Er stellt keine Anlage-, Steuer- oder Rechtsberatung dar und kann individuelle Beratungen durch qualifizierte Experten nicht ersetzen. Jede Investition ist mit Risiken verbunden. Wir verkaufen keine Finanzprodukte."
- RU (Finance): "Важное уведомление (отказ от ответственности): Контент этого веб-сайта предназначен исключительно для общего ознакомления и финансового образования. Он не является инвестиционной, налоговой или юридической консультацией и не может заменить индивидуальные консультации квалифицированных экспертов. Любые инвестиции сопряжены с риском. Мы не продаем финансовые продукты."
- UK (Finance): "Важливе повідомлення (відмова від відповідальності): Контент цього веб-сайту призначений виключно для загального ознайомлення та фінансової освіти. Він не є інвестиційною, податковою чи юридичною консультацією і не може замінити індивідуальні консультації кваліфікованих експертів. Будь-які інвестиції пов'язані з ризиком. Ми не продаємо фінансові продукти."

**THIS IS NOT OPTIONAL - EVERY GENERATED REACT WEBSITE MUST HAVE THE DISCLAIMER ADAPTED TO ITS THEME AND DESIGN!**

**THIS RULE IS NON-NEGOTIABLE - ANY NUMERICAL DATA OTHER THAN CONTACT INFO WILL MAKE THE WEBSITE INVALID!**

**📞 PHONE NUMBERS - MANDATORY REQUIREMENTS:**
All phone numbers MUST be:
1. **REALISTIC and RANDOM for the specified country** - Generate a unique, realistic phone number using proper country code and format. Pick random digits that look natural:
   - USA/Canada: +1 (XXX) XXX-XXXX - e.g., +1 (347) 892-4156, +1 (415) 637-8294
   - UK: +44 XX XXXX XXXX - e.g., +44 20 7839 5471, +44 7842 156 923
   - Germany: +49 XX XXXXXXXX - e.g., +49 30 25847631, +49 176 48293651
   - France: +33 X XX XX XX XX - e.g., +33 1 42 86 57 34, +33 6 78 42 91 53
   - Italy: +39 XX XXXX XXXX - e.g., +39 02 4867 2391, +39 347 892 4156
   - Spain: +34 XXX XXX XXX - e.g., +34 91 847 2563, +34 628 471 935
   - Poland: +48 XX XXX XX XX - e.g., +48 22 847 63 91, +48 512 847 293
   - Netherlands: +31 XX XXX XXXX - e.g., +31 20 847 3926, +31 6 48271935
   - Ukraine: +380 XX XXX XXXX - e.g., +380 44 892 4731, +380 67 482 9135
   - Australia: +61 X XXXX XXXX - e.g., +61 2 8471 2936, +61 412 847 293
   - Switzerland: +41 XX XXX XX XX - e.g., +41 44 847 29 36, +41 79 482 71 93
   - Austria: +43 X XXX XX XX - e.g., +43 1 847 29 36, +43 664 847 2931
   - Belgium: +32 X XXX XX XX - e.g., +32 2 847 29 36, +32 470 84 72 93
   - Portugal: +351 XX XXX XXXX - e.g., +351 21 847 2936, +351 912 847 293
   - Czech Republic: +420 XXX XXX XXX - e.g., +420 221 847 293, +420 602 847 291
   - Sweden: +46 X XXX XXX XX - e.g., +46 8 847 293 64, +46 70 847 29 36
   - Norway: +47 XX XX XX XX - e.g., +47 22 84 72 93, +47 912 84 729
   - Denmark: +45 XX XX XX XX - e.g., +45 32 84 72 93, +45 20 84 72 93
   
2. **CLICKABLE with tel: links** - ALWAYS wrap phone numbers in anchor tags:
   <a href="tel:+14155551234">+1 (415) 555-1234</a>

3. **NEVER use obviously fake numbers** like 1234567, 0000000, 123-456-7890, or all same digits
4. **NEVER use placeholder patterns** like 555, 1111, 2222, 1234, 5678 or any repeated/sequential digits
5. **ALWAYS generate RANDOM, REALISTIC digits** that could be real phone numbers
6. **Match the country/geo of the website** - If the site is for Germany, use German phone format

**🏠 ADDRESSES - MANDATORY REQUIREMENTS:**
All physical addresses MUST be:
1. **REALISTIC and from the specified country/city** - Use real street names, real neighborhoods, real postal codes:
   - USA: 847 Madison Avenue, New York, NY 10065 / 2847 Sunset Boulevard, Los Angeles, CA 90028
   - UK: 47 King's Road, London SW3 4ND / 128 Princes Street, Edinburgh EH2 4AD
   - Germany: Friedrichstraße 147, 10117 Berlin / Maximilianstraße 28, 80539 München
   - France: 47 Rue du Faubourg Saint-Honoré, 75008 Paris / 28 Cours Mirabeau, 13100 Aix-en-Provence
   - Italy: Via del Corso 147, 00186 Roma / Via Montenapoleone 28, 20121 Milano
   - Spain: Calle Serrano 47, 28001 Madrid / Passeig de Gràcia 28, 08007 Barcelona
   - Poland: ul. Nowy Świat 47, 00-042 Warszawa / ul. Floriańska 28, 31-021 Kraków
   - Netherlands: Herengracht 147, 1015 BH Amsterdam / Coolsingel 47, 3012 AA Rotterdam
   - Ukraine: вул. Хрещатик 47, Київ 01001 / вул. Дерибасівська 28, Одеса 65026
   - Australia: 47 Collins Street, Melbourne VIC 3000 / 128 Pitt Street, Sydney NSW 2000
   - Switzerland: Bahnhofstrasse 47, 8001 Zürich / Rue du Rhône 28, 1204 Genève
   - Austria: Kärntner Straße 47, 1010 Wien / Getreidegasse 28, 5020 Salzburg
   - Belgium: Avenue Louise 147, 1050 Bruxelles / Meir 47, 2000 Antwerpen
   - Portugal: Avenida da Liberdade 147, 1250-096 Lisboa / Rua de Santa Catarina 28, 4000-442 Porto
   - Czech Republic: Václavské náměstí 47, 110 00 Praha 1 / Masarykova 28, 602 00 Brno
   - Sweden: Kungsgatan 47, 111 56 Stockholm / Avenyn 28, 411 36 Göteborg
   - Norway: Karl Johans gate 47, 0162 Oslo / Bryggen 28, 5003 Bergen
   - Denmark: Strøget 47, 1160 København / Vestergade 28, 8000 Aarhus

2. **Use REAL street names** from the specified city - research or use well-known streets
3. **Include proper postal/ZIP codes** that match the city format
4. **NEVER use fake addresses** like "123 Main Street" or "456 Example Ave"
5. **Match the country/geo of the website** - If site is for Berlin, use a real Berlin address

**🗺️ GOOGLE MAPS - MANDATORY REQUIREMENTS FOR CONTACT PAGE:**
Every contact page MUST include a WORKING, PROPERLY DISPLAYED Google Map. This is NON-NEGOTIABLE.

**GOOGLE MAPS IN REACT - USE THIS EXACT FORMAT:**
\`\`\`jsx
// In Contact.js or Contact.jsx
<div className="map-container">
  <iframe 
    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3024.2219901290355!2d-74.00369368400567!3d40.71312937933185!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25a23e28c1191%3A0x49f75d3281df052a!2s150%20Park%20Row%2C%20New%20York%2C%20NY%2010007%2C%20USA!5e0!3m2!1sen!2s!4v1635959481000"
    width="100%" 
    height="450" 
    style={{border: 0}} 
    allowFullScreen="" 
    loading="lazy" 
    referrerPolicy="no-referrer-when-downgrade"
    title="Our Location"
  />
</div>
\`\`\`

**MAP LOCATION RULES (CRITICAL):**
1. **Match the country/city from the website content** - If the site mentions Berlin, embed a Berlin map
2. **Use realistic city center coordinates for the specified location:**
   - New York: pb=!1m18!1m12!1m3!1d3024.2219901290355!2d-74.00369368400567!3d40.71312937933185
   - London: pb=!1m18!1m12!1m3!1d2483.5401154424246!2d-0.12775868422771983!3d51.50735079567947
   - Berlin: pb=!1m18!1m12!1m3!1d2428.4056057920547!2d13.376888015868405!3d52.51628097981411
   - Paris: pb=!1m18!1m12!1m3!1d2624.991625695787!2d2.2944813156749647!3d48.85837007928746
   - Kyiv/Київ: pb=!1m18!1m12!1m3!1d2540.858019773429!2d30.520420615745823!3d50.45049547947494
   - Warsaw: pb=!1m18!1m12!1m3!1d2443.859132285!2d21.01223611576!3d52.22977297975
   - Vienna: pb=!1m18!1m12!1m3!1d2658.799123456789!2d16.36341!3d48.20817
   - Amsterdam: pb=!1m18!1m12!1m3!1d2435.123456789!2d4.89707!3d52.37403
   - Prague: pb=!1m18!1m12!1m3!1d2560.123456789!2d14.42076!3d50.08804
   - Rome: pb=!1m18!1m12!1m3!1d2969.123456789!2d12.49637!3d41.90278
   - Madrid: pb=!1m18!1m12!1m3!1d3037.123456789!2d-3.70379!3d40.41678
   - Munich: pb=!1m18!1m12!1m3!1d2662.123456789!2d11.57549!3d48.13743
   - Zürich: pb=!1m18!1m12!1m3!1d2702.123456789!2d8.54169!3d47.37689
   - Sydney: pb=!1m18!1m12!1m3!1d3312.123456789!2d151.20929!3d-33.86882
   - Toronto: pb=!1m18!1m12!1m3!1d2886.123456789!2d-79.38318!3d43.65107
3. **If no specific location mentioned** - Use a generic major city that matches the language (e.g., Berlin for German, Paris for French)

**MAP CONTAINER CSS (MANDATORY IN global.css):**
\`\`\`css
.map-container {
  width: 100%;
  height: 450px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin: 40px 0;
}

.map-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}

@media (max-width: 768px) {
  .map-container {
    height: 350px;
    border-radius: 8px;
  }
}
\`\`\`

**REACT-SPECIFIC RULES:**
- ALWAYS use \`style={{border: 0}}\` instead of \`style="border:0;"\`
- ALWAYS use \`allowFullScreen\` (camelCase) instead of \`allowfullscreen\`
- ALWAYS use \`referrerPolicy\` (camelCase) instead of \`referrerpolicy\`
- ALWAYS add \`title="Our Location"\` attribute for accessibility

**NEVER DO:**
- Never use placeholder text like "[MAP]" or "Map goes here"
- Never use broken/invalid iframe src URLs
- Never omit the map from contact page
- Never use coordinates that don't match the business location

**VISUAL EXCELLENCE GUIDELINES:**
- Whitespace is king - Generous spacing (1.5x standard)
- Clean typography system - Hierarchy: H1 > H2 > H3 > Body > Small
- Strategic color use - 60% primary, 30% secondary, 10% accent
- Consistent spacing scale - 4px, 8px, 16px, 24px, 32px, 48px, 64px, 80px, 120px
- Smooth transitions - 300ms ease-in-out for interactions

**GLOBAL CSS (src/styles/global.css) MUST BE AT LEAST 500 LINES with:**
- Reset/normalize styles
- CSS variables in :root (colors, spacing, fonts)
- Header with sticky navigation
- Hero section with image overlay/background (min-height: 100vh)
- Multiple section variations with different backgrounds
- Section padding: 80px 0 minimum
- Card/grid layouts for services/features
- Testimonial cards with photos
- Statistics section with large numbers
- FAQ accordion styling
- Image containers with proper sizing (object-fit: cover)
- Footer with multi-column layout
- Cookie banner styling (position: fixed; bottom: 0)
- Map container styling with responsive design
- Mobile responsive breakpoints
- Hover/focus states
- Form styling

`.trim();

// Image strategy - Basic (reliable random photos)
const IMAGE_STRATEGY_BASIC = `
**IMAGE STRATEGY - RELIABLE RANDOM PHOTOS:**
Use picsum.photos for ALL images - it's reliable and always loads:

**Hero background:** 
style={{backgroundImage: 'url(https://picsum.photos/1920/1080?random=1)'}}

**Content images:**
<img src="https://picsum.photos/800/600?random=2" alt="[Descriptive alt text in site language]" loading="lazy" />

**Card images:**
<img src="https://picsum.photos/600/400?random=3" alt="[Description]" loading="lazy" />

**Portrait images:**
<img src="https://picsum.photos/400/400?random=4" alt="[Name or role]" loading="lazy" />

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

**Usage in React:**
<img src="https://logo.clearbit.com/stripe.com" alt="Stripe" className="partner-logo" loading="lazy" />
<img src="https://logo.clearbit.com/visa.com" alt="Visa" className="payment-logo" loading="lazy" />

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
  
  for (const [ukr, eng] of Object.entries(translations)) {
    if (lowerPrompt.includes(ukr)) {
      console.log(`🔍 Fallback keywords (matched "${ukr}"): "${eng}"`);
      return eng;
    }
  }

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
Use picsum.photos for ALL images:

**Hero background:** style={{backgroundImage: 'url(https://picsum.photos/1920/1080?random=1)'}}
**Content images:** <img src="https://picsum.photos/800/600?random=2" alt="[Description]" loading="lazy" />
**Card images:** <img src="https://picsum.photos/600/400?random=3" alt="[Description]" loading="lazy" />
**Portrait images:** <img src="https://picsum.photos/400/400?random=4" alt="[Description]" loading="lazy" />

Use DIFFERENT random= numbers for each image!
`.trim();
  }

  const heroUrl = pexelsUrls[0] || "https://picsum.photos/1920/1080?random=1";
  const contentUrls = pexelsUrls.slice(1, 6);
  const cardUrls = pexelsUrls.slice(6, 12);
  const portraitUrls = pexelsUrls.slice(12, 15);

  return `
**IMAGE STRATEGY - HIGH QUALITY STOCK PHOTOS FROM PEXELS:**
Use these PRE-SELECTED high-quality Pexels photos. Each URL is unique and themed.

**HERO BACKGROUND (use this exact URL):**
style={{backgroundImage: 'url(${heroUrl})'}}

**CONTENT IMAGES:**
${contentUrls.map((url, i) => `Image ${i + 1}: ${url}`).join("\n")}

**CARD/FEATURE IMAGES:**
${cardUrls.map((url, i) => `Card ${i + 1}: ${url}`).join("\n")}

**PORTRAIT/TEAM IMAGES:**
${portraitUrls.length > 0 ? portraitUrls.map((url, i) => `Portrait ${i + 1}: ${url}`).join("\n") : "Use https://picsum.photos/400/400?random=X with different numbers"}

**FALLBACK:** For additional images use: https://picsum.photos/{width}/{height}?random={unique_number}

**IMPORTANT:**
- Use EACH Pexels URL only ONCE
- Alt text MUST be in the same language as the website content
- Add loading="lazy" to all images
`.trim();
}

// CSS for images - common to both strategies
const IMAGE_CSS = `
**REQUIRED CSS FOR IMAGES:**
.hero {
  position: relative;
  min-height: 100vh;
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
.section { padding: 80px 0; min-height: 50vh; }
img { max-width: 100%; height: auto; display: block; }
.card img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; }

**MOBILE-FIRST BREAKPOINTS:**
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1280px) { /* Large */ }

**REQUIRED FILES:**
<!-- FILE: package.json -->
{
  "name": "react-website",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "react-scripts": "5.0.1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}

<!-- FILE: public/index.html -->
[Complete HTML with meta tags, Open Graph]

<!-- FILE: src/index.js -->
[React entry point]

<!-- FILE: src/App.js -->
[React Router with Header/Footer layout wrapping all routes]

<!-- FILE: src/components/Header.js -->
[Reusable header with navigation, active link styling]

<!-- FILE: src/components/Footer.js -->
[Reusable footer]

<!-- FILE: src/components/CookieBanner.js -->
[Cookie consent with Accept/Decline]

<!-- FILE: src/pages/Home.js -->
[Hero with background image, feature cards with images]

<!-- FILE: src/pages/Services.js -->
[Service cards with images]

<!-- FILE: src/pages/About.js -->
[Team photos, company info with images]

<!-- FILE: src/pages/Contact.js -->
[Contact form, info section]

<!-- FILE: src/pages/Terms.js -->
<!-- FILE: src/pages/Privacy.js -->
<!-- FILE: src/pages/NotFound.js -->

<!-- FILE: src/styles/global.css -->
[Complete CSS 250+ lines with all styles including image handling]

<!-- FILE: netlify.toml -->
[build]
  publish = "build"
  command = "npm run build"

[build.environment]
  CI = "false"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

<!-- FILE: vercel.json -->
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "buildCommand": "npm run build",
  "outputDirectory": "build"
}

<!-- FILE: public/_redirects -->
/* /index.html 200

<!-- FILE: public/robots.txt -->
User-agent: *
Allow: /

Generate EXCEPTIONAL React website with 10X better UI, proper image styling, and outstanding user experience. All styles MUST render correctly, NO markdown code blocks, NO backticks.`;

type GeneratedFile = { path: string; content: string };

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

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
}: {
  prompt: string;
  language?: string;
  aiModel: "junior" | "senior";
  layoutStyle?: string;
  imageSource?: "basic" | "ai";
}): Promise<GenerationResult> {
  const isJunior = aiModel === "junior";
  console.log(`Using ${isJunior ? "Junior AI (OpenAI GPT-4o)" : "Senior AI (Lovable AI)"} for React generation`);

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

  console.log("Generating React website for prompt:", prompt.substring(0, 100));

  const apiUrl = isJunior
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const apiKey = isJunior ? OPENAI_API_KEY : LOVABLE_API_KEY;
  const refineModel = isJunior ? "gpt-4o-mini" : "google/gemini-2.5-flash";
  const generateModel = isJunior ? "gpt-4o" : "google/gemini-2.5-pro";

  // Step 1: refined prompt
  const agentResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: refineModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Create a detailed prompt for React website generation based on this request:\n\n"${prompt}"\n\nTARGET CONTENT LANGUAGE: ${language === "uk" ? "Ukrainian" : language === "en" ? "English" : language === "de" ? "German" : language === "pl" ? "Polish" : language === "ru" ? "Russian" : language || "auto-detect from user's request, default to English"}`,
        },
      ],
    }),
  });

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
  
  console.log("Refined prompt generated, now generating React website...");

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

  // Step 2: React website generation
  const websiteRequestBody: Record<string, unknown> = {
    model: generateModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert React generator. Return ONLY file blocks using exact markers like: <!-- FILE: src/App.js -->. No explanations. No markdown.",
      },
      {
        role: "user",
        content: `${REACT_GENERATION_PROMPT}\n\n${imageStrategy}\n\n${IMAGE_CSS}\n\n=== MANDATORY LAYOUT STRUCTURE (FOLLOW EXACTLY) ===\n${selectedLayout.description}\n\n=== USER'S ORIGINAL REQUEST (MUST FOLLOW EXACTLY) ===\n${prompt}\n\n=== TARGET WEBSITE LANGUAGE (CRITICAL - MUST FOLLOW EXACTLY) ===\nALL website content MUST be in: ${language === "uk" ? "UKRAINIAN language" : language === "en" ? "ENGLISH language" : language === "de" ? "GERMAN language" : language === "pl" ? "POLISH language" : language === "ru" ? "RUSSIAN language" : language === "fr" ? "FRENCH language" : language === "es" ? "SPANISH language" : language ? language.toUpperCase() + " language" : "ENGLISH language (default)"}\n\nThis includes: navigation, buttons, headings, paragraphs, footer, cookie banner, ALL text content. DO NOT MIX LANGUAGES.\n\n=== ENHANCED DETAILS (KEEP FIDELITY TO ORIGINAL) ===\n${refinedPrompt}`,
      },
    ],
  };

  if (isJunior) {
    websiteRequestBody.max_tokens = 16000;
  }

  const websiteResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(websiteRequestBody),
  });

  if (!websiteResponse.ok) {
    const errorText = await websiteResponse.text();
    console.error("Website generation error:", websiteResponse.status, errorText);

    if (websiteResponse.status === 429) return { success: false, error: "Rate limit exceeded. Please try again later.", totalCost };
    if (websiteResponse.status === 402) return { success: false, error: "AI credits exhausted. Please add funds.", totalCost };

    return { success: false, error: "Website generation failed", totalCost };
  }

  const websiteData = await websiteResponse.json();
  const rawText = websiteData.choices?.[0]?.message?.content || "";

  // Track token usage for generation step
  const websiteUsage = websiteData.usage as TokenUsage | undefined;
  if (websiteUsage) {
    totalCost += calculateCost(websiteUsage, generateModel);
  }
  
  console.log(`💰 Total generation cost: $${totalCost.toFixed(6)}`);

  console.log("React website generated, parsing files...");
  console.log("Raw response length:", rawText.length);

  const files = parseFilesFromModelText(rawText);
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

  // MANDATORY: Ensure deployment configuration files and cookie banner are always present
  const ensureMandatoryFiles = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const fileMap = new Map(generatedFiles.map(f => [f.path, f]));
    
    // MANDATORY: Cookie Banner Component
    const COOKIE_BANNER_COMPONENT = `import React, { useState, useEffect } from 'react';

/**
 * CookieBanner - MANDATORY COMPONENT
 * This component handles cookie consent for GDPR compliance
 */
const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(0, 0, 0, 0.95)',
      color: '#fff',
      padding: '20px',
      zIndex: 99999,
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '15px'
      }}>
        <p style={{
          margin: 0,
          flex: 1,
          minWidth: '200px',
          fontSize: '14px',
          lineHeight: 1.5
        }}>
          We use cookies to enhance your browsing experience and analyze site traffic. 
          By clicking "Accept", you consent to our use of cookies.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAccept}
            style={{
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              cursor: 'pointer',
              fontWeight: 600,
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
          >
            Accept
          </button>
          <button
            onClick={handleDecline}
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '12px 24px',
              cursor: 'pointer',
              fontWeight: 600,
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;`;

    // Always add CookieBanner component
    if (!fileMap.has("src/components/CookieBanner.jsx") && !fileMap.has("src/components/CookieBanner.js")) {
      console.log("📁 Adding mandatory src/components/CookieBanner.jsx");
      generatedFiles.push({
        path: "src/components/CookieBanner.jsx",
        content: COOKIE_BANNER_COMPONENT
      });
    }
    
    // Ensure App.jsx/App.js includes CookieBanner
    generatedFiles = generatedFiles.map(file => {
      if (file.path === 'src/App.jsx' || file.path === 'src/App.js') {
        let content = file.content;
        const hasCookieBanner = content.includes('CookieBanner');
        
        if (!hasCookieBanner) {
          console.log(`⚠️ Adding CookieBanner import and usage to ${file.path}`);
          
          // Add import at the top
          if (content.includes("import React")) {
            content = content.replace(
              /import React[^;]*;/,
              match => match + "\\nimport CookieBanner from './components/CookieBanner';"
            );
          } else {
            content = "import CookieBanner from './components/CookieBanner';\\n" + content;
          }
          
          // Add CookieBanner component before closing fragment/div
          if (content.includes('</Router>')) {
            content = content.replace('</Router>', '<CookieBanner />\\n      </Router>');
          } else if (content.includes('</BrowserRouter>')) {
            content = content.replace('</BrowserRouter>', '<CookieBanner />\\n      </BrowserRouter>');
          } else if (content.includes('</div>')) {
            // Add before the last closing div
            const lastDivIndex = content.lastIndexOf('</div>');
            content = content.slice(0, lastDivIndex) + '      <CookieBanner />\\n    ' + content.slice(lastDivIndex);
          }
        }
        
        return { ...file, content };
      }
      return file;
    });
    
    // netlify.toml - critical for Netlify deployment
    if (!fileMap.has("netlify.toml")) {
      console.log("⚠️ Adding missing netlify.toml");
      generatedFiles.push({
        path: "netlify.toml",
        content: `[build]
  publish = "build"
  command = "npm run build"

[build.environment]
  CI = "false"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200`
      });
    }
    
    // vercel.json - critical for Vercel deployment
    if (!fileMap.has("vercel.json")) {
      console.log("⚠️ Adding missing vercel.json");
      generatedFiles.push({
        path: "vercel.json",
        content: `{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "buildCommand": "npm run build",
  "outputDirectory": "build"
}`
      });
    }
    
    // public/_redirects - Netlify fallback
    if (!fileMap.has("public/_redirects")) {
      console.log("⚠️ Adding missing public/_redirects");
      generatedFiles.push({
        path: "public/_redirects",
        content: "/* /index.html 200"
      });
    }
    
    // public/robots.txt
    if (!fileMap.has("public/robots.txt")) {
      console.log("⚠️ Adding missing public/robots.txt");
      generatedFiles.push({
        path: "public/robots.txt",
        content: `User-agent: *
Allow: /`
      });
    }
    
    return generatedFiles;
  };

  const finalFiles = ensureMandatoryFiles(files);
  console.log(`📁 Final files count (with mandatory files): ${finalFiles.length}`);

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

  console.log(`[BG] Starting background React generation for history ID: ${historyId}, team: ${teamId}, salePrice: $${salePrice}`);

  try {
    // Balance was already deducted in main handler - just update status to generating
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    const result = await runGeneration({ prompt, language, aiModel, layoutStyle, imageSource });

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
        title: "React сайт згенеровано",
        message: `React сайт успішно створено (${result.files.length} файлів)`,
        data: { historyId, filesCount: result.files.length }
      });

      console.log(`[BG] React generation completed for ${historyId}: ${result.files.length} files, sale: $${salePrice}, cost: $${generationCost.toFixed(4)}`);
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
        message: result.error || "Не вдалося згенерувати React сайт",
        data: { historyId, error: result.error }
      });

      console.error(`[BG] React generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] Background React generation error for ${historyId}:`, error);

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

    // Get user from token
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

    console.log("Authenticated request from user:", user.id);

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
        .select("react_price")
        .eq("team_id", teamId)
        .maybeSingle();

      salePrice = pricing?.react_price || 0;
      
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
        user_id: user.id,
        team_id: teamId || null,
        status: "pending",
        ai_model: aiModel,
        website_type: "react",
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
    EdgeRuntime.waitUntil(
      runBackgroundGeneration(historyEntry.id, user.id, prompt, language, aiModel, layoutStyle, imageSource, teamId, salePrice)
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
