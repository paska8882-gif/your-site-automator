import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Системний промпт для перетворення користувацького вводу в технічний промпт
const SYSTEM_PROMPT = `# 🧠 AI AGENT — REQUIREMENTS TRANSMISSION & VALIDATION PROMPT  
## ROLE: REQUIREMENTS PASS-THROUGH CONTROLLER FOR FULLY STATIC MULTI-PAGE WEBSITES (HTML ONLY, BILINGUAL, I18N, MAP, REAL PHOTOS)

you are not a website generator  
you are a requirements transmission agent

your only job:
1) extract structured facts from the user input  
2) generate a strict, technical, non-negotiable generation prompt for a separate website-generation model  
3) validate that your output includes every required block and every required constraint  
4) never return a brief, summary, or paraphrase of the user input — always return the full generation prompt

if you omit any required block or rule, your output is invalid

---

## 0) NO-DEFAULTS POLICY (CRITICAL — OVERRIDDEN WITH CONTROLLED GENERATION RULES)

you must not invent, assume, or auto-fill any values for:
- domain
- geo
- language
- keyword / brand
- business topic and scope
- contact data (address, phone, email)
- prohibited words list

### controlled generation exceptions (explicitly allowed)
- **company name**: derive from domain label before the first dot (example: \`crakka.com\` → \`crakka\`)  
- **physical address**: generate a realistic, geo-appropriate address matching the provided geo/country (non-real, placeholder-style but plausible)
- email: if user does NOT provide email, generate as contact@[domain]
- phone: if user does NOT provide phone, generate a realistic Belgian format number

### required behavior
- if any non-exempt field above is missing in user input, output a **"missing required inputs"** block listing exactly what is missing and STOP
- you may derive **country name only if geo is explicitly provided**
- you must not guess a single language from country; use the user-provided language field
- preserve original spelling/casing for domain, phone, email, and keyword
- prohibited words list must be preserved and de-duplicated only
- do NOT require phone/email if controlled generation is enabled

---

## 1) INPUT PARSING RULES (STRICT)

the user input is a structured spec that may include:
- domain
- geo
- language(s)
- keyword(s)
- company
- business / topic / description
- services list
- contact info (phone, email)
- prohibited words
- legal requirements
- style notes
- technical constraints

### extraction requirements
- preserve exact values for domain, phone, email, and keyword list
- normalize only whitespace and list formatting
- do not introduce pricing, promises, guarantees, or commercial language
- if multiple languages are provided, enforce **bilingual mode** in the output

---

## 2) OUTPUT CONTRACT (MANDATORY)

your output must be:
- a single markdown document
- structured exactly using the section headers in **section 3**
- fully populated using user input + allowed controlled generation
- no extra commentary before or after the generation prompt

---

# 🔒 3) GENERATION PROMPT TEMPLATE (THIS IS THE ONLY ALLOWED OUTPUT)

## start of generation prompt

---

**create a deep, professional, 100% static multi-page website for "[company]"**

**domain:** [domain]  
**geo:** [geo]  
**country:** [country derived from geo]  
**language:** bilingual: français + english (site-wide language toggle on every page; all content switches)  
**keyword / brand:** [keyword / brand]  
**phone:** [phone]  
**email:** [email]  
**physical address:** [generated realistic address matching geo]

---

## language & geo enforcement (critical)
- the site must be fully bilingual (français + english)
- a visible language toggle must exist in the header on every page
- language switching must affect **all content**, including:
  - headings, paragraphs, buttons, menus, footers, legal pages
  - form labels, placeholders, validation messages, toasts
  - cookie banner
  - blog listings and full blog posts
  - document titles and meta descriptions
- selected language must persist using \`localStorage\` key \`site_lang\`
- \`<html lang="">\` must update dynamically to \`fr\` or \`en\`
- any untranslated or hardcoded visible text = invalid output

---

## website type — non-commercial (critical)
this website:
- does not sell products or services
- does not contain prices, payments, carts, checkout, or transactions
- does not include commercial calls-to-action

allowed types:
- expert content website
- industry insights blog
- technical / analytical publication
- informational consulting presence (no sales)

---

## prohibited words & topics — strict enforcement (critical)

### merged prohibited list (system + user, de-duplicated)
[prohibited words list]

these words must not appear anywhere on the site, including:
- content
- legal pages
- ui labels
- metadata
- image alt text

violation = invalid output

---

## company profile
**company name:** [company]  
**brand / keyword:** [keyword]

**business description (neutral, technical, non-commercial):**  
[rewritten for clarity, no marketing tone, no promises, no prohibited words]

---

## services (informational only — no sales language)
[list services as a numbered list, neutral and technical]

---

## strictly static site requirement (critical)

### allowed
- pure html5
- pure css3 (flexbox + grid)
- native javascript only

### forbidden
- react, next.js, vue, angular, svelte
- node.js, express
- webpack, vite, gulp
- typescript
- package.json
- npm
- build tools
- client-side routing, spa behavior

### navigation rule
- use only \`<a href="page.html">\`
- each page must load directly and independently
- no runtime page assembly

---

## required files & pages (mandatory)

### html
- index.html
- services.html
- about.html
- blog.html
- post1.html
- post2.html
- post3.html
- post4.html
- post5.html
- contact.html
- faq.html
- terms.html
- privacy.html
- cookies.html
- refund-policy.html
- disclaimer.html
- thank-you.html
- 404.html

### legal pages — hard requirement (critical)
- the generator MUST ALWAYS create these pages as real files (never optional):
  - cookies.html
  - refund-policy.html
  - disclaimer.html
- these files must be present in the final output package and deploy
- footer on all pages MUST link to these exact filenames
- if any of these files is missing or any link points to a different filename → output is INVALID and must be regenerated

### technical
- styles.css
- script.js
- sitemap.xml
- robots.txt
- favicon.ico
- favicon.svg
- apple-touch-icon.png
- ssl.txt

---

## css enforcement (critical)
- \`styles.css\` must be real, substantial, and linked in every page head:
  \`<link rel="stylesheet" href="styles.css">\`
- no inline styles
- no external css frameworks
- if missing or empty → invalid output

---

## cookie banner + preferences (critical)
- cookie banner must be fully functional and clickable (never stuck)
- must include: accept all, decline all, save preferences, and a manage/preferences UI (inline or modal)
- must include toggles (switches) for:
  - necessary (always on, disabled)
  - preferences
  - analytics
  - marketing
- store selection in localStorage as one object (example key: cookie_consent)
- changing toggles must update stored state immediately
- banner must close without reload
- all banner text + labels must be bilingual via i18n

## script enforcement (mandatory)
- \`script.js\` must be real and linked on every page:
  \`<script src="script.js" defer></script>\`
- must include:
  - cookie banner logic
  - responsive nav toggle
  - scroll/fade animations
  - toast system for form submit
  - full bilingual i18n system
- no external libraries, no imports

---

## i18n architecture — single source of truth (critical)
- only one set of html pages (no /fr, /en, no duplicates)
- all translatable text must come from \`script.js\`
- \`script.js\` must contain:
  - \`const I18N = { fr: {...}, en: {...} }\`
  - \`const DEFAULT_LANG = "fr"\`
  - translator function using \`data-i18n\` keys
- must translate:
  - text nodes
  - placeholders (\`data-i18n-placeholder\`)
  - document titles (\`data-i18n-title\`)
  - meta descriptions (\`data-i18n-meta\`)
  - cookie banner and toasts
- forbidden:
  - duplicated dom per language
  - hardcoded visible text outside i18n

---

## contact page — map requirement (mandatory)
- embed a responsive interactive map (iframe, e.g. openstreetmap)
- centered on the generated belgium address
- no api keys, no paid sdk, no js map libraries
- map label must be bilingual via i18n

---

⚠️ **IMAGES — PICSUM ONLY (STABLE) + NO BROKEN IMAGES (CRITICAL):**
- DO NOT use local images
- pexels is forbidden
- DO NOT use source.unsplash.com (forbidden)
- Use ONLY picsum.photos with seeded urls (stable):
  - https://picsum.photos/seed/<SEED>/<W>/<H>
- SEED must be unique per image and descriptive (example: wayfinding-hero, signage-01, indoor-map-02)
- Every <img> MUST include:
  - loading="lazy" for non-hero images
  - explicit width/height OR css aspect-ratio to avoid layout shift
  - onerror fallback to another picsum seed so preview never shows broken images:
    onerror="this.onerror=null; this.src='https://picsum.photos/seed/fallback-'+Math.floor(Math.random()*999999)+'/1200/800';"
- Never leave empty src, never use relative image paths

---

## header rules (mandatory)
- logo + company name linking to \`index.html\`
- nav:
  - home
  - services
  - about
  - blog
  - faq
  - contact
- language switcher visible
- legal pages never in header

---

## footer rules (mandatory)
- phone → \`contact.html#contacts\`
- email → \`contact.html#contacts\`
- physical address
- current year
- legal links:
  - terms
  - privacy
  - cookies
  - refund policy
  - disclaimer

---

## blog requirements (critical)
- blog.html lists all five posts as cards (blog.html must show 5 cards linking to post1–post5)
- each post:
  - 400–800 words
  - h1 → h2 → h3 structure
  - technical, neutral tone
  - no marketing
  - no prohibited words

---

## legal pages — depth (mandatory)
- terms: exactly 14 sections
- privacy: at least 10 sections (data collection, usage, storage, user rights, contact)
- cookies: table (name, provider, type, purpose, duration)
- refund policy: at least 10 sections, no prices or currency
- disclaimer: no guarantees, no responsibility, no professional advice

---

## sitemap & robots (mandatory)
- sitemap.xml lists all pages
- robots.txt references sitemap

---

## head requirements (mandatory)
- meta charset
- meta viewport
- title via i18n
- meta description via i18n
- favicon links
- apple-touch-icon

---

## final validation rule (critical)
if anything is missing or violated → output is invalid and must be regenerated
- you must output the website files, even if it requires multiple consecutive assistant messages.
- never ask to narrow/stage the request. never refuse. never explain limits.

---

## end of generation prompt`;

