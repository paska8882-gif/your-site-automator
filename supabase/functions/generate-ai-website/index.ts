import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============= SYSTEM PROMPT =============
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

// ============= TYPES =============
interface FileItem {
  path: string;
  content: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============= VALIDATION =============
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
  
  for (const required of requiredFiles) {
    if (!filePaths.includes(required)) {
      errors.push(`Missing: ${required}`);
    }
  }
  
  const stylesFile = files.find(f => f.path === 'styles.css');
  if (stylesFile) {
    if (stylesFile.content.length < 3000) {
      warnings.push(`styles.css too short (${stylesFile.content.length} chars)`);
    }
    if (stylesFile.content.includes('```')) {
      errors.push('styles.css contains markdown fences');
    }
  }
  
  const scriptFile = files.find(f => f.path === 'script.js');
  if (scriptFile) {
    if (!scriptFile.content.includes('I18N') && !scriptFile.content.includes('i18n')) {
      errors.push('script.js missing i18n system');
    }
    if (scriptFile.content.includes('```')) {
      errors.push('script.js contains markdown fences');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// ============= PARSING =============
function parseFilesFromText(text: string): FileItem[] {
  const files: FileItem[] = [];
  
  // Try JSON format first
  try {
    const jsonMatch = text.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.files && Array.isArray(parsed.files)) {
        return parsed.files;
      }
    }
  } catch {}

  // Fallback to /* FILE: */ markers
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
      
      // Clean markdown
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

function calculateTotalSize(files: FileItem[]): number {
  return files.reduce((sum, f) => sum + f.content.length, 0);
}

// ============= FIX WITH GEMINI =============
async function fixFilesWithGemini(
  files: FileItem[], 
  validation: ValidationResult,
  technicalPrompt: string,
  lovableApiKey: string,
  jobId: string
): Promise<FileItem[]> {
  console.log(`[${jobId}] Fixing with Gemini...`);
  
  const fixPrompt = `Fix these issues in the website files:

ERRORS: ${validation.errors.join(', ')}
WARNINGS: ${validation.warnings.join(', ')}

BRIEF: ${technicalPrompt.substring(0, 2000)}...

CURRENT FILES:
${files.slice(0, 5).map(f => `/* FILE: ${f.path} */\n${f.content.substring(0, 1000)}...`).join('\n\n')}

Fix ALL errors. Output using /* FILE: filename */ markers. No markdown.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: fixPrompt }],
        temperature: 0.2,
        max_tokens: 50000,
      }),
    });

    if (!response.ok) {
      console.error(`[${jobId}] Gemini error:`, response.status);
      return files;
    }

    const data = await response.json();
    const fixedContent = data.choices?.[0]?.message?.content;
    if (!fixedContent) return files;

    const fixedFiles = parseFilesFromText(fixedContent);
    if (fixedFiles.length === 0) return files;

    // Merge fixed files with original
    const mergedFiles: FileItem[] = [...fixedFiles];
    for (const origFile of files) {
      if (!fixedFiles.find(f => f.path === origFile.path)) {
        mergedFiles.push(origFile);
      }
    }

    console.log(`[${jobId}] Gemini fixed ${fixedFiles.length} files`);
    return mergedFiles;

  } catch (error) {
    console.error(`[${jobId}] Gemini fix failed:`, error);
    return files;
  }
}

// ============= MAIN PROCESSOR =============
async function processGeneration(
  jobId: string, 
  job: any, 
  supabase: any, 
  openaiKey: string, 
  lovableApiKey: string
) {
  console.log(`[${jobId}] === STARTING GENERATION ===`);

  try {
    // Update status to processing
    await supabase
      .from('ai_generation_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // ============= STEP 1: Generate Technical Prompt =============
    const userInput = `
domain: ${job.domain}
geo: ${job.geo || 'BE'}
language: ${job.languages?.join(', ') || 'en'}
theme: ${job.theme || ''}
keywords: ${job.keywords || ''}
prohibited words: ${job.prohibited_words || 'none'}
    `.trim();

    console.log(`[${jobId}] Step 1: Generating technical prompt with GPT-4o...`);

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
      console.error(`[${jobId}] GPT-4o error:`, errorText);
      throw new Error(`GPT-4o API error: ${promptResponse.status}`);
    }

    const promptData = await promptResponse.json();
    const technicalPrompt = promptData.choices?.[0]?.message?.content;

    if (!technicalPrompt) {
      throw new Error('Failed to generate technical prompt');
    }

    console.log(`[${jobId}] Technical prompt: ${technicalPrompt.length} chars`);
    
    // Save technical prompt
    await supabase
      .from('ai_generation_jobs')
      .update({ technical_prompt: technicalPrompt })
      .eq('id', jobId);

    // ============= STEP 2: Generate Files with GPT-5-Codex =============
    console.log(`[${jobId}] Step 2: Generating files with GPT-5-Codex...`);

    const generatorContent = `🚨 GENERATE CLEAN CODE WITHOUT MARKDOWN 🚨

${technicalPrompt}

**REQUIREMENTS:**
- NO markdown fences (\`\`\`html, \`\`\`css)
- Use Picsum.photos for images: https://picsum.photos/seed/<SEED>/<W>/<H>
- Include onerror fallback on all images
- Use multiple CSS classes for inheritance (NOT composes:)
- Include Recommendations + Testimonials on index.html
- Provide favicon.svg, sitemap.xml, robots.txt

**OUTPUT FORMAT:**
/* FILE: index.html */
content...

/* FILE: styles.css */
content...

/* FILE: script.js */
content...

Generate ALL ${job.languages?.length > 1 ? 'multi-language' : ''} pages: index, about, services, contact, blog (5 posts), faq, terms, privacy, cookies, refund-policy, disclaimer, thank-you, 404.`;

    const codexResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-codex',
        metadata: {
          requestId: String(Date.now()),
          historyId: String(jobId),
          source: 'lovable-ai-editor',
        },
        input: [{ role: 'user', content: generatorContent }]
      }),
    });

    if (!codexResponse.ok) {
      const errorText = await codexResponse.text();
      console.error(`[${jobId}] Codex error:`, codexResponse.status, errorText);
      throw new Error(`Codex API error: ${codexResponse.status}`);
    }

    const codexData = await codexResponse.json();
    console.log(`[${jobId}] Codex response keys:`, Object.keys(codexData));
    
    // Extract text from Responses API format
    let responseText = '';
    if (Array.isArray(codexData.output)) {
      for (const item of codexData.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          const textItem = item.content.find((c: any) => c.type === 'output_text');
          if (textItem?.text) {
            responseText = String(textItem.text);
            break;
          }
        }
      }
    }
    
    // Fallback to choices format
    if (!responseText && codexData.choices?.[0]?.message?.content) {
      responseText = codexData.choices[0].message.content;
    }

    if (!responseText) {
      throw new Error('Empty response from Codex');
    }

    console.log(`[${jobId}] Codex response: ${responseText.length} chars`);

    // ============= STEP 3: Parse Files =============
    let files = parseFilesFromText(responseText);
    console.log(`[${jobId}] Parsed ${files.length} files:`, files.map(f => f.path).join(', '));

    if (files.length === 0) {
      throw new Error('No files parsed from Codex response');
    }

    // ============= STEP 4: Validate & Fix =============
    let validation = validateGeneratedFiles(files);
    console.log(`[${jobId}] Validation: ${validation.isValid ? 'PASS' : 'FAIL'}, errors: ${validation.errors.length}`);

    // Try to fix with Gemini if validation fails and we have enough content
    if (!validation.isValid && lovableApiKey && calculateTotalSize(files) > 35000) {
      console.log(`[${jobId}] Attempting Gemini fix...`);
      files = await fixFilesWithGemini(files, validation, technicalPrompt, lovableApiKey, jobId);
      validation = validateGeneratedFiles(files);
      console.log(`[${jobId}] After fix: ${validation.isValid ? 'PASS' : 'FAIL'}`);
    }

    // ============= STEP 5: Save Result =============
    const finalSize = calculateTotalSize(files);
    
    await supabase
      .from('ai_generation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        files_data: files,
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
          totalSizeBytes: finalSize,
          filesCount: files.length
        }
      })
      .eq('id', jobId);

    console.log(`[${jobId}] === COMPLETED: ${files.length} files, ${Math.round(finalSize / 1024)}KB ===`);

  } catch (error) {
    console.error(`[${jobId}] === FAILED:`, error);
    
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

// ============= EDGE RUNTIME DECLARATION =============
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const { domain, geo, languages, theme, keywords, prohibitedWords } = await req.json();

    console.log(`[New Job] domain=${domain}, geo=${geo}, user=${user.id}`);

    // Create job in database
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

    console.log(`[Job ${job.id}] Created, starting background processing...`);

    // ✅ ASYNC BACKGROUND PROCESSING with waitUntil
    EdgeRuntime.waitUntil(
      processGeneration(job.id, job, supabase, OPENAI_API_KEY, LOVABLE_API_KEY || '')
    );

    // Return immediately with jobId
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        status: 'pending',
        message: 'Generation started. Files will be ready in 15-25 minutes.'
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

// Log shutdown reason
addEventListener('beforeunload', (ev: Event) => {
  const reason = (ev as CustomEvent).detail?.reason || 'unknown';
  console.log(`[Shutdown] reason: ${reason}`);
});
