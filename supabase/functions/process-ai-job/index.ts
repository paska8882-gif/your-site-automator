import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Системний промпт для генерації технічного промпту
const SYSTEM_PROMPT = `# 🧠 AI AGENT — CREATIVE WEBSITE BRIEF GENERATOR

## ROLE: CREATIVE DIRECTOR FOR MULTI-PAGE WEBSITE GENERATION

You are a creative brief generator. Your job is to take minimal input (domain, geo, languages) and create a comprehensive, detailed technical brief for website generation.

## APPROACH: CREATIVE EXPANSION

When given minimal input, you MUST creatively expand it:
- **Domain name** → derive company name, business type, industry
- **Geo/country** → generate realistic local address, phone format, business hours
- **Theme (if provided)** → expand into full service descriptions, unique selling points
- **No theme provided** → invent a compelling business concept based on domain name

## GENERATION RULES

### ALWAYS GENERATE (never ask for more input):
1. **Company Name**: derive from domain (e.g., crakka.com → Crakka)
2. **Business Type**: invent based on domain keywords or create a professional service
3. **Services**: generate 4-6 realistic services matching the business type
4. **Address**: realistic address for the specified geo/country
5. **Phone**: correct format for the country (e.g., Belgium: +32 XX XXX XX XX)
6. **Email**: contact@[domain]
7. **Business Hours**: Mon-Fri 9:00-18:00, Sat-Sun Closed (localized)
8. **About/Mission**: compelling company story
9. **USPs**: 3-5 unique selling points

### REQUIRED OUTPUT STRUCTURE

Your output must be a detailed generation prompt with these sections:

# WEBSITE GENERATION BRIEF

## 1. COMPANY IDENTITY
- Company name, tagline, industry
- Mission statement
- Core values

## 2. SERVICES (4-6 services)
- Service name
- Description (2-3 sentences)
- Key benefits

## 3. CONTACT INFORMATION
- Full address (realistic for geo)
- Phone (correct country format)
- Email
- Business hours (localized)

## 4. WEBSITE STRUCTURE
Required pages: index.html, about.html, services.html, contact.html, blog.html (with 5 posts), faq.html, terms.html, privacy.html, cookies.html, refund-policy.html, disclaimer.html, thank-you.html, 404.html

## 5. VISUAL DIRECTION
- Color palette (5 colors with HEX codes)
- Typography suggestions
- Image style guidance

## 6. SEO & CONTENT
- Target keywords (10-15)
- Meta description template
- Content tone

## 7. TECHNICAL REQUIREMENTS
- Languages: [from input]
- i18n system with localStorage
- Responsive design
- Picsum.photos for images

## 8. PROHIBITED CONTENT
- Words to avoid: [from input or "none"]
- No gambling, adult, crypto unless specified

---

NEVER output "missing required inputs" - ALWAYS generate creative content based on whatever input is provided.
Output ONLY the detailed brief, no explanations or questions.`;

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

// Функція парсингу файлів з /* FILE: */ формату
function parseFilesFromText(text: string): FileItem[] {
  const files: FileItem[] = [];
  
  // Спочатку пробуємо JSON формат
  try {
    const jsonMatch = text.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.files && Array.isArray(parsed.files)) {
        return parsed.files;
      }
    }
  } catch {}

  // Fallback на /* FILE: */ формат (як у n8n)
  const filePatterns = [
    /\/\* FILE: ([^*]+) \*\/\s*([\s\S]*?)(?=\/\* FILE: |$)/g,
    /<!-- FILE: ([^>]+) -->\s*([\s\S]*?)(?=<!-- FILE: |$)/g,
  ];
  
  for (const pattern of filePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fileName = match[1].trim();
      let fileContent = match[2].trim();
      
      // Очищаємо від markdown
      fileContent = fileContent
        .replace(/^```[a-z]*\n?/, '')
        .replace(/\n?```$/, '')
        .trim();
      
      if (fileContent && fileContent.length > 10) {
        files.push({ path: fileName, content: fileContent });
      }
    }
  }
  
  return files;
}

