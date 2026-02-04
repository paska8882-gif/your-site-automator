import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// ============= EDGE RUNTIME =============
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

// ============= MAIN PROCESSING FUNCTION =============
async function processCodexGeneration(
  jobId: string,
  technicalPrompt: string,
  languages: string[],
  supabase: any,
  openaiKey: string,
  lovableApiKey: string
) {
  console.log(`[${jobId}] === STARTING CODEX GENERATION ===`);

  try {
    // Update status to processing
    await supabase.from('ai_generation_jobs').update({
      status: 'processing'
    }).eq('id', jobId);

    // ============= Generate Files with GPT-5-Codex =============
    console.log(`[${jobId}] Calling GPT-5-Codex...`);

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

Generate ALL ${languages?.length > 1 ? 'multi-language' : ''} pages: index, about, services, contact, blog (5 posts), faq, terms, privacy, cookies, refund-policy, disclaimer, thank-you, 404.`;

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
    console.log(`[${jobId}] Codex response received`);
    
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

    // ============= Parse Files =============
    let files = parseFilesFromText(responseText);
    console.log(`[${jobId}] Parsed ${files.length} files:`, files.map(f => f.path).join(', '));

    if (files.length === 0) {
      throw new Error('No files parsed from Codex response');
    }

    // ============= Validate & Fix =============
    let validation = validateGeneratedFiles(files);
    console.log(`[${jobId}] Validation: ${validation.isValid ? 'PASS' : 'FAIL'}, errors: ${validation.errors.length}`);

    // Try to fix with Gemini if validation fails and we have enough content
    if (!validation.isValid && lovableApiKey && calculateTotalSize(files) > 35000) {
      console.log(`[${jobId}] Attempting Gemini fix...`);
      files = await fixFilesWithGemini(files, validation, technicalPrompt, lovableApiKey, jobId);
      validation = validateGeneratedFiles(files);
      console.log(`[${jobId}] After fix: ${validation.isValid ? 'PASS' : 'FAIL'}`);
    }

    // ============= Save Result =============
    const finalSize = calculateTotalSize(files);
    
    await supabase.from('ai_generation_jobs').update({
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
    }).eq('id', jobId);

    console.log(`[${jobId}] === COMPLETED: ${files.length} files, ${Math.round(finalSize / 1024)}KB ===`);

  } catch (error) {
    console.error(`[${jobId}] === FAILED:`, error);
    
    await supabase.from('ai_generation_jobs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Unknown error'
    }).eq('id', jobId);
  }
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
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      throw new Error('Required environment variables not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { jobId, technicalPrompt, languages } = await req.json();

    if (!jobId || !technicalPrompt) {
      throw new Error('Missing jobId or technicalPrompt');
    }

    console.log(`[${jobId}] Worker received job, starting background processing...`);

    // Use EdgeRuntime.waitUntil for background processing
    // This allows the function to continue running after response is sent
    EdgeRuntime.waitUntil(
      processCodexGeneration(
        jobId,
        technicalPrompt,
        languages || ['en'],
        supabase,
        OPENAI_API_KEY,
        LOVABLE_API_KEY || ''
      )
    );

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: 'Codex generation started in background'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Worker error:', error);
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
  console.log(`[Codex Worker Shutdown] reason: ${reason}`);
});
