// @ts-ignore - Deno native serve
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-signature, x-webhook-secret",
};

const CALLBACK_SECRET = Deno.env.get("N8N_CALLBACK_SECRET") || "lovable-n8n-secret-2025";




interface GeneratedFile {
  path: string;
  content: string;
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
      }
    }
    if (files.length > 0) break;
  }
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
      while (usedPaths.has(`${base}_${counter}${ext}`)) counter++;
      finalPath = `${base}_${counter}${ext}`;
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
  error?: string;
  targetTable?: string;
  createNew?: boolean;
  domain?: string;
  geo?: string;
  languages?: string[];
  // ZIP passthrough
  zipFile?: ArrayBuffer;
  zipFileName?: string;
}

async function parseRequest(req: Request): Promise<ParsedCallback> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    console.log("📨 Parsing multipart/form-data request");
    const formData = await req.formData();
    const result: ParsedCallback = {};

    const textFields = ["historyId", "requestId", "jobId", "status", "error", "targetTable"] as const;
    for (const field of textFields) {
      const val = formData.get(field);
      if (val && typeof val === "string") (result as any)[field] = val;
    }

    const file = formData.get("file");
    if (file && file instanceof File) {
      console.log(`📎 ZIP file: ${file.name}, ${file.size} bytes`);
      result.zipFile = await file.arrayBuffer();
      result.zipFileName = file.name || "site.zip";
    }

    return result;
  }

  console.log("📨 Parsing JSON request");
  const body = await req.json();
  console.log("📥 Callback:", JSON.stringify(body).substring(0, 1000));
  return body as ParsedCallback;
}

