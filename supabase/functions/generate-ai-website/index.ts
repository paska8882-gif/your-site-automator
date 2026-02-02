import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
- always at page bottom
- nav: home, about, services, blog, faq, contact
- legal links: terms, privacy, cookies, refund-policy, disclaimer
- social icons (svg inline, aria-labels, links=#)
- copyright with dynamic year via js

---

## favicon rules (mandatory)
\`\`\`html
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
\`\`\`
- all 3 files must exist
- all pages must include these exact links

---

## blog rules (mandatory)
- blog.html lists 5 posts
- 5 individual pages: post1.html–post5.html
- bilingual titles, excerpts, full content
- no images, no author, no comments
- breadcrumb on post pages

---

## faq rules (mandatory)
- accordion: click expands, re-click collapses
- 10 questions minimum
- pure css + minimal js (no jquery)
- fully bilingual

---

## thank-you.html (mandatory)
- displays after form submit
- bilingual text
- link back to contact page
- no scripts except language toggle

---

## 404.html (mandatory)
- custom design
- link to homepage
- bilingual content

---

## robots.txt (mandatory)
\`\`\`
User-agent: *
Disallow:
Sitemap: https://[domain]/sitemap.xml
\`\`\`

---

## sitemap.xml (mandatory)
- all html pages listed
- absolute urls: https://[domain]/page.html
- standard xml format

---

## ssl.txt (mandatory)
- static file content: "ssl certificate installed and verified for [domain]"

---

## final validation checklist
before submitting, verify:
1. ✅ all required pages exist
2. ✅ styles.css exists and is linked on all pages
3. ✅ script.js exists and is linked on all pages
4. ✅ i18n object covers all visible text
5. ✅ no prohibited words anywhere
6. ✅ cookie banner is fully functional
7. ✅ contact form submits to thank-you.html
8. ✅ favicons are present and linked
9. ✅ sitemap.xml includes all pages
10. ✅ robots.txt is correct
11. ✅ images are only from picsum.photos with onerror fallback
12. ✅ blog and faq are complete
13. ✅ no inline styles, no external frameworks

---

## end of generation prompt
`;

// Промпт для генератора сайту
const GENERATOR_PROMPT = `You are an expert web developer. Generate a complete static website based on the technical requirements provided.

CRITICAL RULES:
1. Return ONLY valid JSON in this exact format:
{
  "files": [
    { "path": "index.html", "content": "..." },
    { "path": "styles.css", "content": "..." },
    ...
  ]
}

2. NO markdown code fences - just raw JSON
3. Include ALL required files from the specification
4. Ensure styles.css is substantial (5000+ chars minimum)
5. Ensure script.js includes complete i18n system
6. All content must be bilingual via the i18n system
7. Images ONLY from picsum.photos with unique seeds and onerror fallback
8. NO external dependencies or frameworks`;

// Типи
interface FileItem {
  path: string;
  content: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface JobRecord {
  id: string;
  user_id: string;
  status: string;
  domain: string;
  geo?: string;
  languages: string[];
  theme?: string;
  keywords?: string;
  prohibited_words?: string;
  technical_prompt?: string;
  files_data?: { files: FileItem[] };
  validation?: ValidationResult & { attempts: number };
  error_message?: string;
}

// Функція валідації згенерованих файлів
function validateGeneratedFiles(files: FileItem[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const requiredFiles = [
    'index.html', 'styles.css', 'script.js', 'about.html', 'services.html',
    'contact.html', 'blog.html', 'faq.html', 'terms.html', 'privacy.html',
    'cookies.html', 'refund-policy.html', 'disclaimer.html', 'thank-you.html',
    '404.html', 'sitemap.xml', 'robots.txt'
  ];
  
  const filePaths = files.map(f => f.path);
  
  // Перевірка наявності обов'язкових файлів
  for (const required of requiredFiles) {
    if (!filePaths.includes(required)) {
      errors.push(`Missing required file: ${required}`);
    }
  }
  
  // Перевірка styles.css
  const stylesFile = files.find(f => f.path === 'styles.css');
  if (stylesFile) {
    if (stylesFile.content.length < 3000) {
      warnings.push(`styles.css is too short (${stylesFile.content.length} chars), should be 5000+ for premium design`);
    }
    if (stylesFile.content.includes('```')) {
      errors.push('styles.css contains markdown code fences');
    }
  }
  
  // Перевірка script.js
  const scriptFile = files.find(f => f.path === 'script.js');
  if (scriptFile) {
    if (!scriptFile.content.includes('I18N') && !scriptFile.content.includes('i18n')) {
      errors.push('script.js missing i18n system');
    }
    if (scriptFile.content.includes('```')) {
      errors.push('script.js contains markdown code fences');
    }
  }
  
  // Перевірка HTML файлів
  for (const file of files) {
    if (file.path.endsWith('.html')) {
      if (!file.content.includes('styles.css')) {
        warnings.push(`${file.path} does not link to styles.css`);
      }
      if (!file.content.includes('script.js')) {
        warnings.push(`${file.path} does not link to script.js`);
      }
      if (file.content.includes('```')) {
        errors.push(`${file.path} contains markdown code fences`);
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

// Фонова функція генерації
async function processGenerationJob(
  jobId: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
  openaiApiKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Отримуємо дані job
    const { data: job, error: jobError } = await supabase
      .from('ai_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error('Job not found:', jobId, jobError);
      return;
    }
    
    // Оновлюємо статус на processing
    await supabase
      .from('ai_generation_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);
    
    console.log(`[Job ${jobId}] Started processing...`);
    
    // Формуємо користувацький ввід для першого етапу
    const userInput = `
domain: ${job.domain}
geo: ${job.geo || 'BE'}
language: ${job.languages?.join(', ') || 'en'}
keyword: ${job.theme || ''}
business: ${job.theme || ''}
services: ${job.theme || ''}
phone: generate belgian format
email: contact@${job.domain}
prohibited words: ${job.prohibited_words || 'none'}
    `.trim();

    console.log(`[Job ${jobId}] Step 1: Generating technical prompt...`);

    // Етап 1: Генеруємо технічний промпт через Chat Completions API
    const promptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput }
        ],
        temperature: 0.3,
      }),
    });

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error(`[Job ${jobId}] OpenAI prompt generation error:`, errorText);
      throw new Error(`OpenAI API error: ${promptResponse.status}`);
    }

    const promptData = await promptResponse.json();
    const technicalPrompt = promptData.choices?.[0]?.message?.content;

    if (!technicalPrompt) {
      throw new Error('Failed to generate technical prompt');
    }

    console.log(`[Job ${jobId}] Technical prompt generated, length: ${technicalPrompt.length}`);
    
    // Зберігаємо технічний промпт
    await supabase
      .from('ai_generation_jobs')
      .update({ technical_prompt: technicalPrompt })
      .eq('id', jobId);

    console.log(`[Job ${jobId}] Step 2: Generating website files with gpt-5-codex...`);

    // Етап 2: Генеруємо сайт через Responses API (gpt-5-codex)
    let files: FileItem[] = [];
    let attempts = 0;
    const maxAttempts = 3;
    let validation: ValidationResult = { isValid: false, errors: [], warnings: [] };

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[Job ${jobId}] Generation attempt ${attempts}/${maxAttempts}...`);

      // Будуємо input для Responses API
      const generatorInput = attempts === 1 
        ? [
            { role: 'system', content: GENERATOR_PROMPT },
            { role: 'user', content: technicalPrompt }
          ]
        : [
            { role: 'system', content: GENERATOR_PROMPT },
            { role: 'user', content: technicalPrompt },
            { role: 'assistant', content: JSON.stringify({ files }) },
            { role: 'user', content: createFixPrompt(files, validation) }
          ];

      const generatorResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-codex',
          metadata: {
            requestId: String(Date.now()),
            source: 'lovable-ai-editor',
            domain: job.domain || '',
          },
          input: generatorInput,
          text: {
            format: { type: 'json_object' }
          }
        }),
      });

      if (!generatorResponse.ok) {
        const errorText = await generatorResponse.text();
        console.error(`[Job ${jobId}] OpenAI generation error:`, errorText);
        if (attempts === maxAttempts) {
          throw new Error(`OpenAI API error after ${maxAttempts} attempts: ${generatorResponse.status}`);
        }
        continue;
      }

      const generatorData = await generatorResponse.json();
      console.log(`[Job ${jobId}] Generator response keys:`, Object.keys(generatorData));
      
      // Responses API: output[0].content[0].text або fallback на choices
      const filesJson = generatorData.output?.[0]?.content?.[0]?.text || generatorData.choices?.[0]?.message?.content;
      const finishReason = generatorData.output?.[0]?.stop_reason || generatorData.choices?.[0]?.finish_reason;

      if (!filesJson) {
        console.error(`[Job ${jobId}] Empty response from generator, data:`, JSON.stringify(generatorData).substring(0, 500));
        continue;
      }

      // Check if response was truncated
      if (finishReason === 'length') {
        console.warn(`[Job ${jobId}] Response was truncated due to length limit, retrying...`);
        continue;
      }

      console.log(`[Job ${jobId}] Files JSON received (${filesJson.length} chars), finish_reason: ${finishReason}, parsing...`);

      try {
        const parsedFiles = JSON.parse(filesJson);
        files = parsedFiles.files || [];
      } catch (parseError) {
        console.error(`[Job ${jobId}] Failed to parse files JSON:`, parseError);
        continue;
      }

      console.log(`[Job ${jobId}] Parsed ${files.length} files, validating...`);

      // Валідація
      validation = validateGeneratedFiles(files);
      
      console.log(`[Job ${jobId}] Validation result:`, {
        isValid: validation.isValid,
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length
      });

      if (validation.isValid) {
        console.log(`[Job ${jobId}] Validation passed!`);
        break;
      }

      console.log(`[Job ${jobId}] Validation failed, errors:`, validation.errors);
      
      if (attempts < maxAttempts) {
        console.log(`[Job ${jobId}] Attempting to fix...`);
      }
    }

    // Фінальна валідація
    const finalValidation = validateGeneratedFiles(files);

    // Оновлюємо job з результатом
    await supabase
      .from('ai_generation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        files_data: { files },
        validation: {
          isValid: finalValidation.isValid,
          errors: finalValidation.errors,
          warnings: finalValidation.warnings,
          attempts
        }
      })
      .eq('id', jobId);

    console.log(`[Job ${jobId}] Completed successfully with ${files.length} files`);

  } catch (error) {
    console.error(`[Job ${jobId}] Processing error:`, error);
    
    // Оновлюємо job з помилкою
    await supabase
      .from('ai_generation_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', jobId);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Отримуємо user_id з auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const { 
      domain, 
      geo, 
      languages, 
      theme, 
      keywords, 
      prohibitedWords 
    } = await req.json();

    console.log('Received generation request:', { domain, geo, languages });

    // Створюємо job у базі
    const { data: job, error: insertError } = await supabase
      .from('ai_generation_jobs')
      .insert({
        user_id: user.id,
        domain: domain || 'example.com',
        geo: geo || 'BE',
        languages: languages || ['en'],
        theme,
        keywords,
        prohibited_words: prohibitedWords,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError || !job) {
      console.error('Failed to create job:', insertError);
      throw new Error('Failed to create generation job');
    }

    console.log('Created job:', job.id);

    // Запускаємо обробку у фоні (використовуємо глобальний EdgeRuntime)
    // @ts-ignore - EdgeRuntime доступний у Supabase Edge Functions
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processGenerationJob(job.id, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY)
    ) ?? processGenerationJob(job.id, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY);

    // Одразу повертаємо jobId
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        status: 'pending',
        message: 'Generation started in background'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Request error:', error);
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