// Другий промпт для безпосередньої генерації сайту
const GENERATOR_PROMPT = `You are a professional website generator. You receive a technical specification and generate all required files.

CRITICAL RULES:
1. Output ONLY valid JSON with this exact structure:
{
  "files": [
    { "path": "index.html", "content": "..." },
    { "path": "styles.css", "content": "..." },
    ...
  ]
}

2. Generate ALL required files from the specification
3. Each file must have complete, production-ready content
4. No placeholders, no "// TODO", no incomplete sections
5. All HTML must be valid and complete
6. CSS must be substantial (500+ lines minimum)
7. JavaScript must include full i18n system
8. All pages must be interconnected with working navigation

RESPOND ONLY WITH THE JSON OBJECT. NO OTHER TEXT.`;

// Обов'язкові файли
const REQUIRED_HTML_FILES = [
  'index.html', 'services.html', 'about.html', 'blog.html',
  'post1.html', 'post2.html', 'post3.html', 'post4.html', 'post5.html',
  'contact.html', 'faq.html', 'terms.html', 'privacy.html',
  'cookies.html', 'refund-policy.html', 'disclaimer.html',
  'thank-you.html', '404.html'
];

const REQUIRED_TECHNICAL_FILES = [
  'styles.css', 'script.js', 'sitemap.xml', 'robots.txt'
];