// ========== Завантаження ZIP в Storage ==========
async function uploadZipToStorage(
  supabase: any,
  generationId: string,
  zipData: ArrayBuffer,
  fileName: string
): Promise<string> {
  const storagePath = `${generationId}/${fileName}`;
  
  const { error: uploadError } = await supabase.storage
    .from("generated-sites")
    .upload(storagePath, zipData, {
      contentType: "application/zip",
      upsert: true,
    });

  if (uploadError) {
    console.error("❌ Storage upload error:", uploadError);
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("generated-sites")
    .getPublicUrl(storagePath);

  console.log(`✅ ZIP uploaded to storage: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-n8n-signature") || req.headers.get("x-webhook-secret");
    if (signature !== CALLBACK_SECRET) {
      console.error("❌ Invalid callback signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await parseRequest(req);
    const {
      requestId, historyId, jobId, status,
      files, fileList, content, result,
      cost, model, error,
      targetTable, createNew, domain, geo, languages,
      zipFile, zipFileName,
    } = body;

    const generationId = historyId || requestId || jobId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing backend credentials");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ========== Допоміжна функція: витягти файли з JSON ==========
    function extractFilesFromJson(): GeneratedFile[] {
      if (files && Array.isArray(files)) return normalizeFiles(files);
      if (fileList && Array.isArray(fileList)) return normalizeFiles(fileList);
      if (content && typeof content === "string") return parseFilesFromResponse(content);
      if (result && typeof result === "string") return parseFilesFromResponse(result);
      return [];
    }

    // ========== РЕЖИМ 1: createNew ==========
    if (createNew) {
      console.log("📝 Creating new record...");
      const parsedFiles = extractFilesFromJson();
      if (parsedFiles.length === 0) {
        return new Response(JSON.stringify({ error: "No files provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      if (insertError) throw insertError;

      return new Response(JSON.stringify({
        success: true, jobId: newJob.id, filesCount: parsedFiles.length,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== РЕЖИМ 2: Оновлення існуючого запису ==========
    if (!generationId) {
      return new Response(JSON.stringify({
        error: "Missing historyId/requestId/jobId. Or set createNew: true.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`🔍 Processing: generationId=${generationId}, status=${status}`);

    // Auto-detect table
    let table = targetTable;
    if (!table) {
      const { data: jobCheck } = await supabase
        .from("ai_generation_jobs").select("id").eq("id", generationId).single();
      table = jobCheck ? "ai_generation_jobs" : "generation_history";
    }
    console.log(`📊 Table: ${table}`);

    // ===== STATUS: done / completed =====
    if (status === "done" || status === "completed") {
      console.log(`✅ Generation completed: ${generationId}`);

      // --- ZIP passthrough (multipart) ---
      if (zipFile) {
        console.log(`📦 ZIP passthrough mode: ${zipFileName} (${zipFile.byteLength} bytes)`);
        const downloadUrl = await uploadZipToStorage(
          supabase, generationId, zipFile, zipFileName || "site.zip"
        );

        if (table === "ai_generation_jobs") {
          const { error: updateError } = await supabase
            .from("ai_generation_jobs")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", generationId);
          if (updateError) throw updateError;
        } else {
          const { data: historyData } = await supabase
            .from("generation_history")
            .select("user_id, site_name")
            .eq("id", generationId)
            .single();

          const { error: updateError } = await supabase
            .from("generation_history")
            .update({
              status: "completed",
              download_url: downloadUrl,
              generation_cost: cost ?? 0,
              error_message: null,
              specific_ai_model: model ?? "n8n-callback",
              completed_at: new Date().toISOString(),
            })
            .eq("id", generationId);
          if (updateError) throw updateError;

          if (historyData?.user_id) {
            await supabase.from("notifications").insert({
              user_id: historyData.user_id,
              title: "Генерація завершена",
              message: `Сайт "${historyData.site_name || "Website"}" готовий до завантаження`,
              type: "generation_complete",
              data: { historyId: generationId },
            });
          }
        }

        return new Response(JSON.stringify({
          success: true, generationId, table, downloadUrl,
          message: "ZIP uploaded to storage",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // --- JSON files (legacy) ---
      const parsedFiles = extractFilesFromJson();
      if (parsedFiles.length === 0) {
        throw new Error("No files in callback (no ZIP and no JSON files)");
      }

      console.log(`📦 JSON mode: ${parsedFiles.length} files`);
      const zipBase64 = await createZipBase64(parsedFiles);

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
        if (updateError) throw updateError;
      } else {
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
            generation_cost: cost ?? 0,
            error_message: null,
            specific_ai_model: model ?? "n8n-callback",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);
        if (updateError) throw updateError;

        if (historyData?.user_id) {
          await supabase.from("notifications").insert({
            user_id: historyData.user_id,
            title: "Генерація завершена",
            message: `Сайт "${historyData.site_name || "Website"}" згенеровано (${parsedFiles.length} файлів)`,
            type: "generation_complete",
            data: { historyId: generationId, filesCount: parsedFiles.length },
          });
        }
      }

      return new Response(JSON.stringify({
        success: true, generationId, table, filesCount: parsedFiles.length,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ===== STATUS: failed =====
    } else if (status === "failed" || status === "error") {
      const errorMessage = error || "External generation failed";
      console.error(`❌ Failed: ${generationId}`, errorMessage);

      if (table === "ai_generation_jobs") {
        await supabase.from("ai_generation_jobs")
          .update({ status: "failed", error_message: errorMessage })
          .eq("id", generationId);
      } else {
        await supabase.from("generation_history")
          .update({ status: "failed", error_message: errorMessage })
          .eq("id", generationId);

        // Refund balance
        const { data: historyData } = await supabase
          .from("generation_history")
          .select("user_id, sale_price, site_name")
          .eq("id", generationId).single();

        if (historyData?.user_id && historyData?.sale_price) {
          const { data: teamMember } = await supabase
            .from("team_members").select("team_id")
            .eq("user_id", historyData.user_id).eq("status", "approved").single();

          if (teamMember?.team_id) {
            const { data: team } = await supabase
              .from("teams").select("balance").eq("id", teamMember.team_id).single();
            if (team) {
              await supabase.from("teams")
                .update({ balance: team.balance + historyData.sale_price })
                .eq("id", teamMember.team_id);
              await supabase.from("generation_history")
                .update({ sale_price: 0 }).eq("id", generationId);
            }
          }

          await supabase.from("notifications").insert({
            user_id: historyData.user_id,
            title: "Помилка генерації",
            message: `Не вдалося згенерувати "${historyData.site_name}". Кошти повернено.`,
            type: "generation_failed",
            data: { historyId: generationId, error: errorMessage },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Error processed", table }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ===== STATUS: processing =====
    } else if (status === "processing" || status === "generating") {
      const updateStatus = table === "ai_generation_jobs" ? "processing" : "generating";
      await supabase.from(table).update({ status: updateStatus }).eq("id", generationId);

      return new Response(JSON.stringify({ success: true, message: "Status updated", table }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "No action taken" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("n8n callback error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
