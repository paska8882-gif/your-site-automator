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

    // ============= BLOCK GENERATION DURING MAINTENANCE (HARD STOP) =============
    // When either global maintenance or generation maintenance is enabled,
    // we must not create jobs or start any background work.
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('maintenance_mode')
      .select('enabled, message, support_link, generation_disabled, generation_message')
      .eq('id', 'global')
      .maybeSingle();

    if (!maintenanceError && maintenanceData && (maintenanceData.enabled || maintenanceData.generation_disabled)) {
      const messageToShow = maintenanceData.enabled
        ? (maintenanceData.message || maintenanceData.generation_message || 'Ведуться технічні роботи. Спробуйте пізніше.')
        : (maintenanceData.generation_message || maintenanceData.message || 'Ведеться технічне обслуговування. Генерація тимчасово недоступна.');

      return new Response(
        JSON.stringify({
          success: false,
          error: messageToShow,
          support_link: maintenanceData.support_link || null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        }
      );
    }

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

    console.log(`[Job ${job.id}] Created, starting Stage 1 (GPT-4o)...`);

    // ============= STAGE 1: Generate Technical Prompt (fast, ~30 seconds) =============
    const userInput = `
domain: ${job.domain}
geo: ${job.geo || 'BE'}
language: ${job.languages?.join(', ') || 'en'}
theme: ${job.theme || ''}
keywords: ${job.keywords || ''}
prohibited words: ${job.prohibited_words || 'none'}
    `.trim();

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
      }),
    });

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error(`[${job.id}] GPT-4o error:`, errorText);
      
      await supabase.from('ai_generation_jobs').update({
        status: 'failed',
        error_message: `GPT-4o API error: ${promptResponse.status}`
      }).eq('id', job.id);
      
      throw new Error(`GPT-4o API error: ${promptResponse.status}`);
    }

    const promptData = await promptResponse.json();
    const technicalPrompt = promptData.choices?.[0]?.message?.content;

    if (!technicalPrompt) {
      await supabase.from('ai_generation_jobs').update({
        status: 'failed',
        error_message: 'Failed to generate technical prompt'
      }).eq('id', job.id);
      
      throw new Error('Failed to generate technical prompt');
    }

    console.log(`[${job.id}] Stage 1 complete: ${technicalPrompt.length} chars`);
    
    // Save technical prompt and update status to ready for Stage 2
    await supabase.from('ai_generation_jobs').update({
      technical_prompt: technicalPrompt,
      status: 'prompt_ready',
      started_at: new Date().toISOString()
    }).eq('id', job.id);

    // ============= STAGE 2: Start Codex generation via callback =============
    // Instead of waiting synchronously, we'll trigger a separate call
    // that will use the codex-generation-worker function
    
    const workerUrl = `${SUPABASE_URL}/functions/v1/codex-generation-worker`;
    
    console.log(`[${job.id}] Triggering Stage 2 worker...`);
    
    // Fire and forget - don't await
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        jobId: job.id,
        technicalPrompt,
        languages: job.languages,
      }),
    }).catch(err => {
      console.error(`[${job.id}] Failed to trigger worker:`, err);
    });

    // Return immediately with jobId
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        status: 'prompt_ready',
        message: 'Technical prompt generated. File generation started in background (15-25 minutes).'
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