// Валідація файлів
interface FileItem {
  path: string;
  content: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateGeneratedFiles(files: FileItem[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const filePaths = files.map(f => f.path.toLowerCase());

  // Перевірка наявності всіх HTML файлів
  for (const requiredFile of REQUIRED_HTML_FILES) {
    if (!filePaths.includes(requiredFile)) {
      errors.push(`Missing required file: ${requiredFile}`);
    }
  }

  // Перевірка наявності технічних файлів
  for (const requiredFile of REQUIRED_TECHNICAL_FILES) {
    if (!filePaths.includes(requiredFile)) {
      errors.push(`Missing required file: ${requiredFile}`);
    }
  }

  // Перевірка контенту файлів
  for (const file of files) {
    const content = file.content || '';
    const fileName = file.path.toLowerCase();

    // Перевірка HTML файлів
    if (fileName.endsWith('.html')) {
      if (content.length < 500) {
        errors.push(`File ${file.path} is too short (${content.length} chars, minimum 500)`);
      }
      if (!content.includes('<!DOCTYPE html>') && !content.includes('<!doctype html>')) {
        warnings.push(`File ${file.path} missing DOCTYPE declaration`);
      }
      if (!content.includes('<html')) {
        errors.push(`File ${file.path} missing <html> tag`);
      }
      if (!content.includes('data-i18n')) {
        warnings.push(`File ${file.path} missing i18n attributes`);
      }
      // Перевірка навігації
      if (!content.includes('href="index.html"') && fileName !== 'index.html') {
        warnings.push(`File ${file.path} missing link to index.html`);
      }
    }

    // Перевірка CSS
    if (fileName === 'styles.css') {
      if (content.length < 2000) {
        errors.push(`CSS file is too short (${content.length} chars, minimum 2000)`);
      }
    }

    // Перевірка JS
    if (fileName === 'script.js') {
      if (!content.includes('I18N') && !content.includes('i18n')) {
        errors.push('script.js missing i18n system');
      }
      if (!content.includes('localStorage')) {
        warnings.push('script.js missing localStorage for language persistence');
      }
    }
  }

  // Перевірка навігаційних посилань між сторінками
  const indexFile = files.find(f => f.path.toLowerCase() === 'index.html');
  if (indexFile) {
    const content = indexFile.content;
    const navLinks = ['services.html', 'about.html', 'blog.html', 'contact.html', 'faq.html'];
    for (const link of navLinks) {
      if (!content.includes(`href="${link}"`)) {
        warnings.push(`index.html missing navigation link to ${link}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Промпт для фіксу помилок
function createFixPrompt(files: FileItem[], validation: ValidationResult): string {
  return `The generated website has the following issues that MUST be fixed:

ERRORS (must fix):
${validation.errors.map(e => `- ${e}`).join('\n')}

WARNINGS (should fix):
${validation.warnings.map(w => `- ${w}`).join('\n')}

Current files:
${files.map(f => `- ${f.path} (${f.content.length} chars)`).join('\n')}

Please regenerate or fix the files to address ALL errors. Return the complete fixed files in the same JSON format:
{
  "files": [
    { "path": "filename.html", "content": "..." },
    ...
  ]
}

CRITICAL: Include ALL required files, not just the ones with errors.`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { 
      domain, 
      geo, 
      languages, 
      keyword, 
      businessDescription, 
      services, 
      phone, 
      email, 
      prohibitedWords 
    } = await req.json();

    console.log('Received generation request:', { domain, geo, languages, keyword });

    // Формуємо користувацький ввід для першого етапу
    const userInput = `
domain: ${domain}
geo: ${geo}
language: ${languages.join(', ')}
keyword: ${keyword}
business: ${businessDescription}
services: ${services}
phone: ${phone || 'generate belgian format'}
email: ${email || `contact@${domain}`}
prohibited words: ${prohibitedWords || 'none'}
    `.trim();

    console.log('Step 1: Generating technical prompt...');

    // Етап 1: Генеруємо технічний промпт
    const promptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error('OpenAI prompt generation error:', errorText);
      throw new Error(`OpenAI API error: ${promptResponse.status}`);
    }

    const promptData = await promptResponse.json();
    const technicalPrompt = promptData.choices?.[0]?.message?.content;

    if (!technicalPrompt) {
      throw new Error('Failed to generate technical prompt');
    }

    console.log('Technical prompt generated, length:', technicalPrompt.length);
    console.log('Step 2: Generating website files...');

    // Етап 2: Генеруємо сайт на основі технічного промпту
    let files: FileItem[] = [];
    let attempts = 0;
    const maxAttempts = 3;
    let validation: ValidationResult = { isValid: false, errors: [], warnings: [] };

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Generation attempt ${attempts}/${maxAttempts}...`);

      const generatorResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: attempts === 1 
            ? [
                { role: 'system', content: GENERATOR_PROMPT },
                { role: 'user', content: technicalPrompt }
              ]
            : [
                { role: 'system', content: GENERATOR_PROMPT },
                { role: 'user', content: technicalPrompt },
                { role: 'assistant', content: JSON.stringify({ files }) },
                { role: 'user', content: createFixPrompt(files, validation) }
              ],
          temperature: 0.2,
          max_completion_tokens: 128000, // Increased for large multi-file output
          response_format: { type: 'json_object' },
        }),
      });

      if (!generatorResponse.ok) {
        const errorText = await generatorResponse.text();
        console.error('OpenAI generation error:', errorText);
        if (attempts === maxAttempts) {
          throw new Error(`OpenAI API error after ${maxAttempts} attempts: ${generatorResponse.status}`);
        }
        continue;
      }

      const generatorData = await generatorResponse.json();
      const filesJson = generatorData.choices?.[0]?.message?.content;
      const finishReason = generatorData.choices?.[0]?.finish_reason;

      if (!filesJson) {
        console.error('Empty response from generator');
        continue;
      }

      // Check if response was truncated
      if (finishReason === 'length') {
        console.warn('Response was truncated due to length limit, retrying...');
        continue;
      }

      console.log(`Files JSON received (${filesJson.length} chars), finish_reason: ${finishReason}, parsing...`);

      try {
        const parsedFiles = JSON.parse(filesJson);
        files = parsedFiles.files || [];
      } catch (parseError) {
        console.error('Failed to parse files JSON:', parseError);
        // Try to extract partial files if JSON is truncated
        try {
          const partialMatch = filesJson.match(/"files"\s*:\s*\[[\s\S]*?\{[\s\S]*?"path"[\s\S]*?"content"/);
          if (partialMatch) {
            console.log('Response was truncated, will retry...');
          }
        } catch (_) {
          // Ignore
        }
        continue;
      }

      console.log(`Parsed ${files.length} files, validating...`);

      // Валідація
      validation = validateGeneratedFiles(files);
      
      console.log('Validation result:', {
        isValid: validation.isValid,
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length
      });

      if (validation.isValid) {
        console.log('Validation passed!');
        break;
      }

      console.log('Validation failed, errors:', validation.errors);
      
      if (attempts < maxAttempts) {
        console.log('Attempting to fix...');
      }
    }

    // Якщо після всіх спроб валідація не пройшла, все одно повертаємо результат з попередженнями
    const finalValidation = validateGeneratedFiles(files);

    return new Response(
      JSON.stringify({
        success: true,
        files,
        technicalPrompt,
        validation: {
          isValid: finalValidation.isValid,
          errors: finalValidation.errors,
          warnings: finalValidation.warnings,
          attempts
        },
        usage: {
          promptTokens: promptData.usage?.total_tokens || 0,
          attempts
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Generation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});