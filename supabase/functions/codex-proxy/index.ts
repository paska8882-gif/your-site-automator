import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhook для старту генерації (має повертати jobId)
const CODEX_START_URL = "https://tryred.app.n8n.cloud/webhook/964e523f-9fd0-4462-99fd-3c94bb6d37af";
// Webhook для перевірки статусу (має повертати status + ZIP коли готово)
const CODEX_STATUS_URL = "https://tryred.app.n8n.cloud/webhook/964e523f-9fd0-4462-99fd-3c94bb6d37af/status";

// Налаштування polling
const POLL_INTERVAL_MS = 5000; // 5 секунд
const MAX_POLL_TIME_MS = 10 * 60 * 1000; // 10 хвилин максимум

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function jsonError(status: number, error: string, details?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error, ...(details ? { details } : {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tryExtractFromJson(payload: unknown): Promise<{ jobId?: string; status?: string; base64Zip?: string; url?: string }> {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;

  const result: { jobId?: string; status?: string; base64Zip?: string; url?: string } = {};

  // jobId
  if (typeof obj.jobId === "string") result.jobId = obj.jobId;
  if (typeof obj.job_id === "string") result.jobId = obj.job_id;
  if (typeof obj.id === "string" && !result.jobId) result.jobId = obj.id;

  // status
  if (typeof obj.status === "string") result.status = obj.status;
  if (typeof obj.state === "string" && !result.status) result.status = obj.state;

  // ZIP data
  const zipCandidates = [obj.base64Zip, obj.zipBase64, obj.zip_data, obj.zipData, obj.data, obj.file, obj.result];
  for (const c of zipCandidates) {
    if (typeof c === "string" && c.trim().length > 100) {
      if (/^https?:\/\//i.test(c.trim())) {
        result.url = c.trim();
      } else {
        result.base64Zip = c.trim();
      }
      break;
    }
  }

  // Nested data
  if (obj.data && typeof obj.data === "object" && !result.base64Zip && !result.url) {
    const nested = await tryExtractFromJson(obj.data);
    if (nested.base64Zip) result.base64Zip = nested.base64Zip;
    if (nested.url) result.url = nested.url;
    if (nested.jobId && !result.jobId) result.jobId = nested.jobId;
    if (nested.status && !result.status) result.status = nested.status;
  }

  return result;
}

async function downloadZipFromUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download ZIP from ${url}: ${resp.status}`);
  }
  const buf = await resp.arrayBuffer();
  if (buf.byteLength === 0) {
    throw new Error(`ZIP URL returned empty body: ${url}`);
  }
  return base64FromArrayBuffer(buf);
}

async function pollForResult(jobId: string): Promise<{ base64Zip?: string; error?: string }> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    console.log(`Polling status for job ${jobId}...`);
    
    try {
      const statusUrl = `${CODEX_STATUS_URL}?jobId=${encodeURIComponent(jobId)}`;
      const resp = await fetch(statusUrl, { method: "GET" });
      
      if (!resp.ok) {
        // Якщо 404 - можливо endpoint не існує, спробуємо POST
        if (resp.status === 404) {
          const postResp = await fetch(CODEX_STATUS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });
          if (postResp.ok) {
            const data = await postResp.json();
            const extracted = await tryExtractFromJson(data);
            
            if (extracted.status === "completed" || extracted.status === "done" || extracted.status === "ready") {
              if (extracted.base64Zip) {
                return { base64Zip: extracted.base64Zip };
              }
              if (extracted.url) {
                const zip = await downloadZipFromUrl(extracted.url);
                return { base64Zip: zip };
              }
            }
            
            if (extracted.status === "failed" || extracted.status === "error") {
              return { error: "Codex generation failed" };
            }
          }
        }
        // Інакше чекаємо і пробуємо знову
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      const contentType = resp.headers.get("content-type") || "";
      
      // Якщо бінарний ZIP - готово
      if (contentType.includes("application/zip") || contentType.includes("application/octet-stream")) {
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > 0) {
          return { base64Zip: base64FromArrayBuffer(buf) };
        }
      }

      // JSON відповідь
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        const extracted = await tryExtractFromJson(data);

        if (extracted.status === "completed" || extracted.status === "done" || extracted.status === "ready") {
          if (extracted.base64Zip) {
            return { base64Zip: extracted.base64Zip };
          }
          if (extracted.url) {
            const zip = await downloadZipFromUrl(extracted.url);
            return { base64Zip: zip };
          }
          // Статус готовий але ZIP немає - чекаємо ще
        }

        if (extracted.status === "failed" || extracted.status === "error") {
          return { error: "Codex generation failed on remote server" };
        }

        // pending/processing - чекаємо
        console.log(`Job ${jobId} status: ${extracted.status || "unknown"}, waiting...`);
      }

    } catch (e) {
      console.error(`Poll error for job ${jobId}:`, e);
      // Продовжуємо polling при помилках мережі
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  return { error: "Codex generation timed out after 10 minutes" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Starting async Codex generation for:", body?.siteName);

    // 1. Відправляємо запит на старт генерації
    const startResp = await fetch(CODEX_START_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Якщо таймаут або помилка на старті
    if (!startResp.ok) {
      const errText = await startResp.text().catch(() => "");
      
      if (startResp.status === 524 || errText.includes("timeout") || errText.includes("524")) {
        return jsonError(504, "Codex webhook timeout on start", {
          hint: "n8n має одразу повертати jobId, а генерацію запускати асинхронно",
        });
      }
      
      return jsonError(startResp.status, errText.slice(0, 500) || `HTTP ${startResp.status}`);
    }

    const contentType = startResp.headers.get("content-type") || "";
    const rawBuf = await startResp.arrayBuffer();

    // Якщо одразу прийшов ZIP (синхронний режим)
    if (contentType.includes("application/zip") || contentType.includes("application/octet-stream")) {
      if (rawBuf.byteLength > 0) {
        console.log("Received ZIP directly (sync mode), size:", rawBuf.byteLength);
        return new Response(base64FromArrayBuffer(rawBuf), {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
    }

    // Парсимо JSON відповідь
    const text = new TextDecoder().decode(rawBuf);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      if (rawBuf.byteLength === 0) {
        return jsonError(502, "Codex webhook returned empty body", {
          hint: "n8n має повертати або ZIP одразу, або {jobId: '...'} для async режиму",
        });
      }
      // Можливо це base64 ZIP напряму
      if (text.length > 100 && !text.startsWith("{") && !text.startsWith("<")) {
        console.log("Received raw base64 ZIP, length:", text.length);
        return new Response(text.trim(), {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      return jsonError(502, "Invalid response from Codex webhook", { sample: text.slice(0, 200) });
    }

    const extracted = await tryExtractFromJson(payload);

    // Якщо є ZIP в JSON
    if (extracted.base64Zip) {
      console.log("Received base64 ZIP in JSON response");
      return new Response(extracted.base64Zip, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (extracted.url) {
      console.log("Received URL to ZIP:", extracted.url);
      const zip = await downloadZipFromUrl(extracted.url);
      return new Response(zip, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // Якщо є jobId - переходимо в async режим з polling
    if (extracted.jobId) {
      console.log("Got jobId, starting polling:", extracted.jobId);
      
      const result = await pollForResult(extracted.jobId);
      
      if (result.error) {
        return jsonError(502, result.error);
      }
      
      if (result.base64Zip) {
        console.log("Async generation completed, ZIP received");
        return new Response(result.base64Zip, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      
      return jsonError(502, "Async generation completed but no ZIP received");
    }

    // Нічого корисного не отримали
    return jsonError(502, "Codex webhook response missing jobId and ZIP data", {
      keys: Object.keys((payload as Record<string, unknown>) ?? {}).slice(0, 20),
      hint: "n8n має повертати {jobId: '...'} або ZIP безпосередньо",
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Codex proxy error:", msg);
    return jsonError(500, msg);
  }
});
