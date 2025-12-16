import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODEX_WEBHOOK_URL = "https://tryred.app.n8n.cloud/webhook/964e523f-9fd0-4462-99fd-3c94bb6d37af";

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

async function tryExtractZipFromJson(payload: unknown): Promise<{ base64Zip?: string; url?: string }> {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;

  // Common shapes we might get from n8n
  const candidates = [
    obj.base64Zip,
    obj.zipBase64,
    obj.zip_data,
    obj.zipData,
    obj.data,
    obj.body,
    obj.result,
    obj.file,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      // could be base64 or URL
      if (/^https?:\/\//i.test(c.trim())) return { url: c.trim() };
      return { base64Zip: c.trim() };
    }
  }

  // Sometimes data is nested
  if (obj.data && typeof obj.data === "object") {
    const nested = await tryExtractZipFromJson(obj.data);
    if (nested.base64Zip || nested.url) return nested;
  }

  return {};
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Proxying request to Codex webhook:", body?.siteName);

    // Try POST first (preferred)
    let response = await fetch(CODEX_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Some n8n webhooks are configured as GET-only; auto-fallback to GET on that specific 404
    if (!response.ok && response.status === 404) {
      const maybeText = await response.text().catch(() => "");
      const looksLikeMethodMismatch =
        maybeText.includes("not registered for POST") || maybeText.includes("GET request");

      if (looksLikeMethodMismatch) {
        const url = new URL(CODEX_WEBHOOK_URL);
        url.searchParams.set("prompt", body.prompt || "");
        url.searchParams.set("language", body.language || "");
        url.searchParams.set("websiteType", body.websiteType || "");
        url.searchParams.set("layoutStyle", body.layoutStyle || "");
        url.searchParams.set("siteName", body.siteName || "");
        url.searchParams.set("userId", body.userId || "");

        console.log("Webhook is GET-only, retrying with GET...");
        response = await fetch(url.toString(), { method: "GET" });
      } else {
        // Put text back into error handling flow below
        response = new Response(maybeText, { status: 404, headers: response.headers });
      }
    }

    if (!response.ok) {
      const errorTextRaw = await response.text().catch(() => "");
      const errorText = (errorTextRaw || "").trim();

      // n8n cloud is behind Cloudflare and can return 524 (timeout) with an HTML body.
      // Don't pass through the full HTML; return a short, actionable JSON error instead.
      if (response.status === 524 || errorText.includes("Error code 524") || errorText.includes("A timeout occurred")) {
        console.error("Codex webhook timeout (524)");
        return jsonError(504, "Codex webhook timeout", {
          status: response.status,
          hint: "Сервис Codex не успел ответить. Ускорь workflow (меньше шагов/меньше генерации в одном запросе) или сделай async-режим (сначала jobId, потом отдельный endpoint для скачивания ZIP).",
        });
      }

      const preview = errorText ? errorText.slice(0, 800) : `HTTP ${response.status}`;
      console.error("Codex webhook error:", response.status, preview);
      return jsonError(response.status, preview || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const status = response.status;

    // If the webhook returns 204/202 with empty body, it means n8n is not responding with the ZIP
    const raw = await response.arrayBuffer();

    if (raw.byteLength === 0) {
      console.error("Codex webhook returned empty body", { status, contentType });
      return jsonError(502, "Codex webhook returned empty response body", {
        status,
        contentType,
        hint:
          "n8n должен отвечать ZIP (binary) прямо в HTTP-ответе. Проверь, что в workflow есть 'Respond to Webhook' и он возвращает бинарный ZIP, а не запускает процесс асинхронно.",
      });
    }

    // If response is JSON, try to extract base64 or URL to ZIP
    if (contentType.includes("application/json") || contentType.includes("text/json")) {
      const text = new TextDecoder().decode(raw);
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        return jsonError(502, "Webhook responded with JSON content-type but invalid JSON", {
          status,
          contentType,
          sample: text.slice(0, 500),
        });
      }

      const extracted = await tryExtractZipFromJson(payload);

      if (extracted.url) {
        console.log("Webhook returned URL to ZIP, downloading...", extracted.url);
        const zipResp = await fetch(extracted.url);
        if (!zipResp.ok) {
          const t = await zipResp.text().catch(() => "");
          return jsonError(502, "Failed to download ZIP from provided URL", {
            url: extracted.url,
            status: zipResp.status,
            body: t.slice(0, 500),
          });
        }
        const zipBuf = await zipResp.arrayBuffer();
        if (zipBuf.byteLength === 0) {
          return jsonError(502, "ZIP URL returned empty body", { url: extracted.url });
        }
        const base64Zip = base64FromArrayBuffer(zipBuf);
        console.log("Received ZIP from URL, size:", zipBuf.byteLength, "bytes");
        return new Response(base64Zip, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      if (extracted.base64Zip) {
        console.log("Webhook returned base64 ZIP in JSON, length:", extracted.base64Zip.length);
        return new Response(extracted.base64Zip, {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      return jsonError(502, "Webhook JSON response did not contain ZIP data", {
        status,
        contentType,
        keys: Object.keys((payload as Record<string, unknown>) ?? {}).slice(0, 30),
      });
    }

    // Otherwise treat as binary ZIP
    const base64Zip = base64FromArrayBuffer(raw);
    console.log("Received ZIP from Codex, size:", raw.byteLength, "bytes", { status, contentType });

    return new Response(base64Zip, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Codex proxy error:", errorMessage);
    return jsonError(500, errorMessage);
  }
});

