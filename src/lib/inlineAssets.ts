import type { GeneratedFile } from "@/lib/websiteGenerator";

function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/^\.+\//, "")
    .replace(/^\//, "")
    .replace(/[#?].*$/, "");
}

function guessMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function findAssetFile(files: GeneratedFile[], src: string): GeneratedFile | null {
  const normalized = normalizePath(src);
  if (!normalized) return null;

  // Fast path: exact match
  const exact = files.find((f) => normalizePath(f.path) === normalized);
  if (exact) return exact;

  // Common folder prefixes
  const candidates = [
    `assets/${normalized}`,
    `images/${normalized}`,
    `img/${normalized}`,
    `icons/${normalized}`,
    `static/${normalized}`,
  ];
  for (const c of candidates) {
    const match = files.find((f) => normalizePath(f.path) === normalizePath(c));
    if (match) return match;
  }

  // Fuzzy match by suffix (best-effort)
  const suffix = "/" + normalized;
  return files.find((f) => normalizePath(f.path).endsWith(suffix)) || null;
}

/**
 * Inlines local <img src="..."> references when the asset exists in `files`.
 * Today we reliably inline SVGs (text-based), which fixes "icons instead of images" in preview.
 */
export function inlineLocalImages(html: string, files: GeneratedFile[]): string {
  if (!html || files.length === 0) return html;

  return html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
    (_m, before: string, rawSrc: string, after: string) => {
      const src = rawSrc.trim();
      if (
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("data:") ||
        src.startsWith("blob:")
      ) {
        return before + rawSrc + after;
      }

      const asset = findAssetFile(files, src);
      if (!asset) return before + rawSrc + after;

      const mime = guessMimeType(asset.path);

      // SVGs are safe to inline from our current storage (string)
      if (mime === "image/svg+xml") {
        const encoded = encodeURIComponent(asset.content)
          .replace(/%0A/g, "")
          .replace(/%0D/g, "");
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
        return before + dataUrl + after;
      }

      // For binary formats (png/jpg/...) we can't guarantee correct bytes because
      // files are currently stored as strings. So we leave them as-is.
      return before + rawSrc + after;
    }
  );
}
