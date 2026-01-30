import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get storage stats using the RPC function
    const { data, error } = await supabase.rpc('get_database_storage_stats');

    if (error) {
      console.error('Error fetching storage stats:', error);
      throw error;
    }

    const stats = data?.[0] || {
      total_size: 'N/A',
      tables_size: 'N/A',
      generation_history_size: 'N/A',
      zip_data_size: 'N/A',
      table_count: 0,
    };

    console.log('Storage stats fetched:', stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in get-storage-stats:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        total_size: 'N/A',
        tables_size: 'N/A',
        generation_history_size: 'N/A',
        zip_data_size: 'N/A',
        table_count: 0,
      }),
      { 
        status: 200, // Return 200 with fallback data
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
