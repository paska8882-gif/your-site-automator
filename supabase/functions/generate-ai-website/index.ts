import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
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

    console.log('Received generation request:', { domain, geo, languages, userId: user.id });

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

    // Викликаємо process-ai-job функцію і ЧЕКАЄМО початок обробки
    const processUrl = `${SUPABASE_URL}/functions/v1/process-ai-job`;
    
    console.log('Triggering process-ai-job for:', job.id);
    
    // Синхронний виклик - чекаємо щоб переконатись що функція запустилась
    // Але не чекаємо завершення (process-ai-job працює довго)
    const processResponse = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    });
    
    console.log(`process-ai-job triggered, status: ${processResponse.status}`);
    
    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error('process-ai-job error:', errorText);
    }

    // Повертаємо jobId
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        status: 'pending',
        message: 'Generation started in background. Poll for status updates.'
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
