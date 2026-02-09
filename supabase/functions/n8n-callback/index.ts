// @ts-ignore - Deno native serve
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

// v0 API format: { name, content, type }
interface V0File {
  name: string;
  content: string;
  type?: string;
}

function normalizeFiles(raw: unknown[]): GeneratedFile[] {
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      path: (typeof f.path === "string" ? f.path : typeof f.name === "string" ? f.name : "") as string,
      content: (typeof f.content === "string" ? f.content : "") as string,
    }))
    .filter((f) => f.path && f.content.length > 0);
}

function parseFilesFromResponse(responseText: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  
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

// Розпаковка ZIP-архіву з бінарних даних
async function extractFilesFromZip(zipData: ArrayBuffer): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];
  
  try {
    const blobReader = new zip.BlobReader(new Blob([zipData]));
    const zipReader = new zip.ZipReader(blobReader);
    const entries = await zipReader.getEntries();
    
    console.log(`📦 ZIP contains ${entries.length} entries`);
    
    for (const entry of entries) {
      // Пропускаємо директорії
      if (entry.directory) {
        console.log(`📂 Skipping directory: ${entry.filename}`);
        continue;
      }
      
      // Пропускаємо системні файли macOS
      if (entry.filename.startsWith("__MACOSX/") || entry.filename.includes(".DS_Store")) {
        console.log(`🚫 Skipping system file: ${entry.filename}`);
        continue;
      }
      
      try {
        const textWriter = new zip.TextWriter();
        const content = await entry.getData!(textWriter);
        
        if (content && content.length > 0) {
          files.push({
            path: entry.filename,
            content: content,
          });
          console.log(`✅ Extracted: ${entry.filename} (${content.length} chars)`);
        }
      } catch (e) {
        console.warn(`⚠️ Could not read ${entry.filename} as text, skipping:`, e);
      }
    }
    
    await zipReader.close();
  } catch (e) {
    console.error("❌ Failed to read ZIP archive:", e);
    throw new Error(`Failed to extract ZIP: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
  
  console.log(`📁 Extracted ${files.length} files from ZIP`);
  return files;
}

async function createZipBase64(files: GeneratedFile[]): Promise<string> {
  const blobWriter = new zip.BlobWriter("application/zip");
  const zipWriter = new zip.ZipWriter(blobWriter);
  
  const usedPaths = new Set<string>();
  
  for (const file of files) {
    let finalPath = file.path;
    
    if (usedPaths.has(finalPath)) {
      const ext = finalPath.includes('.') ? finalPath.substring(finalPath.lastIndexOf('.')) : '';
      const base = finalPath.includes('.') ? finalPath.substring(0, finalPath.lastIndexOf('.')) : finalPath;
      let counter = 1;
      while (usedPaths.has(`${base}_${counter}${ext}`)) {
        counter++;
      }
      finalPath = `${base}_${counter}${ext}`;
      console.log(`⚠️ Duplicate path detected: ${file.path} -> renamed to ${finalPath}`);
    }
    
    usedPaths.add(finalPath);
    
    try {
      await zipWriter.add(finalPath, new zip.TextReader(file.content));
    } catch (e) {
      console.error(`Failed to add file ${finalPath}:`, e);
    }
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

// ========== Парсинг запиту: multipart/form-data або JSON ==========
interface ParsedCallback {
  historyId?: string;
  requestId?: string;
  jobId?: string;
  status?: string;
  files?: unknown[];
  fileList?: unknown[];
  content?: string;
  result?: string;
  cost?: number;
  model?: string;
  totalFiles?: number;
  error?: string;
  targetTable?: string;
  createNew?: boolean;
  domain?: string;
  geo?: string;
  languages?: string[];
  // ZIP-файл з multipart
  zipFile?: ArrayBuffer;
}

async function parseRequest(req: Request): Promise<ParsedCallback> {
  const contentType = req.headers.get("content-type") || "";
  
  // === Multipart/form-data (новий формат з ZIP) ===
  if (contentType.includes("multipart/form-data")) {
    console.log("📨 Parsing multipart/form-data request");
    const formData = await req.formData();
    
    const result: ParsedCallback = {};
    
    // Текстові поля
    const historyId = formData.get("historyId");
    if (historyId && typeof historyId === "string") result.historyId = historyId;
    
    const status = formData.get("status");
    if (status && typeof status === "string") result.status = status;
    
    const error = formData.get("error");
    if (error && typeof error === "string") result.error = error;
    
    const requestId = formData.get("requestId");
    if (requestId && typeof requestId === "string") result.requestId = requestId;
    
    const jobId = formData.get("jobId");
    if (jobId && typeof jobId === "string") result.jobId = jobId;
    
    const targetTable = formData.get("targetTable");
    if (targetTable && typeof targetTable === "string") result.targetTable = targetTable;
    
    // ZIP-файл
    const file = formData.get("file");
    if (file && file instanceof File) {
      console.log(`📎 Received ZIP file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
      result.zipFile = await file.arrayBuffer();
    }
    
    return result;
  }
  
  // === JSON (legacy формат) ===
  console.log("📨 Parsing JSON request");
  const body = await req.json();
  console.log("📥 Received callback:", JSON.stringify(body).substring(0, 1000));
  return body as ParsedCallback;
}

Deno.serve(async (req) => {
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

    // Парсимо запит (multipart або JSON)
    const body = await parseRequest(req);

    const { 
      requestId, 
      historyId, 
      jobId,
      status, 
      files, 
      fileList,
      content, 
      result, 
      cost, 
      model, 
      totalFiles,
      error,
      targetTable,
      createNew,
      domain,
      geo,
      languages,
      zipFile,
    } = body;

    // Визначаємо ID та таблицю
    const generationId = historyId || requestId || jobId;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing backend credentials");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========== Витягуємо файли з будь-якого формату ==========
    async function extractFiles(): Promise<GeneratedFile[]> {
      // 1. ZIP-файл з multipart (пріоритет)
      if (zipFile) {
        console.log("📦 Extracting files from ZIP archive...");
        return await extractFilesFromZip(zipFile);
      }
      
      // 2. JSON масив файлів (legacy та v0 формат)
      if (files && Array.isArray(files)) {
        return normalizeFiles(files);
      }
      if (fileList && Array.isArray(fileList)) {
        return normalizeFiles(fileList);
      }
      
      // 3. Текстовий контент з маркерами файлів
      if (content && typeof content === "string") {
        return parseFilesFromResponse(content);
      }
      if (result && typeof result === "string") {
        return parseFilesFromResponse(result);
      }
      
      return [];
    }

    // ========== РЕЖИМ 1: Створення нового запису (createNew: true) ==========
    if (createNew) {
      console.log("📝 Creating new record from webhook...");
      
      const parsedFiles = await extractFiles();
      
      if (parsedFiles.length === 0) {
        return new Response(JSON.stringify({ 
          error: "No files provided. Send files as ZIP, 'files' array, or 'content'/'result' string with FILE markers" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log(`📦 Creating ZIP for ${parsedFiles.length} files...`);
      const zipBase64 = await createZipBase64(parsedFiles);
      
      const { data: newJob, error: insertError } = await supabase
        .from("ai_generation_jobs")
        .insert({
          user_id: "00000000-0000-0000-0000-000000000000",
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
      
      const parsedFiles = await extractFiles();
      
      if (parsedFiles.length === 0) {
        throw new Error("No files in callback response (checked ZIP, files array, and content markers)");
      }
      
      // Створюємо ZIP
      console.log(`📦 Creating ZIP archive from ${parsedFiles.length} files...`);
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
