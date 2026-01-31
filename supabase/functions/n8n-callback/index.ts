import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-signature",
};

// Секретний токен для валідації callback (має бути однаковий в n8n)
const CALLBACK_SECRET = Deno.env.get("N8N_CALLBACK_SECRET") || "lovable-n8n-secret-2025";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Валідація підпису
    const signature = req.headers.get("x-n8n-signature");
    if (signature !== CALLBACK_SECRET) {
      console.error("❌ Invalid callback signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("📥 Received callback:", JSON.stringify(body).substring(0, 500));

    const { requestId, historyId, status, files, content, result, cost, model, error } = body;

    // Підтримуємо і historyId і requestId (для сумісності)
    const generationId = historyId || requestId;

    if (!generationId) {
      return new Response(JSON.stringify({ error: "Missing historyId or requestId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔍 Processing callback for generationId: ${generationId}, status: ${status}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing backend credentials");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Обробка статусу
    if (status === "done" || status === "completed") {
      console.log(`✅ Generation completed for generationId: ${generationId}`);
      
      // Витягуємо файли
      let parsedFiles: GeneratedFile[] = [];
      
      if (files && Array.isArray(files)) {
        parsedFiles = files;
      } else if (content && typeof content === "string") {
        parsedFiles = parseFilesFromResponse(content);
      } else if (result && typeof result === "string") {
        parsedFiles = parseFilesFromResponse(result);
      }
      
      if (parsedFiles.length === 0) {
        throw new Error("No files in callback response");
      }
      
      // Створюємо ZIP
      console.log("📦 Creating ZIP archive...");
      const zipBase64 = await createZipBase64(parsedFiles);
      
      // Отримуємо site_name для нотифікації
      const { data: historyData } = await supabase
        .from("generation_history")
        .select("user_id, site_name")
        .eq("id", generationId)
        .single();
      
      // Оновлюємо generation_history
      const { error: updateError } = await supabase
        .from("generation_history")
        .update({
          status: "completed",
          files_data: parsedFiles,
          zip_data: zipBase64,
          generation_cost: cost ?? 1,
          error_message: null,
          specific_ai_model: model ?? "n8n-callback",
          completed_at: new Date().toISOString()
        })
        .eq("id", generationId);
      
      if (updateError) {
        console.error("Failed to update generation_history:", updateError);
        throw updateError;
      }
      
      console.log(`✅ Generation saved: ${parsedFiles.length} files`);
      
      // Відправляємо нотифікацію
      if (historyData?.user_id) {
        await supabase.from("notifications").insert({
          user_id: historyData.user_id,
          title: "Генерація завершена",
          message: `Сайт "${historyData.site_name || "Website"}" успішно згенеровано (${parsedFiles.length} файлів)`,
          type: "generation_complete",
          data: { historyId: generationId, filesCount: parsedFiles.length }
        });
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Callback processed successfully",
        generationId,
        filesCount: parsedFiles.length 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } else if (status === "failed" || status === "error") {
      const errorMessage = error || "n8n generation failed";
      console.error(`❌ Generation failed for generationId: ${generationId}`, errorMessage);
      
      // Оновлюємо з помилкою
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: errorMessage
        })
        .eq("id", generationId);
      
      // Повертаємо баланс
      const { data: historyData } = await supabase
        .from("generation_history")
        .select("user_id, sale_price, site_name")
        .eq("id", generationId)
        .single();
      
      if (historyData?.user_id && historyData?.sale_price) {
        const { data: teamMember } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", historyData.user_id)
          .eq("status", "approved")
          .single();
        
        if (teamMember?.team_id) {
          const { data: team } = await supabase
            .from("teams")
            .select("balance")
            .eq("id", teamMember.team_id)
            .single();
          
          if (team) {
            await supabase
              .from("teams")
              .update({ balance: team.balance + historyData.sale_price })
              .eq("id", teamMember.team_id);
            
            await supabase
              .from("generation_history")
              .update({ sale_price: 0 })
              .eq("id", generationId);
          }
        }
        
        // Нотифікація про помилку
        await supabase.from("notifications").insert({
          user_id: historyData.user_id,
          title: "Помилка генерації",
          message: `Не вдалося згенерувати сайт "${historyData.site_name}". Кошти повернено.`,
          type: "generation_failed",
          data: { historyId: generationId, error: errorMessage }
        });
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Error callback processed" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } else if (status === "processing" || status === "generating") {
      // Проміжний статус - оновлюємо
      await supabase
        .from("generation_history")
        .update({ status: "generating" })
        .eq("id", generationId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Status updated" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Callback received" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("n8n callback error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
