import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_START_URL = "https://n8n.dragonwhite-n8n.top/webhook/mcp/start";
const N8N_STATUS_URL = "https://n8n.dragonwhite-n8n.top/webhook/mcp/status";

const POLL_INTERVAL_MS = 4000; // 4 seconds between polls
const MAX_POLL_TIME_MS = 30 * 60 * 1000; // 30 minutes max

interface GeneratedFile {
  path: string;
  content: string;
}

function parseFilesFromResponse(responseText: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const filePattern = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;
  
  let match;
  while ((match = filePattern.exec(responseText)) !== null) {
    const fileName = match[1].trim();
    let fileContent = match[2].trim();
    
    if (fileContent && fileContent.length > 10) {
      files.push({ path: fileName, content: fileContent });
      console.log(`✅ Found: ${fileName} (${fileContent.length} chars)`);
    }
  }
  
  console.log(`📁 Total files found: ${files.length}`);
  return files;
}

async function createZipBase64(files: GeneratedFile[]): Promise<string> {
  const blobWriter = new zip.BlobWriter("application/zip");
  const zipWriter = new zip.ZipWriter(blobWriter);
  
  for (const file of files) {
    await zipWriter.add(file.path, new zip.TextReader(file.content));
  }
  
  const zipBlob = await zipWriter.close();
  const arrayBuffer = await zipBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

async function pollN8nStatus(
  requestId: string,
  historyId: string,
  siteName: string,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const startTime = Date.now();
  
  console.log(`🔄 Starting polling for requestId: ${requestId}, historyId: ${historyId}`);
  
  // Update status to generating
  await (supabase as any)
    .from("generation_history")
    .update({ status: "generating", error_message: null })
    .eq("id", historyId);
  
  try {
    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
      // Wait before polling
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      
      console.log(`📡 Polling n8n status for ${requestId}...`);
      
      try {
        const statusResponse = await fetch(`${N8N_STATUS_URL}?requestId=${requestId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        
        if (!statusResponse.ok) {
          console.error(`❌ Status check failed: ${statusResponse.status}`);
          continue;
        }
        
        const statusData = await statusResponse.json();
        console.log(`📊 Status response:`, JSON.stringify(statusData).substring(0, 200));
        
        if (statusData.status === "done" || statusData.status === "completed") {
          console.log(`✅ Generation completed for ${requestId}`);
          
          // Extract files from the response
          let files: GeneratedFile[] = [];
          
          if (statusData.files && Array.isArray(statusData.files)) {
            files = statusData.files;
          } else if (statusData.content && typeof statusData.content === "string") {
            files = parseFilesFromResponse(statusData.content);
          } else if (statusData.result && typeof statusData.result === "string") {
            files = parseFilesFromResponse(statusData.result);
          }
          
          if (files.length === 0) {
            throw new Error("No files parsed from n8n response");
          }
          
          // Create ZIP
          console.log("📦 Creating ZIP archive...");
          const zipBase64 = await createZipBase64(files);
          
          // Update generation_history with results
          const { error: updateError } = await (supabase as any)
            .from("generation_history")
            .update({
              status: "completed",
              files_data: files,
              zip_data: zipBase64,
              generation_cost: statusData.cost ?? 1,
              error_message: null,
              specific_ai_model: statusData.model ?? "n8n-async",
              completed_at: new Date().toISOString()
            })
            .eq("id", historyId);
          
          if (updateError) {
            console.error("Failed to update generation_history:", updateError);
            throw updateError;
          }
          
          console.log(`✅ Generation saved: ${files.length} files`);
          
          // Get user info for notification
          const { data: historyData } = await (supabase as any)
            .from("generation_history")
            .select("user_id, site_name")
            .eq("id", historyId)
            .single();
          
          if (historyData?.user_id) {
            await (supabase as any).from("notifications").insert({
              user_id: historyData.user_id,
              title: "Генерація завершена",
              message: `Сайт "${historyData.site_name || siteName}" успішно згенеровано (${files.length} файлів)`,
              type: "generation_complete",
              data: { historyId, filesCount: files.length }
            });
          }
          
          return; // Success - exit polling
          
        } else if (statusData.status === "failed" || statusData.status === "error") {
          throw new Error(statusData.error || statusData.message || "n8n generation failed");
        }
        
        // Still processing - continue polling
        console.log(`⏳ Still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
        
      } catch (pollError) {
        console.error("Polling error:", pollError);
        // Don't throw yet, might be a temporary network issue
        if (pollError instanceof Error && pollError.message.includes("failed")) {
          throw pollError;
        }
      }
    }
    
    // Timeout - max poll time exceeded
    throw new Error(`Generation timeout after ${MAX_POLL_TIME_MS / 60000} minutes`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ n8n async generation failed:", errorMessage);
    
    // Update with error
    await (supabase as any)
      .from("generation_history")
      .update({
        status: "failed",
        error_message: errorMessage
      })
      .eq("id", historyId);
    
    // Refund balance on failure
    const { data: historyData } = await (supabase as any)
      .from("generation_history")
      .select("user_id, sale_price, site_name")
      .eq("id", historyId)
      .single();
    
    if (historyData?.user_id && historyData?.sale_price) {
      const { data: teamMember } = await (supabase as any)
        .from("team_members")
        .select("team_id")
        .eq("user_id", historyData.user_id)
        .eq("status", "approved")
        .single();
      
      if (teamMember?.team_id) {
        const { data: team } = await (supabase as any)
          .from("teams")
          .select("balance")
          .eq("id", teamMember.team_id)
          .single();
        
        if (team) {
          await (supabase as any)
            .from("teams")
            .update({ balance: team.balance + historyData.sale_price })
            .eq("id", teamMember.team_id);
          
          await (supabase as any)
            .from("generation_history")
            .update({ sale_price: 0 })
            .eq("id", historyId);
        }
      }
      
      // Send failure notification
      await (supabase as any).from("notifications").insert({
        user_id: historyData.user_id,
        title: "Помилка генерації",
        message: `Не вдалося згенерувати сайт "${historyData.site_name}". Кошти повернено.`,
        type: "generation_failed",
        data: { historyId, error: errorMessage }
      });
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { historyId } = body;

    if (!historyId || typeof historyId !== "string") {
      return new Response(JSON.stringify({ error: "Missing historyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing backend credentials");
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read generation record under RLS
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: history, error: historyErr } = await (authed as any)
      .from("generation_history")
      .select("prompt, language, site_name, geo, vip_prompt, vip_images, color_scheme, layout_style")
      .eq("id", historyId)
      .single();

    if (historyErr || !history?.prompt) {
      const msg = historyErr?.message || "Generation not found";
      return new Response(JSON.stringify({ error: msg }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt: string = history.prompt;
    const language: string = history.language || "en";
    const siteName: string = history.site_name || "Website";

    console.log("🚀 Starting n8n async generation for:", siteName, "historyId:", historyId);

    // Build the n8n request payload
    const n8nPayload = {
      historyId,
      prompt,
      language,
      siteName,
      geo: history.geo,
      vipPrompt: history.vip_prompt,
      vipImages: history.vip_images,
      colorScheme: history.color_scheme,
      layoutStyle: history.layout_style,
      timestamp: new Date().toISOString(),
    };

    console.log("📤 Calling n8n start endpoint...");

    // Call n8n start endpoint - this should return quickly
    const startResponse = await fetch(N8N_START_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("n8n start failed:", startResponse.status, errorText);
      throw new Error(`n8n start endpoint error: ${startResponse.status}`);
    }

    const startData = await startResponse.json();
    console.log("📥 n8n start response:", JSON.stringify(startData));

    const requestId = startData.requestId || startData.id || historyId;
    
    if (!requestId) {
      throw new Error("No requestId returned from n8n");
    }

    console.log(`🎯 Got requestId: ${requestId}, starting background polling...`);

    // Start polling in background (don't block the HTTP request)
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          await pollN8nStatus(requestId, historyId, siteName, supabaseUrl, serviceRoleKey);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error("❌ Background polling crashed:", msg);

          const supabase = createClient(supabaseUrl, serviceRoleKey);
          await (supabase as any)
            .from("generation_history")
            .update({ status: "failed", error_message: msg, sale_price: 0 })
            .eq("id", historyId);
        }
      })()
    );

    // Return immediately - generation continues in background
    return new Response(
      JSON.stringify({
        success: true,
        historyId,
        requestId,
        message: "Generation started, polling in background",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("n8n async proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
