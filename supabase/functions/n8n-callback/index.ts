import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-signature, x-webhook-secret",
};

// Секретний токен для валідації callback
const CALLBACK_SECRET = Deno.env.get("N8N_CALLBACK_SECRET") || "lovable-n8n-secret-2025";

interface GeneratedFile {
  path: string;
  content: string;
}

function parseFilesFromResponse(responseText: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  
  // Спробуємо кілька варіантів маркерів
  const patterns = [
    /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g,
    /\/\* FILE: ([^ ]+) \*\/([\s\S]*?)(?=\/\* FILE: |$)/g,
    /=== FILE: ([^ ]+) ===([\s\S]*?)(?==== FILE: |$)/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(responseText)) !== null) {
      const fileName = match[1].trim();
      let fileContent = match[2].trim();
      
      // Прибираємо markdown fences якщо є
      fileContent = fileContent.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '');
      
      if (fileContent && fileContent.length > 10) {
        files.push({ path: fileName, content: fileContent });
        console.log(`✅ Found: ${fileName} (${fileContent.length} chars)`);
      }
    }
    if (files.length > 0) break;
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
    // Валідація підпису (підтримуємо обидва заголовки)
    const signature = req.headers.get("x-n8n-signature") || req.headers.get("x-webhook-secret");
    if (signature !== CALLBACK_SECRET) {
      console.error("❌ Invalid callback signature:", signature);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("📥 Received callback:", JSON.stringify(body).substring(0, 1000));

    const { 
      // Ідентифікатори
      requestId, 
      historyId, 
      jobId,
      // Статуси
      status, 
      // Дані файлів
      files, 
      fileList,
      content, 
      result, 
      // Мета
      cost, 
      model, 
      totalFiles,
      // Помилки
      error,
      // Режим: 'generation_history' або 'ai_jobs' (за замовчуванням авто-детект)
      targetTable,
      // Якщо хочемо створити новий запис (без прив'язки до існуючого)
      createNew,
      domain,
      geo,
      languages,
    } = body;

    // Визначаємо ID та таблицю
    const generationId = historyId || requestId || jobId;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing backend credentials");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========== РЕЖИМ 1: Створення нового запису (createNew: true) ==========
    if (createNew) {
      console.log("📝 Creating new record from webhook...");
      
      let parsedFiles: GeneratedFile[] = [];
      
      // Витягуємо файли з різних форматів
      if (files && Array.isArray(files)) {
        parsedFiles = files;
      } else if (fileList && Array.isArray(fileList)) {
        parsedFiles = fileList;
      } else if (content && typeof content === "string") {
        parsedFiles = parseFilesFromResponse(content);
      } else if (result && typeof result === "string") {
        parsedFiles = parseFilesFromResponse(result);
      }
      
      if (parsedFiles.length === 0) {
        return new Response(JSON.stringify({ 
          error: "No files provided. Send files as 'files' array or 'content'/'result' string with FILE markers" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log(`📦 Creating ZIP for ${parsedFiles.length} files...`);
      const zipBase64 = await createZipBase64(parsedFiles);
      
      // Зберігаємо в ai_generation_jobs
      const { data: newJob, error: insertError } = await supabase
        .from("ai_generation_jobs")
        .insert({
          user_id: "00000000-0000-0000-0000-000000000000", // Системний user для webhook
          domain: domain || "webhook-import",
          geo: geo || "US",
          languages: languages || ["en"],
          status: "completed",
          files_data: parsedFiles,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      
      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }
      
      console.log(`✅ New job created: ${newJob.id} with ${parsedFiles.length} files`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "New generation created from webhook",
        jobId: newJob.id,
        filesCount: parsedFiles.length,
        totalSize: parsedFiles.reduce((acc, f) => acc + f.content.length, 0),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== РЕЖИМ 2: Оновлення існуючого запису ==========
    if (!generationId) {
      return new Response(JSON.stringify({ 
        error: "Missing historyId, requestId, or jobId. Or set createNew: true to create new record." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔍 Processing callback for generationId: ${generationId}, status: ${status}`);

    // Визначаємо таблицю автоматично
    let table = targetTable;
    if (!table) {
      // Перевіряємо чи ID є в ai_generation_jobs
      const { data: jobCheck } = await supabase
        .from("ai_generation_jobs")
        .select("id")
        .eq("id", generationId)
        .single();
      
      if (jobCheck) {
        table = "ai_generation_jobs";
      } else {
        table = "generation_history";
      }
    }
    
    console.log(`📊 Using table: ${table}`);

    // Обробка статусу
    if (status === "done" || status === "completed") {
      console.log(`✅ Generation completed for generationId: ${generationId}`);
      
      // Витягуємо файли
      let parsedFiles: GeneratedFile[] = [];
      
      if (files && Array.isArray(files)) {
        parsedFiles = files;
      } else if (fileList && Array.isArray(fileList)) {
        parsedFiles = fileList;
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
      
      // Оновлюємо відповідну таблицю
      if (table === "ai_generation_jobs") {
        const { error: updateError } = await supabase
          .from("ai_generation_jobs")
          .update({
            status: "completed",
            files_data: parsedFiles,
            completed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", generationId);
        
        if (updateError) {
          console.error("Failed to update ai_generation_jobs:", updateError);
          throw updateError;
        }
      } else {
        // generation_history
        const { data: historyData } = await supabase
          .from("generation_history")
          .select("user_id, site_name")
          .eq("id", generationId)
          .single();
        
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
      }
      
      console.log(`✅ Generation saved: ${parsedFiles.length} files in ${table}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Callback processed successfully",
        generationId,
        table,
        filesCount: parsedFiles.length,
        totalSize: parsedFiles.reduce((acc, f) => acc + f.content.length, 0),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } else if (status === "failed" || status === "error") {
      const errorMessage = error || "External generation failed";
      console.error(`❌ Generation failed for generationId: ${generationId}`, errorMessage);
      
      if (table === "ai_generation_jobs") {
        await supabase
          .from("ai_generation_jobs")
          .update({
            status: "failed",
            error_message: errorMessage
          })
          .eq("id", generationId);
      } else {
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
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Error callback processed",
        table,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      
    } else if (status === "processing" || status === "generating") {
      // Проміжний статус
      if (table === "ai_generation_jobs") {
        await supabase
          .from("ai_generation_jobs")
          .update({ status: "processing" })
          .eq("id", generationId);
      } else {
        await supabase
          .from("generation_history")
          .update({ status: "generating" })
          .eq("id", generationId);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Status updated",
        table,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Callback received (no action taken)" 
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
