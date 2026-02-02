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

## OUTPUT CONTRACT (MANDATORY)

your output must be:
- a single markdown document with the full generation prompt
- structured using clear section headers
- fully populated using user input + allowed controlled generation
- no extra commentary before or after the generation prompt

## end of prompt`;

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

    console.log(`[Process] Received job: ${jobId}, starting SYNCHRONOUS processing...`);

    // СИНХРОННА ОБРОБКА - чекаємо завершення перед return
    // Edge Functions підтримують до 400 секунд таймауту
    await processJob(jobId, supabase, OPENAI_API_KEY);

    console.log(`[Process] Job ${jobId} completed!`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Job processing completed',
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