// Головна функція обробки job
async function processJob(jobId: string, supabase: any, openaiKey: string) {
  console.log(`[Job ${jobId}] Starting processing...`);

  // Отримуємо дані job
  const { data: job, error: jobError } = await supabase
    .from('ai_generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (jobError || !job) {
    console.error('[Job] Not found:', jobId, jobError);
    return;
  }

  // Перевіряємо чи job ще не оброблений
  if (job.status === 'completed' || job.status === 'failed') {
    console.log(`[Job ${jobId}] Already processed, status: ${job.status}`);
    return;
  }
  
  // Оновлюємо статус на processing
  await supabase
    .from('ai_generation_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', jobId);
  
  try {
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
        'Authorization': `Bearer ${openaiKey}`,
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

    // Етап 2: Генеруємо сайт через Responses API (gpt-5-codex) — формат як у n8n
    let files: FileItem[] = [];
    let attempts = 0;
    const maxAttempts = 3;
    let validation: ValidationResult = { isValid: false, errors: [], warnings: [] };

    // Будуємо GENERATOR_PROMPT як у n8n — вбудований прямо в content
    const generatorContent = `🚨🚨 **CRITICAL FIXES REQUIRED: GENERATE CLEAN CODE WITHOUT MARKDOWN FORMATTING** 🚨🚨

${technicalPrompt}

**STRICT TECHNICAL REQUIREMENTS:**

⚠️ **USE OF MARKDOWN IN CODE IS PROHIBITED:**
- NO \`\`\`css at the beginning of styles.css
- NO \`\`\`html at the beginning of HTML files
- NO \`\`\`javascript at the beginning of JS files
- Output ONLY Clean code, no markdown
- Example of CORRECT output:
/* FILE: styles.css */
:root { --color-primary: #3498db; }
body { margin: 0; }

⚠️ **IMAGES — PICSUM ONLY (STABLE) + NO BROKEN IMAGES (CRITICAL):**
- DO NOT use local images
- pexels is forbidden
- DO NOT use source.unsplash.com
- Use ONLY picsum.photos seeded urls:
  - https://picsum.photos/seed/<SEED>/<W>/<H>
- SEED must be unique per image and descriptive (example: wayfinding-hero, signage-01, indoor-map-02)
- Every <img> MUST include:
  - on all images: explicit width/height attributes OR css aspect-ratio
  - on non-hero images: loading="lazy"
  - onerror fallback so preview never shows broken images:
    onerror="this.onerror=null; this.src='https://picsum.photos/seed/fallback-'+Math.floor(Math.random()*999999)+'/1200/800';"
- Never leave empty src, never use relative image paths

⚠️ **CORRECT CSS INHERITANCE (NOT composes!):**
- Use MULTIPLE CLASSES in HTML: <section class="page-hero homepage-hero">
- In CSS, style via CASCADE: .page-hero.homepage-hero { ... }
- DO NOT use composes: — it doesn't work in native CSS

✅ **MANDATORY ADDITIONS (DO NOT SKIP):**
1. **RECOMMENDATIONS + TESTIMONIALS:** index.html MUST include sections "Recommendations" and "Testimonials" (grid cards, realistic content).
2. **FAVICON:** Provide favicon.svg and favicon.ico and include links in <head> on ALL pages.
3. **SITEMAP:** Provide sitemap.xml listing ALL pages.
4. **ROBOTS:** Provide robots.txt referencing sitemap.xml.

**OUTPUT FORMAT - CLEAN CODE WITHOUT MARKDOWN:**
- Output as plain text code only.
- Separate files using markers:
/* FILE: index.html */
/* FILE: styles.css */
/* FILE: script.js */
/* FILE: sitemap.xml */
/* FILE: robots.txt */
/* FILE: favicon.svg */

Generate EXCEPTIONAL multi-page website with CLEAN CODE (no markdown) and PROPER CSS inheritance using multiple classes.`;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[Job ${jobId}] Generation attempt ${attempts}/${maxAttempts}...`);

      // Формат запиту як у n8n — input замість messages
      const requestBody = {
        model: 'gpt-5-codex',
        metadata: {
          requestId: String(Date.now()),
          historyId: String(jobId),
          source: 'lovable-ai-editor',
        },
        input: attempts === 1 
          ? [{ role: 'user', content: generatorContent }]
          : [
              { role: 'user', content: generatorContent },
              { role: 'assistant', content: files.map(f => `/* FILE: ${f.path} */\n${f.content}`).join('\n\n') },
              { role: 'user', content: createFixPrompt(files, validation) }
            ]
      };

      console.log(`[Job ${jobId}] Sending request to /v1/responses...`);

      const generatorResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!generatorResponse.ok) {
        const errorText = await generatorResponse.text();
        console.error(`[Job ${jobId}] OpenAI generation error:`, generatorResponse.status, errorText);
        if (attempts === maxAttempts) {
          throw new Error(`OpenAI API error after ${maxAttempts} attempts: ${generatorResponse.status}`);
        }
        continue;
      }

      const generatorData = await generatorResponse.json();
      console.log(`[Job ${jobId}] Generator response keys:`, Object.keys(generatorData));
      
      // Responses API: витягуємо text з output
      let responseText = '';
      if (Array.isArray(generatorData.output)) {
        for (const item of generatorData.output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            const textItem = item.content.find((c: any) => c.type === 'output_text');
            if (textItem?.text) {
              responseText = String(textItem.text);
              break;
            }
          }
        }
      }
      
      // Fallback на choices формат
      if (!responseText && generatorData.choices?.[0]?.message?.content) {
        responseText = generatorData.choices[0].message.content;
      }

      if (!responseText) {
        console.error(`[Job ${jobId}] Empty response from generator`);
        continue;
      }

      console.log(`[Job ${jobId}] Response received (${responseText.length} chars), parsing files...`);

      // Парсимо файли
      files = parseFilesFromText(responseText);
      
      console.log(`[Job ${jobId}] Parsed ${files.length} files:`, files.map(f => f.path));

      if (files.length === 0) {
        console.error(`[Job ${jobId}] No files parsed from response`);
        continue;
      }

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

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Missing environment variables' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { jobId } = await req.json();
    
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[Process] Received job: ${jobId}, starting ASYNC background processing...`);

    // ✅ АСИНХРОННА АРХІТЕКТУРА: waitUntil дозволяє фоновій задачі працювати
    // після того як ми повернемо відповідь клієнту
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          console.log(`[Background] Starting processJob for ${jobId}...`);
          await processJob(jobId, supabase, OPENAI_API_KEY);
          console.log(`[Background] Job ${jobId} COMPLETED successfully!`);
        } catch (error) {
          console.error(`[Background] Job ${jobId} FAILED:`, error);
          // Помічаємо job як failed
          await supabase
            .from('ai_generation_jobs')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        }
      })()
    );

    // ✅ Миттєво повертаємо відповідь - клієнт отримує "accepted"
    // і чекає результат через Realtime підписку
    return new Response(
      JSON.stringify({ 
        accepted: true, 
        message: 'Job started in background',
        jobId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Request error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Логуємо shutdown причину для дебагу
addEventListener('beforeunload', (ev: Event) => {
  const reason = (ev as CustomEvent).detail?.reason || 'unknown';
  console.log(`[Process] Function shutdown, reason: ${reason}`);
});
