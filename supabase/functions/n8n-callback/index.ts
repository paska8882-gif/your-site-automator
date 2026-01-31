import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallbackPayload {
  requestId: string;
  success: boolean;
  zipUrl?: string;
  githubUrl?: string;
  previewUrl?: string;
  error?: string;
  files?: Array<{ path: string; content: string }>;
  content?: string;
}

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
      console.log(`✅ Parsed: ${fileName} (${fileContent.length} chars)`);
    }
  }
  
  return files;
}

async function downloadAndExtractZip(zipUrl: string): Promise<GeneratedFile[]> {
  console.log(`📥 Downloading ZIP from: ${zipUrl}`);
  
  const response = await fetch(zipUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ZIP: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer]);
  
  const zipReader = new zip.ZipReader(new zip.BlobReader(blob));
  const entries = await zipReader.getEntries();
  
  const files: GeneratedFile[] = [];
  
  for (const entry of entries) {
    if (!entry.directory && entry.getData) {
      const textWriter = new zip.TextWriter();
      const content = await entry.getData(textWriter);
      files.push({ path: entry.filename, content });
      console.log(`✅ Extracted: ${entry.filename} (${content.length} chars)`);
    }
  }
  
  await zipReader.close();
  console.log(`📁 Total files extracted: ${files.length}`);
  
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: CallbackPayload = await req.json();
    const { requestId, success, zipUrl, error, files, content } = payload;

    console.log(`📨 n8n callback received:`, JSON.stringify({
      requestId,
      success,
      hasZipUrl: !!zipUrl,
      hasFiles: !!files,
      hasContent: !!content,
      error
    }));

    if (!requestId) {
      return new Response(JSON.stringify({ error: "Missing requestId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find generation by requestId - try both ID match and error_message marker
    let historyData = null;
    let findError = null;
    
    // First try direct ID match
    const { data: directMatch, error: directErr } = await supabase
      .from("generation_history")
      .select("id, user_id, site_name, sale_price, team_id")
      .eq("id", requestId)
      .eq("status", "generating")
      .maybeSingle();
    
    if (directMatch) {
      historyData = directMatch;
    } else {
      // Try marker lookup
      const { data: markerMatch, error: markerErr } = await supabase
        .from("generation_history")
        .select("id, user_id, site_name, sale_price, team_id")
        .eq("error_message", `n8n:${requestId}`)
        .eq("status", "generating")
        .maybeSingle();
      
      historyData = markerMatch;
      findError = markerErr;
    }

    if (findError || !historyData) {
      console.error("❌ Generation not found for requestId:", requestId, findError);
      return new Response(JSON.stringify({ error: "Generation not found", requestId }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const historyId = historyData.id;
    console.log(`✅ Found generation: ${historyId} for requestId: ${requestId}`);

    if (!success) {
      // Handle failure
      console.error("❌ n8n generation failed:", error);
      
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: error || "n8n generation failed"
        })
        .eq("id", historyId);

      // Refund balance
      if (historyData.team_id && historyData.sale_price) {
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", historyData.team_id)
          .single();

        if (team) {
          await supabase
            .from("teams")
            .update({ balance: team.balance + historyData.sale_price })
            .eq("id", historyData.team_id);

          await supabase
            .from("generation_history")
            .update({ sale_price: 0 })
            .eq("id", historyId);
        }
      }

      // Send failure notification
      if (historyData.user_id) {
        await supabase.from("notifications").insert({
          user_id: historyData.user_id,
          title: "Помилка генерації",
          message: `Не вдалося згенерувати сайт "${historyData.site_name}". Кошти повернено.`,
          type: "generation_failed",
          data: { historyId, error }
        });
      }

      return new Response(JSON.stringify({ success: false, historyId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle success - extract files
    let generatedFiles: GeneratedFile[] = [];

    if (files && Array.isArray(files) && files.length > 0) {
      generatedFiles = files;
      console.log(`📁 Using provided files array: ${files.length} files`);
    } else if (zipUrl) {
      generatedFiles = await downloadAndExtractZip(zipUrl);
    } else if (content && typeof content === "string") {
      generatedFiles = parseFilesFromResponse(content);
    }

    if (generatedFiles.length === 0) {
      throw new Error("No files received from n8n");
    }

    // Create ZIP base64
    console.log("📦 Creating ZIP archive...");
    const zipBase64 = await createZipBase64(generatedFiles);

    // Update generation_history
    const { error: updateError } = await supabase
      .from("generation_history")
      .update({
        status: "completed",
        files_data: generatedFiles,
        zip_data: zipBase64,
        error_message: null,
        specific_ai_model: "n8n-external",
        completed_at: new Date().toISOString()
      })
      .eq("id", historyId);

    if (updateError) {
      console.error("Failed to update generation_history:", updateError);
      throw updateError;
    }

    console.log(`✅ Generation completed: ${generatedFiles.length} files saved`);

    // Send success notification
    if (historyData.user_id) {
      await supabase.from("notifications").insert({
        user_id: historyData.user_id,
        title: "Генерація завершена",
        message: `Сайт "${historyData.site_name}" успішно згенеровано (${generatedFiles.length} файлів)`,
        type: "generation_complete",
        data: { historyId, filesCount: generatedFiles.length }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        historyId,
        filesCount: generatedFiles.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ n8n callback error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
