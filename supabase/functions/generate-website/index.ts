import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ ZIP ASSET BUNDLING (EXTERNAL IMAGES -> LOCAL FILES) ============
// When generating HTML websites, we bundle external images (Picsum/Pexels) into the ZIP as real files
// so the downloaded site works without hotlinking.
//
// NOTE: We only inject images into the ZIP. We don't persist image binaries into `files_data`.

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getExtFromContentType(contentType: string | null): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("image/jpeg")) return "jpg";
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/webp")) return "webp";
  if (ct.includes("image/svg")) return "svg";
  if (ct.includes("image/gif")) return "gif";
  return "jpg";
}

function getExtFromUrl(url: string): string | null {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "svg", "gif"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return null;
}

function isBundlableExternalImageUrl(url: string): boolean {
  return (
    /^https?:\/\/picsum\.photos\//i.test(url) ||
    /^https?:\/\/images\.pexels\.com\//i.test(url)
  );
}

function extractExternalImageUrlsFromText(text: string): string[] {
  const urls = new Set<string>();
  const genericUrlRegex = /https?:\/\/[^\s"'()<>]+/g;
  const matches = text.match(genericUrlRegex) || [];
  for (const u of matches) {
    if (!isBundlableExternalImageUrl(u)) continue;
    urls.add(u);
  }
  return [...urls];
}

async function downloadImageAsBase64(url: string): Promise<{ base64: string; ext: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "LovableSiteGenerator/1.0" },
    });
    if (!res.ok) {
      console.log(`[ZIP] Failed to fetch image ${url} -> ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type");
    const ext = getExtFromUrl(url) || getExtFromContentType(contentType);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) return null;

    const base64 = uint8ToBase64(buf);
    return { base64, ext };
  } catch (e) {
    const err = e as { message?: string };
    console.log(`[ZIP] Error downloading image ${url}: ${err?.message || String(e)}`);
    return null;
  }
}

async function bundleExternalImagesForZip(
  files: Array<{ path: string; content: string }>
): Promise<{
  textFiles: Array<{ path: string; content: string }>;
  binaryFiles: Array<{ path: string; base64: string }>;
  replacedCount: number;
  downloadedCount: number;
}> {
  const candidateUrls = new Set<string>();
  for (const f of files) {
    if (!/\.(html?|css)$/i.test(f.path)) continue;
    for (const u of extractExternalImageUrlsFromText(f.content)) candidateUrls.add(u);
  }

  if (candidateUrls.size === 0) {
    return { textFiles: files, binaryFiles: [], replacedCount: 0, downloadedCount: 0 };
  }

  const urls = [...candidateUrls];
  const binaryFiles: Array<{ path: string; base64: string }> = [];
  const urlToLocalPath = new Map<string, string>();

  const concurrency = 6;
  let idx = 0;
  let downloadedCount = 0;

  async function worker() {
    while (idx < urls.length) {
      const my = idx++;
      const url = urls[my];

      const dl = await downloadImageAsBase64(url);
      if (!dl) continue;

      const name = `img-${hashString(url)}`;
      const localPath = `assets/${name}.${dl.ext}`;
      urlToLocalPath.set(url, localPath);
      binaryFiles.push({ path: localPath, base64: dl.base64 });
      downloadedCount++;
    }
  }

  await Promise.all(new Array(concurrency).fill(0).map(() => worker()));

  if (binaryFiles.length === 0) {
    return { textFiles: files, binaryFiles: [], replacedCount: 0, downloadedCount: 0 };
  }

  let replacedCount = 0;
  const textFiles = files.map((f) => {
    if (!/\.(html?|css)$/i.test(f.path)) return f;

    let content = f.content;
    for (const [url, localPath] of urlToLocalPath.entries()) {
      if (content.includes(url)) {
        content = content.split(url).join(localPath);
        replacedCount++;
      }
    }
    return content === f.content ? f : { ...f, content };
  });

  return { textFiles, binaryFiles, replacedCount, downloadedCount };
}

// ============ PHONE NUMBER VALIDATION & FIXING ============
// Patterns that indicate fake/placeholder phone numbers
const INVALID_PHONE_PATTERNS = [
  /\b\d{3}[-.\s]?\d{4}\b(?!\d)/g,  // Just 7 digits like 456-7890 or 4567890
  /\b\(?555\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi, // 555-xxx-xxxx (classic US fake)
  /\b123[-.\s]?456[-.\s]?7890\b/g,  // 123-456-7890
  /\b0{6,}\b/g,  // 000000...
  /\b9{6,}\b/g,  // 999999...
  /\b1{6,}\b/g,  // 111111...
  /\bXXX[-.\s]?XXX[-.\s]?XXXX\b/gi,  // XXX-XXX-XXXX placeholder
];

// Check if a phone number is valid (has country code, enough digits)
function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Must start with + and have at least 10 digits total
  if (!cleaned.startsWith('+')) return false;
  
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 10) return false;
  
  // Check for DUPLICATE country codes (e.g., +353+353, +49+49, etc.)
  // This catches patterns like "+353 +353 1 234 5678" or "+49 +49 30 1234"
  if (/\+\d+.*\+\d+/.test(phone)) return false; // Multiple + signs = duplicate codes
  
  // Check for repeated country code at start of digits (e.g., 353353..., 4949...)
  // Common codes: 1-3 digits. If first 2-3 digits repeat immediately, it's likely duplicate
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  for (let codeLen = 1; codeLen <= 3; codeLen++) {
    const potentialCode = digitsOnly.substring(0, codeLen);
    const afterCode = digitsOnly.substring(codeLen);
    if (afterCode.startsWith(potentialCode) && potentialCode.length >= 1) {
      // Could be false positive for valid numbers, so be careful
      // Only flag if the duplicate is at the very start
      const doubleCode = potentialCode + potentialCode;
      if (digitsOnly.startsWith(doubleCode)) {
        return false; // Likely duplicate country code
      }
    }
  }
  
  // Check for placeholder patterns
  if (/^(\d)\1{6,}$/.test(digits)) return false; // All same digit
  if (/123456|654321|4567890|7654321/.test(digits)) return false; // Sequential
  if (/555\d{7}/.test(digits)) return false; // 555 area code (fake)
  
  return true;
}

// Generate a realistic phone number based on geo/country hint
function generateRealisticPhone(geo?: string): string {
  const geoLower = (geo || '').toLowerCase();
  const geoToken = geoLower.trim();

  const randomDigits = (count: number) => {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    if (/^(\d)\1+$/.test(result)) return randomDigits(count);
    return result;
  };

  const hasGeoCode = (code: string) => geoToken === code || new RegExp(`\\b${code}\\b`, 'i').test(geoLower);

  // Portugal +351
  if (geoLower.includes('portugal') || geoLower.includes('portugu') || geoLower.includes('португал') || hasGeoCode('pt')) {
    const areaCodes = ['21', '22', '23', '24', '25'];
    return `+351 ${areaCodes[Math.floor(Math.random() * areaCodes.length)]}${Math.floor(Math.random() * 10)} ${randomDigits(3)} ${randomDigits(3)}`;
  }

  // Germany +49
  if (geoLower.includes('germany') || geoLower.includes('deutschland') || geoLower.includes('німеч') || hasGeoCode('de')) {
    const areaCodes = ['30', '40', '69', '89', '221', '211', '351'];
    return `+49 ${areaCodes[Math.floor(Math.random() * areaCodes.length)]} ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Austria +43
  if (geoLower.includes('austria') || geoLower.includes('österreich') || geoLower.includes('австрі') || hasGeoCode('at')) {
    return `+43 1 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Switzerland +41
  if (geoLower.includes('switzerland') || geoLower.includes('schweiz') || geoLower.includes('швейцар') || hasGeoCode('ch')) {
    return `+41 44 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // UK +44
  if (geoLower.includes('united kingdom') || geoLower.includes('britain') || geoLower.includes('england') || geoLower.includes('великобритан') || hasGeoCode('uk') || hasGeoCode('gb')) {
    return `+44 20 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // France +33
  if (geoLower.includes('france') || geoLower.includes('франц') || hasGeoCode('fr')) {
    return `+33 1 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Spain +34
  if (geoLower.includes('spain') || geoLower.includes('españa') || geoLower.includes('іспан') || hasGeoCode('es')) {
    return `+34 91 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Italy +39
  if (geoLower.includes('italy') || geoLower.includes('italia') || geoLower.includes('італ') || hasGeoCode('it')) {
    return `+39 06 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Netherlands +31
  if (geoLower.includes('netherlands') || geoLower.includes('nederland') || geoLower.includes('нідерланд') || hasGeoCode('nl')) {
    return `+31 20 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Poland +48
  if (geoLower.includes('poland') || geoLower.includes('polska') || geoLower.includes('польщ') || hasGeoCode('pl')) {
    return `+48 22 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // USA +1
  if (geoLower.includes('united states') || geoLower.includes('america') || geoLower.includes('сша') || hasGeoCode('us')) {
    const areaCodes = ['212', '310', '415', '312', '617', '305', '404'];
    return `+1 (${areaCodes[Math.floor(Math.random() * areaCodes.length)]}) ${randomDigits(3)}-${randomDigits(4)}`;
  }

  // Canada +1
  if (geoLower.includes('canada') || geoLower.includes('канад') || hasGeoCode('ca')) {
    const areaCodes = ['416', '604', '514', '403', '613'];
    return `+1 (${areaCodes[Math.floor(Math.random() * areaCodes.length)]}) ${randomDigits(3)}-${randomDigits(4)}`;
  }

  // Ukraine +380
  if (geoLower.includes('ukrain') || geoLower.includes('україн') || hasGeoCode('ua')) {
    const areaCodes = ['44', '50', '66', '67', '68', '73', '93', '95', '96', '97', '98', '99'];
    return `+380 ${areaCodes[Math.floor(Math.random() * areaCodes.length)]} ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Ireland +353
  if (geoLower.includes('ireland') || geoLower.includes('éire') || geoLower.includes('ірланд') || hasGeoCode('ie')) {
    return `+353 1 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Czech Republic +420
  if (geoLower.includes('czech') || geoLower.includes('česk') || geoLower.includes('чехі') || hasGeoCode('cz')) {
    return `+420 2 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Bulgaria +359
  if (geoLower.includes('bulgaria') || geoLower.includes('българ') || geoLower.includes('болгар') || hasGeoCode('bg')) {
    return `+359 2 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Belgium +32
  if (geoLower.includes('belgium') || geoLower.includes('belgi') || geoLower.includes('бельгі') || hasGeoCode('be')) {
    return `+32 2 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Vietnam +84
  if (geoLower.includes('vietnam') || geoLower.includes('việt') || geoLower.includes("в'єтнам") || hasGeoCode('vn')) {
    return `+84 24 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Greece +30
  if (geoLower.includes('greece') || geoLower.includes('ελλ') || geoLower.includes('греці') || hasGeoCode('gr')) {
    return `+30 21 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Denmark +45
  if (geoLower.includes('denmark') || geoLower.includes('danmark') || geoLower.includes('данія') || geoLower.includes('дані') || hasGeoCode('dk')) {
    return `+45 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Estonia +372
  if (geoLower.includes('estonia') || geoLower.includes('eesti') || geoLower.includes('естоні') || hasGeoCode('ee')) {
    return `+372 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Indonesia +62
  if (geoLower.includes('indonesia') || geoLower.includes('індонез') || hasGeoCode('id')) {
    return `+62 21 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // India +91
  if (geoLower.includes('india') || geoLower.includes('індія') || geoLower.includes('інді') || hasGeoCode('in')) {
    return `+91 ${randomDigits(5)} ${randomDigits(5)}`;
  }

  // Latvia +371
  if (geoLower.includes('latvia') || geoLower.includes('latvij') || geoLower.includes('латві') || hasGeoCode('lv')) {
    return `+371 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Lithuania +370
  if (geoLower.includes('lithuania') || geoLower.includes('lietuv') || geoLower.includes('литв') || hasGeoCode('lt')) {
    return `+370 5 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // UAE +971
  if (geoLower.includes('emirates') || geoLower.includes('uae') || geoLower.includes('оае') || geoLower.includes('емірат') || hasGeoCode('ae')) {
    return `+971 4 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Russia +7
  if (geoLower.includes('russia') || geoLower.includes('росі') || geoLower.includes('росси') || hasGeoCode('ru')) {
    const areaCodes = ['495', '499', '812', '383', '343'];
    return `+7 ${areaCodes[Math.floor(Math.random() * areaCodes.length)]} ${randomDigits(3)}-${randomDigits(2)}-${randomDigits(2)}`;
  }

  // Romania +40
  if (geoLower.includes('romania') || geoLower.includes('român') || geoLower.includes('румуні') || hasGeoCode('ro')) {
    return `+40 21 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Slovakia +421
  if (geoLower.includes('slovakia') || geoLower.includes('slovensk') || geoLower.includes('словаччин') || hasGeoCode('sk')) {
    return `+421 2 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Slovenia +386
  if (geoLower.includes('slovenia') || geoLower.includes('slovenij') || geoLower.includes('словені') || hasGeoCode('si')) {
    return `+386 1 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Thailand +66
  if (geoLower.includes('thailand') || geoLower.includes('таїланд') || geoLower.includes('тайланд') || hasGeoCode('th')) {
    return `+66 2 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Turkey +90
  if (geoLower.includes('turkey') || geoLower.includes('türk') || geoLower.includes('туреч') || hasGeoCode('tr')) {
    return `+90 212 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Hungary +36
  if (geoLower.includes('hungary') || geoLower.includes('magyar') || geoLower.includes('угорщ') || hasGeoCode('hu')) {
    return `+36 1 ${randomDigits(3)} ${randomDigits(4)}`;
  }

  // Finland +358
  if (geoLower.includes('finland') || geoLower.includes('suomi') || geoLower.includes('фінлянд') || hasGeoCode('fi')) {
    return `+358 9 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Croatia +385
  if (geoLower.includes('croatia') || geoLower.includes('hrvat') || geoLower.includes('хорват') || hasGeoCode('hr')) {
    return `+385 1 ${randomDigits(4)} ${randomDigits(3)}`;
  }

  // Sweden +46
  if (geoLower.includes('sweden') || geoLower.includes('sverige') || geoLower.includes('швеці') || hasGeoCode('se')) {
    return `+46 8 ${randomDigits(3)} ${randomDigits(3)} ${randomDigits(2)}`;
  }

  // Norway +47
  if (geoLower.includes('norway') || geoLower.includes('norge') || geoLower.includes('норвег') || hasGeoCode('no')) {
    return `+47 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
  }

  // Japan +81
  if (geoLower.includes('japan') || geoLower.includes('日本') || geoLower.includes('японі') || hasGeoCode('jp')) {
    return `+81 3 ${randomDigits(4)} ${randomDigits(4)}`;
  }

  // Default: German format
  return `+49 30 ${randomDigits(3)} ${randomDigits(4)}`;
}

// Fix broken image URLs that contain phone numbers or other non-numeric "IDs" (AI hallucination issue)
// IMPORTANT: Use a guaranteed image host (picsum.photos) to avoid 404s from random Pexels IDs.
function fixBrokenImageUrls(content: string): { content: string; fixed: number } {
  let fixed = 0;
  let result = content;

  // Deterministic-ish seed so the same broken URL becomes a stable placeholder.
  const seedFrom = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return String(h || 1);
  };

  const picsumUrl = (seed: string, w = 1400, h = 900) =>
    `https://picsum.photos/seed/${seed}/${w}/${h}`;

  const replacementFor = (badUrl: string) => picsumUrl(seedFrom(badUrl));

  // 1) Replace any Pexels URL where the "photos/<id>/" segment is NOT purely numeric.
  // Example broken pattern:
  // https://images.pexels.com/photos/+49 30 410 9097/pexels-photo-+49 30 030 5065.jpeg?... 
  // NOTE: We intentionally DROP the querystring to avoid duplicated "?auto=...?..." chains.
  const BROKEN_PEXELS_ID_REGEX =
    /(https?:\/\/images\.pexels\.com\/photos\/)([^\/"'\s?]+|[^\/"']*\s[^\/"']*)(\/pexels-photo-)([^"']+)(\.(?:jpe?g|png|webp))(\?[^"']*)?/gi;
  result = result.replace(BROKEN_PEXELS_ID_REGEX, (m) => {
    fixed++;
    return replacementFor(m);
  });

  // 2) Attributes: src/data-src/poster that contain phone-like patterns (+XX, spaces, etc.)
  // We only touch known image hosts; then replace with a safe placeholder.
  const BROKEN_MEDIA_ATTR_REGEX =
    /(\b(?:src|data-src|poster)\s*=\s*["'])([^"']*(?:\+\d|\s{1,})[^"']*)(["'])/gi;
  result = result.replace(BROKEN_MEDIA_ATTR_REGEX, (m, p1, url, p3) => {
    const u = String(url);
    if (!/^https?:\/\//i.test(u)) return m;
    if (!/images\.pexels\.com|picsum\.photos|images\.unsplash\.com/i.test(u)) return m;
    fixed++;
    return `${p1}${replacementFor(u)}${p3}`;
  });

  // 3) srcset="..." with broken pexels URLs — simplify to a single valid candidate.
  const BROKEN_SRCSET_REGEX =
    /(\bsrcset\s*=\s*["'])([^"']*images\.pexels\.com\/photos\/[^"']*(?:\+\d|\s)[^"']*)(["'])/gi;
  result = result.replace(BROKEN_SRCSET_REGEX, (_m, p1, v, p3) => {
    fixed++;
    const u = replacementFor(String(v));
    return `${p1}${u} 1400w${p3}`;
  });

  // 4) CSS url(...) occurrences (inline styles or embedded CSS)
  const BROKEN_CSS_URL_REGEX =
    /(url\(\s*["']?)(https?:\/\/images\.pexels\.com\/photos\/[^)"']*(?:\+\d|\s)[^)"']*)(["']?\s*\))/gi;
  result = result.replace(BROKEN_CSS_URL_REGEX, (_m, p1, url, p3) => {
    fixed++;
    return `${p1}${replacementFor(String(url))}${p3}`;
  });

  return { content: result, fixed };
}

// Fix phone numbers in file content
function fixPhoneNumbersInContent(content: string, geo?: string): { content: string; fixed: number } {
  let fixed = 0;
  let result = content;
  
  // 0) FIRST: Fix broken image URLs that contain phone numbers
  const imgFix = fixBrokenImageUrls(result);
  result = imgFix.content;
  fixed += imgFix.fixed;

  // 1) Replace obvious placeholder patterns first
  for (const pattern of INVALID_PHONE_PATTERNS) {
    const matches = result.match(pattern);
    if (matches) {
      for (const match of matches) {
        const replacement = generateRealisticPhone(geo);
        result = result.replace(match, replacement);
        fixed++;
      }
    }
  }

  // 2) Fix tel: links (validate what is inside tel:)
  result = result.replace(/href=["']tel:([^"']+)["']/gi, (match, phone) => {
    if (!isValidPhone(String(phone))) {
      const newPhone = generateRealisticPhone(geo);
      fixed++;
      // tel: should be digits-only (+ + digits)
      const tel = newPhone.replace(/[^\d+]/g, "");
      return `href="tel:${tel}"`;
    }
    return match;
  });

  // 3) Fix any visible phone-like strings with a leading + (covers "+49 ... 4567890", etc.)
  // BUT SKIP if it is part of an URL (img src/srcset/CSS url(...) etc.)
  const PLUS_PHONE_REGEX = /\+\d[\d\s().-]{7,}\d/g;
  result = result.replace(PLUS_PHONE_REGEX, (match, offset) => {
    const before = result.substring(Math.max(0, offset - 120), offset);

    // Skip common URL/attribute contexts (images/CSS)
    if (/src=["'][^"']*$/i.test(before)) return match;
    if (/srcset=["'][^"']*$/i.test(before)) return match;
    if (/data-src=["'][^"']*$/i.test(before)) return match;
    if (/poster=["'][^"']*$/i.test(before)) return match;
    if (/href=["'][^"']*$/i.test(before)) return match;
    if (/url\(\s*["']?[^"')]*$/i.test(before)) return match;
    if (/https?:\/\/[^\s"']*$/i.test(before)) return match;

    if (!isValidPhone(match)) {
      fixed++;
      return generateRealisticPhone(geo);
    }
    return match;
  });

  // 4) Fix bare local phone-like sequences ONLY when near phone/contact labels
  const CONTEXTUAL_BARE_PHONE_REGEX = /(phone|tel|telephone|call|contact|контакт|телефон|тел\.?)[^\n\r]{0,25}\b(\d{8,12})\b/gi;
  result = result.replace(CONTEXTUAL_BARE_PHONE_REGEX, (fullMatch, _label, digits) => {
    fixed++;
    return String(fullMatch).replace(String(digits), generateRealisticPhone(geo));
  });

  return { content: result, fixed };
}

// Process all files and fix phone numbers
function fixPhoneNumbersInFiles(files: Array<{ path: string; content: string }>, geo?: string): { files: Array<{ path: string; content: string }>; totalFixed: number } {
  let totalFixed = 0;
  
  const fixedFiles = files.map(file => {
    // Only process HTML, PHP, JS files (not CSS, images, etc.)
    if (!/\.(html?|php|jsx?|tsx?)$/i.test(file.path)) {
      return file;
    }
    
    const { content, fixed } = fixPhoneNumbersInContent(file.content, geo);
    totalFixed += fixed;
    
    return { ...file, content };
  });
  
  return { files: fixedFiles, totalFixed };
}

// Extract explicit SITE NAME / PHONE from VIP prompt (or other structured prompts)
function extractExplicitBrandingFromPrompt(prompt: string): { siteName?: string; phone?: string } {
  const out: { siteName?: string; phone?: string } = {};

  // VIP prompt format: "Name: ..." / "Phone: ..."
  const nameMatch = prompt.match(/^(?:Name|SITE_NAME)\s*:\s*(.+)$/mi);
  if (nameMatch?.[1]) out.siteName = nameMatch[1].trim();

  const phoneMatch = prompt.match(/^(?:Phone|PHONE)\s*:\s*(.+)$/mi);
  if (phoneMatch?.[1]) out.phone = phoneMatch[1].trim();

  // Fallback: CONTACT block: "- phone: ..."
  if (!out.phone) {
    const phoneMatch2 = prompt.match(/^\s*-\s*phone\s*:\s*(.+)$/mi);
    if (phoneMatch2?.[1]) out.phone = phoneMatch2[1].trim();
  }

  return out;
}

function enforcePhoneInFiles(
  files: Array<{ path: string; content: string }>,
  desiredPhoneRaw: string | undefined
): Array<{ path: string; content: string }> {
  if (!desiredPhoneRaw) return files;

  const desiredPhone = desiredPhoneRaw.trim();
  const desiredTel = desiredPhone.replace(/[^\d+]/g, "");

  // Helper: strip attributes for phone scan (defined here for self-contained function)
  const stripAttrsForScan = (html: string): string => html
    .replace(/\bsrc=["'][^"']*["']/gi, 'src=""')
    .replace(/\bhref=["'](?!tel:)[^"']*["']/gi, 'href=""')
    .replace(/\bcontent=["'][^"']*["']/gi, 'content=""')
    .replace(/\bdata-[\w-]+=["'][^"']*["']/gi, 'data-x=""');

  return files.map((f) => {
    if (!/\.(html?|php|jsx?|tsx?)$/i.test(f.path)) return f;

    let content = f.content;

    // Check for existing phone presence BEFORE modifications - USE STRIPPED CONTENT!
    const hadTelLink = /href=["']tel:/i.test(content);
    const strippedContent = stripAttrsForScan(content);
    const hadPlusPhone = /\+\d[\d\s().-]{7,}\d/.test(strippedContent);
    const hadPhoneLabel = /(Phone|Tel|Telephone|Контакт|Телефон)\s*:/i.test(strippedContent);

    // Always enforce tel: links to match desired phone
    content = content.replace(/href=["']tel:([^"']+)["']/gi, () => `href="tel:${desiredTel}"`);

    // Replace visible international phone patterns with desired phone
    // (Skip if inside src/srcset/href/content/data-*/CSS url(...) or other URL contexts)
    content = content.replace(/\+\d[\d\s().-]{7,}\d/g, (match, offset) => {
      const before = content.substring(Math.max(0, offset - 140), offset);
      if (/src=["'][^"']*$/i.test(before)) return match;
      if (/srcset=["'][^"']*$/i.test(before)) return match;
      if (/data-src=["'][^"']*$/i.test(before)) return match;
      if (/poster=["'][^"']*$/i.test(before)) return match;
      if (/href=["'](?!tel:)[^"']*$/i.test(before)) return match;
      if (/content=["'][^"']*$/i.test(before)) return match;
      if (/data-[\w-]+=["'][^"']*$/i.test(before)) return match;
      if (/url\(\s*["']?[^"')]*$/i.test(before)) return match;
      if (/https?:\/\/[^\s"']*$/i.test(before)) return match;
      return desiredPhone;
    });

    // Replace common contextual "Phone:" labels
    content = content.replace(
      /(Phone|Tel|Telephone|Контакт|Телефон)\s*:\s*[^<\n\r]{6,}/gi,
      (m) => {
        const label = m.split(":")[0];
        return `${label}: ${desiredPhone}`;
      }
    );

    // If the site originally contained no phone at all, inject one (HTML/PHP only)
    if (!hadTelLink && !hadPlusPhone && !hadPhoneLabel && /\.(html?|php)$/i.test(f.path)) {
      console.log(`📞 [enforcePhoneInFiles] Injecting phone into ${f.path} - no existing phone detected`);
      const phoneLink = `<a href="tel:${desiredTel}" class="contact-phone-link">${desiredPhone}</a>`;
      const phoneBlock = `\n<div class="contact-phone" style="margin-top:12px">${phoneLink}</div>\n`;

      // 1) Prefer inserting into an existing contact section
      if (/<section[^>]*id=["']contact["'][^>]*>/i.test(content)) {
        content = content.replace(
          /(<section[^>]*id=["']contact["'][^>]*>)/i,
          `$1${phoneBlock}`
        );
      }

      // 2) Insert into footer if present
      if (/<footer\b[\s\S]*?<\/footer>/i.test(content)) {
        content = content.replace(/<\/footer>/i, `${phoneBlock}</footer>`);
      } else if (/<\/body>/i.test(content)) {
        // 3) Fallback: create a minimal footer
        content = content.replace(
          /<\/body>/i,
          `\n<footer style="padding:24px 16px">${phoneBlock}</footer>\n</body>`
        );
      } else {
        // 4) Last resort: append
        content += phoneBlock;
      }
    }

    return { ...f, content };
  });
}

// ============ BUSINESS HOURS ENFORCEMENT ============
// Ensure all pages have business hours in footer
function enforceBusinessHoursInFiles(
  files: Array<{ path: string; content: string }>,
  language: string = "en"
): Array<{ path: string; content: string }> {
  // Business hours translations
  const hoursTranslations: Record<string, { label: string; weekdays: string; weekend: string }> = {
    "en": { label: "Working Hours:", weekdays: "Monday - Friday: 9:00 AM - 6:00 PM", weekend: "Saturday - Sunday: Closed" },
    "de": { label: "Öffnungszeiten:", weekdays: "Montag - Freitag: 9:00 - 18:00", weekend: "Samstag - Sonntag: Geschlossen" },
    "fr": { label: "Heures d'ouverture:", weekdays: "Lundi - Vendredi: 9h00 - 18h00", weekend: "Samedi - Dimanche: Fermé" },
    "es": { label: "Horario:", weekdays: "Lunes - Viernes: 9:00 - 18:00", weekend: "Sábado - Domingo: Cerrado" },
    "it": { label: "Orario di lavoro:", weekdays: "Lunedì - Venerdì: 9:00 - 18:00", weekend: "Sabato - Domenica: Chiuso" },
    "pt": { label: "Horário de funcionamento:", weekdays: "Segunda - Sexta: 9:00 - 18:00", weekend: "Sábado - Domingo: Fechado" },
    "nl": { label: "Openingstijden:", weekdays: "Maandag - Vrijdag: 9:00 - 18:00", weekend: "Zaterdag - Zondag: Gesloten" },
    "pl": { label: "Godziny pracy:", weekdays: "Poniedziałek - Piątek: 9:00 - 18:00", weekend: "Sobota - Niedziela: Nieczynne" },
    "uk": { label: "Години роботи:", weekdays: "Понеділок - П'ятниця: 9:00 - 18:00", weekend: "Субота - Неділя: Зачинено" },
    "ru": { label: "Часы работы:", weekdays: "Понедельник - Пятница: 9:00 - 18:00", weekend: "Суббота - Воскресенье: Закрыто" },
    "ro": { label: "Program de lucru:", weekdays: "Luni - Vineri: 9:00 - 18:00", weekend: "Sâmbătă - Duminică: Închis" },
    "cs": { label: "Otevírací doba:", weekdays: "Pondělí - Pátek: 9:00 - 18:00", weekend: "Sobota - Neděle: Zavřeno" },
    "sk": { label: "Otváracie hodiny:", weekdays: "Pondelok - Piatok: 9:00 - 18:00", weekend: "Sobota - Nedeľa: Zatvorené" },
    "hu": { label: "Nyitvatartás:", weekdays: "Hétfő - Péntek: 9:00 - 18:00", weekend: "Szombat - Vasárnap: Zárva" },
    "bg": { label: "Работно време:", weekdays: "Понеделник - Петък: 9:00 - 18:00", weekend: "Събота - Неделя: Затворено" },
    "hr": { label: "Radno vrijeme:", weekdays: "Ponedjeljak - Petak: 9:00 - 18:00", weekend: "Subota - Nedjelja: Zatvoreno" },
    "sl": { label: "Delovni čas:", weekdays: "Ponedeljek - Petek: 9:00 - 18:00", weekend: "Sobota - Nedelja: Zaprto" },
    "da": { label: "Åbningstider:", weekdays: "Mandag - Fredag: 9:00 - 18:00", weekend: "Lørdag - Søndag: Lukket" },
    "sv": { label: "Öppettider:", weekdays: "Måndag - Fredag: 9:00 - 18:00", weekend: "Lördag - Söndag: Stängt" },
    "no": { label: "Åpningstider:", weekdays: "Mandag - Fredag: 9:00 - 18:00", weekend: "Lørdag - Søndag: Stengt" },
    "fi": { label: "Aukioloajat:", weekdays: "Maanantai - Perjantai: 9:00 - 18:00", weekend: "Lauantai - Sunnuntai: Suljettu" },
    "el": { label: "Ώρες λειτουργίας:", weekdays: "Δευτέρα - Παρασκευή: 9:00 - 18:00", weekend: "Σάββατο - Κυριακή: Κλειστά" },
    "tr": { label: "Çalışma Saatleri:", weekdays: "Pazartesi - Cuma: 9:00 - 18:00", weekend: "Cumartesi - Pazar: Kapalı" },
  };

  const langCode = (language || "en").toLowerCase().substring(0, 2);
  const hours = hoursTranslations[langCode] || hoursTranslations["en"];

  // Pattern to detect if hours are already present
  const hoursPatterns = [
    /Monday\s*-\s*Friday.*?(?:AM|PM)/i,
    /Mon\s*-\s*Fri/i,
    /Montag\s*-\s*Freitag/i,
    /Lundi\s*-\s*Vendredi/i,
    /Lunes\s*-\s*Viernes/i,
    /Понеділок\s*-\s*П'ятниця/i,
    /Понедельник\s*-\s*Пятница/i,
    /Working Hours/i,
    /Business Hours/i,
    /Opening Hours/i,
    /Öffnungszeiten/i,
    /Heures d'ouverture/i,
    /Horario/i,
    /Години роботи/i,
    /Часы работы/i,
    /9:00\s*(?:AM|-)?\s*(?:6:00|18:00)/i,
  ];

  return files.map((f) => {
    if (!/\.(html?|php)$/i.test(f.path)) return f;

    let content = f.content;

    // Check if hours already exist
    const hasHours = hoursPatterns.some(pattern => pattern.test(content));
    if (hasHours) {
      return f; // Already has hours, skip
    }

    console.log(`📅 [enforceBusinessHours] Injecting business hours into ${f.path}`);

    // Create hours HTML block
    const hoursHtml = `
        <div class="footer-hours" style="margin-top: 16px;">
          <strong>${hours.label}</strong><br>
          ${hours.weekdays}<br>
          ${hours.weekend}
        </div>`;

    // Try to inject into footer
    if (/<footer\b[^>]*>/i.test(content)) {
      // Find the last </div> before </footer> and inject there
      // Or inject right before the closing </footer>
      if (/class=["'][^"']*footer-bottom[^"']*["']/i.test(content)) {
        // Inject before footer-bottom
        content = content.replace(
          /(<div[^>]*class=["'][^"']*footer-bottom[^"']*["'][^>]*>)/i,
          `${hoursHtml}\n        $1`
        );
      } else if (/class=["'][^"']*footer-content[^"']*["']/i.test(content)) {
        // Inject at end of footer-content
        content = content.replace(
          /(<\/div>\s*<\/footer>)/i,
          `${hoursHtml}\n        $1`
        );
      } else {
        // Inject right before </footer>
        content = content.replace(
          /<\/footer>/i,
          `${hoursHtml}\n      </footer>`
        );
      }
    }

    return { ...f, content };
  });
}

function enforceSiteNameInFiles(
  files: Array<{ path: string; content: string }>,
  desiredSiteNameRaw: string | undefined
): Array<{ path: string; content: string }> {
  if (!desiredSiteNameRaw) return files;
  const desiredSiteName = desiredSiteNameRaw.trim();

  return files.map((f) => {
    if (!/\.(html?|php)$/i.test(f.path)) return f;

    let content = f.content;

    // Enforce <title>
    if (/<title>[^<]*<\/title>/i.test(content)) {
      content = content.replace(/<title>[\s\S]*?<\/title>/i, `<title>${desiredSiteName}</title>`);
    }

    // Enforce og:site_name where present
    content = content.replace(
      /<meta\s+property=["']og:site_name["']\s+content=["'][^"']*["']\s*\/?\s*>/i,
      `<meta property="og:site_name" content="${desiredSiteName}" />`
    );

    return { ...f, content };
  });
}

// ============ EMAIL ENFORCEMENT FROM SITE NAME ============
// Generate domain-based email from site name
// If site name looks like a domain (contains .com, .es, etc.) - use it directly
// Otherwise clean it and add .com: "My Company" -> info@mycompany.com
function generateEmailFromSiteName(siteName: string): string {
  const trimmed = siteName.trim();
  
  // Check if site name already looks like a domain (e.g., "example.com", "site.es")
  const domainMatch = trimmed.match(/^([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}$/i);
  if (domainMatch) {
    // It's already a domain, use it directly
    return `info@${trimmed.toLowerCase()}`;
  }
  
  // Check if site name contains a domain-like part at the end
  const containsDomainMatch = trimmed.match(/([a-z0-9][-a-z0-9]*\.[a-z]{2,})$/i);
  if (containsDomainMatch) {
    // Extract the domain part and use it
    return `info@${containsDomainMatch[1].toLowerCase()}`;
  }
  
  // Clean site name: lowercase, remove special chars, replace spaces/underscores/dashes with nothing
  const domain = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/gi, '') // Remove special chars except underscore/dash
    .replace(/[\s_-]+/g, '')         // Remove spaces, underscores, dashes
    .trim();
  
  return domain ? `info@${domain}.com` : 'info@example.com';
}

// Enforce email based on site name across all files
function enforceEmailInFiles(
  files: Array<{ path: string; content: string }>,
  desiredSiteNameRaw: string | undefined
): Array<{ path: string; content: string }> {
  if (!desiredSiteNameRaw) return files;
  
  const desiredEmail = generateEmailFromSiteName(desiredSiteNameRaw);
  console.log(`[enforceEmailInFiles] Generated email "${desiredEmail}" from site name "${desiredSiteNameRaw}"`);
  
  // Common placeholder/fake email patterns to replace
  const emailPatterns = [
    /info@example\.com/gi,
    /contact@example\.com/gi,
    /support@example\.com/gi,
    /info@company\.com/gi,
    /contact@company\.com/gi,
    /info@companyname\.com/gi,
    /contact@yoursite\.com/gi,
    /info@yoursite\.com/gi,
    /email@example\.com/gi,
    /test@example\.com/gi,
    /hello@example\.com/gi,
    /info@yourdomain\.com/gi,
    /contact@yourdomain\.com/gi,
    /info@placeholder\.com/gi,
  ];
  
  return files.map((f) => {
    if (!/\.(html?|php|jsx?|tsx?)$/i.test(f.path)) return f;
    
    let content = f.content;
    let replacedCount = 0;
    
    // Replace all placeholder emails with the generated one
    for (const pattern of emailPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        replacedCount += matches.length;
        content = content.replace(pattern, desiredEmail);
      }
    }
    
    // Also replace mailto: links with placeholder emails
    content = content.replace(
      /mailto:(info|contact|support|email|test|hello)@(example|company|companyname|yoursite|yourdomain|placeholder)\.com/gi,
      `mailto:${desiredEmail}`
    );
    
    if (replacedCount > 0) {
      console.log(`[enforceEmailInFiles] Replaced ${replacedCount} placeholder email(s) in ${f.path} with "${desiredEmail}"`);
    }
    
    return { ...f, content };
  });
}

// ============ CONTACT INFO & FOOTER LINK VALIDATION ============
// Validate and fix contact.html to ensure phone/email are present
function validateContactPage(
  files: Array<{ path: string; content: string }>,
  geo?: string
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  
  const contactFile = files.find(f => 
    /contact\.html?$/i.test(f.path) || 
    /kontakt\.html?$/i.test(f.path) ||
    /contacts?\.html?$/i.test(f.path)
  );
  
  if (!contactFile) {
    warnings.push("No contact.html found - skipping contact page validation");
    return { files, warnings };
  }
  
  let content = contactFile.content;
  let modified = false;
  
  // Check for phone number presence
  const hasPhone = /href=["']tel:/i.test(content) || /\+\d[\d\s().-]{7,}\d/.test(content);
  
  // Check for email presence
  const hasEmail = /href=["']mailto:/i.test(content) || /[\w.-]+@[\w.-]+\.\w{2,}/i.test(content);
  
  // If no phone, inject one
  if (!hasPhone) {
    warnings.push(`contact.html: No phone found - auto-injecting`);
    const phone = generateRealisticPhone(geo);
    const phoneHtml = `
    <div class="contact-info-phone" style="margin: 16px 0;">
      <strong>Phone:</strong> <a href="tel:${phone.replace(/[^\d+]/g, '')}" style="color: inherit;">${phone}</a>
    </div>`;
    
    // Try to inject after h1/h2 or at start of main/article/section
    if (/<(main|article|section)[^>]*>/i.test(content)) {
      content = content.replace(/(<(?:main|article|section)[^>]*>)/i, `$1${phoneHtml}`);
    } else if (/<body[^>]*>/i.test(content)) {
      content = content.replace(/(<body[^>]*>)/i, `$1${phoneHtml}`);
    } else {
      content = phoneHtml + content;
    }
    modified = true;
  }
  
  // If no email, inject one
  if (!hasEmail) {
    warnings.push(`contact.html: No email found - auto-injecting`);
    const email = "info@example.com"; // Placeholder - will be replaced if siteName exists
    const emailHtml = `
    <div class="contact-info-email" style="margin: 16px 0;">
      <strong>Email:</strong> <a href="mailto:${email}" style="color: inherit;">${email}</a>
    </div>`;
    
    if (/<(main|article|section)[^>]*>/i.test(content)) {
      content = content.replace(/(<(?:main|article|section)[^>]*>)/i, `$1${emailHtml}`);
    } else if (/<body[^>]*>/i.test(content)) {
      content = content.replace(/(<body[^>]*>)/i, `$1${emailHtml}`);
    } else {
      content = emailHtml + content;
    }
    modified = true;
  }
  
  if (!modified) {
    return { files, warnings };
  }
  
  const updatedFiles = files.map(f => 
    f.path === contactFile.path ? { ...f, content } : f
  );
  
  return { files: updatedFiles, warnings };
}

// Ensure footer in all pages has link to contact page
function ensureContactLinkInFooters(
  files: Array<{ path: string; content: string }>
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  
  // Find contact page path
  const contactFile = files.find(f => 
    /contact\.html?$/i.test(f.path) || 
    /kontakt\.html?$/i.test(f.path) ||
    /contacts?\.html?$/i.test(f.path)
  );
  
  if (!contactFile) {
    return { files, warnings }; // No contact page to link to
  }
  
  const contactPath = contactFile.path.replace(/^\.?\//, '');
  
  const updatedFiles = files.map(f => {
    // Only process HTML files
    if (!/\.html?$/i.test(f.path)) return f;
    
    // Skip the contact page itself
    if (f.path === contactFile.path) return f;
    
    let content = f.content;
    
    // Check if footer exists
    const hasFooter = /<footer\b/i.test(content);
    if (!hasFooter) return f;
    
    // Check if footer already has contact link
    const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
    if (!footerMatch) return f;
    
    const footerContent = footerMatch[0];
    
    // Check for existing contact link in footer
    const hasContactLink = 
      /href=["'][^"']*contact[^"']*["']/i.test(footerContent) ||
      /href=["'][^"']*kontakt[^"']*["']/i.test(footerContent);
    
    if (hasContactLink) return f;
    
    // Footer exists but no contact link - inject one
    warnings.push(`${f.path}: Added missing contact link to footer`);
    
    // Find the best place to add the contact link in footer
    // Prefer adding to existing nav/ul, otherwise add before </footer>
    
    const contactLinkHtml = `<a href="${contactPath}" class="footer-contact-link">Contact</a>`;
    
    // Try to find a nav or ul in footer
    if (/<footer[\s\S]*?<(nav|ul)\b[\s\S]*?<\/\1>/i.test(content)) {
      // Add to the first nav/ul in footer
      content = content.replace(
        /(<footer[\s\S]*?)(<\/(?:nav|ul)>)/i,
        `$1${contactLinkHtml} $2`
      );
    } else {
      // Just add before </footer>
      const contactBlock = `
      <div class="footer-contact-link-wrapper" style="margin-top: 12px;">
        ${contactLinkHtml}
      </div>`;
      content = content.replace(/<\/footer>/i, `${contactBlock}\n</footer>`);
    }
    
    return { ...f, content };
  });
  
  return { files: updatedFiles, warnings };
}

// Ensure footer in all pages has Privacy Policy and Terms links
function ensureLegalLinksInFooters(
  files: Array<{ path: string; content: string }>,
  language?: string
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  
  // Find privacy and terms pages
  const privacyFile = files.find(f => 
    /privac[yi][-_]?polic[yi]?\.html?$/i.test(f.path) ||
    /privacy\.html?$/i.test(f.path) ||
    /datenschutz\.html?$/i.test(f.path) ||
    /polityka[-_]?prywatnosci\.html?$/i.test(f.path)
  );
  
  const termsFile = files.find(f => 
    /terms[-_]?(?:of[-_]?(?:service|use))?\.html?$/i.test(f.path) ||
    /agb\.html?$/i.test(f.path) ||
    /regulamin\.html?$/i.test(f.path) ||
    /nutzungsbedingungen\.html?$/i.test(f.path)
  );
  
  // Determine link text based on language
  const langLower = (language || 'en').toLowerCase();
  let privacyText = 'Privacy Policy';
  let termsText = 'Terms of Service';
  
  if (langLower.includes('de')) {
    privacyText = 'Datenschutz';
    termsText = 'AGB';
  } else if (langLower.includes('pl')) {
    privacyText = 'Polityka Prywatności';
    termsText = 'Regulamin';
  } else if (langLower.includes('uk')) {
    privacyText = 'Політика конфіденційності';
    termsText = 'Умови використання';
  } else if (langLower.includes('ru')) {
    privacyText = 'Политика конфиденциальности';
    termsText = 'Условия использования';
  } else if (langLower.includes('fr')) {
    privacyText = 'Politique de confidentialité';
    termsText = 'Conditions d\'utilisation';
  } else if (langLower.includes('es')) {
    privacyText = 'Política de Privacidad';
    termsText = 'Términos de Servicio';
  } else if (langLower.includes('it')) {
    privacyText = 'Informativa sulla Privacy';
    termsText = 'Termini di Servizio';
  }
  
  const privacyPath = privacyFile?.path.replace(/^\.?\//, '') || 'privacy-policy.html';
  const termsPath = termsFile?.path.replace(/^\.?\//, '') || 'terms.html';
  
  const updatedFiles = files.map(f => {
    if (!/\.html?$/i.test(f.path)) return f;
    
    let content = f.content;
    
    const hasFooter = /<footer\b/i.test(content);
    if (!hasFooter) return f;
    
    const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
    if (!footerMatch) return f;
    
    const footerContent = footerMatch[0];
    
    // Check for existing privacy link
    const hasPrivacyLink = 
      /href=["'][^"']*privac[yi]/i.test(footerContent) ||
      /href=["'][^"']*datenschutz/i.test(footerContent) ||
      /href=["'][^"']*prywatno/i.test(footerContent);
    
    // Check for existing terms link
    const hasTermsLink = 
      /href=["'][^"']*terms/i.test(footerContent) ||
      /href=["'][^"']*agb/i.test(footerContent) ||
      /href=["'][^"']*regulamin/i.test(footerContent) ||
      /href=["'][^"']*nutzung/i.test(footerContent);
    
    let linksToAdd: string[] = [];
    
    if (!hasPrivacyLink) {
      warnings.push(`${f.path}: Added missing Privacy Policy link to footer`);
      linksToAdd.push(`<a href="${privacyPath}" class="footer-legal-link">${privacyText}</a>`);
    }
    
    if (!hasTermsLink) {
      warnings.push(`${f.path}: Added missing Terms link to footer`);
      linksToAdd.push(`<a href="${termsPath}" class="footer-legal-link">${termsText}</a>`);
    }
    
    if (linksToAdd.length === 0) return f;
    
    const linksHtml = linksToAdd.join(' | ');
    
    // Try to find a nav or ul in footer for legal links
    if (/<footer[\s\S]*?<(nav|ul)\b[\s\S]*?<\/\1>/i.test(content)) {
      content = content.replace(
        /(<footer[\s\S]*?)(<\/(?:nav|ul)>)/i,
        `$1${linksHtml} $2`
      );
    } else {
      const legalBlock = `
      <div class="footer-legal-links" style="margin-top: 12px; font-size: 0.875rem;">
        ${linksHtml}
      </div>`;
      content = content.replace(/<\/footer>/i, `${legalBlock}\n</footer>`);
    }
    
    return { ...f, content };
  });
  
  return { files: updatedFiles, warnings };
}

// Ensure Cookie Policy link and cookie banner in all pages
function ensureCookiePolicyAndBanner(
  files: Array<{ path: string; content: string }>,
  language?: string
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  
  // Find cookie policy page
  const cookiePolicyFile = files.find(f => 
    /cookie[-_]?polic[yi]?\.html?$/i.test(f.path) ||
    /cookies?\.html?$/i.test(f.path)
  );
  
  // Determine text based on language - EXTENDED for cookie settings modal
  const langLower = (language || 'en').toLowerCase();
  
  // Cookie texts object for all languages
  const cookieTexts: { [key: string]: {
    cookiePolicyText: string;
    cookieBannerText: string;
    acceptAllText: string;
    settingsText: string;
    saveSettingsText: string;
    declineAllText: string;
    learnMoreText: string;
    cookieSettingsTitle: string;
    cookieSettingsDesc: string;
    necessaryTitle: string;
    necessaryDesc: string;
    analyticsTitle: string;
    analyticsDesc: string;
    marketingTitle: string;
    marketingDesc: string;
    alwaysActive: string;
  }} = {
    en: {
      cookiePolicyText: 'Cookie Policy',
      cookieBannerText: 'We use cookies to enhance your experience. You can customize your preferences below.',
      acceptAllText: 'Accept All',
      settingsText: 'Cookie Settings',
      saveSettingsText: 'Save Settings',
      declineAllText: 'Decline All',
      learnMoreText: 'Learn more',
      cookieSettingsTitle: 'Cookie Settings',
      cookieSettingsDesc: 'Configure the types of cookies you allow on our site. Necessary cookies are required for the site to function.',
      necessaryTitle: 'Necessary Cookies',
      necessaryDesc: 'Provide basic site functionality. The site cannot function properly without these cookies.',
      analyticsTitle: 'Analytics Cookies',
      analyticsDesc: 'Help us understand how visitors interact with the site by collecting anonymous information.',
      marketingTitle: 'Marketing Cookies',
      marketingDesc: 'Used to track visitors across websites to display relevant advertisements.',
      alwaysActive: 'Always active'
    },
    de: {
      cookiePolicyText: 'Cookie-Richtlinie',
      cookieBannerText: 'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Sie können Ihre Einstellungen anpassen.',
      acceptAllText: 'Alle akzeptieren',
      settingsText: 'Cookie-Einstellungen',
      saveSettingsText: 'Einstellungen speichern',
      declineAllText: 'Alle ablehnen',
      learnMoreText: 'Mehr erfahren',
      cookieSettingsTitle: 'Cookie-Einstellungen',
      cookieSettingsDesc: 'Konfigurieren Sie die Arten von Cookies, die Sie auf unserer Website zulassen. Notwendige Cookies sind für die Funktion der Website erforderlich.',
      necessaryTitle: 'Notwendige Cookies',
      necessaryDesc: 'Ermöglichen grundlegende Website-Funktionen. Die Website kann ohne diese Cookies nicht ordnungsgemäß funktionieren.',
      analyticsTitle: 'Analyse-Cookies',
      analyticsDesc: 'Helfen uns zu verstehen, wie Besucher mit der Website interagieren, indem sie anonyme Informationen sammeln.',
      marketingTitle: 'Marketing-Cookies',
      marketingDesc: 'Werden verwendet, um Besucher auf Websites zu verfolgen und relevante Werbung anzuzeigen.',
      alwaysActive: 'Immer aktiv'
    },
    pl: {
      cookiePolicyText: 'Polityka Cookies',
      cookieBannerText: 'Używamy plików cookie, aby poprawić Twoje doświadczenia. Możesz dostosować swoje preferencje.',
      acceptAllText: 'Akceptuj wszystkie',
      settingsText: 'Ustawienia cookie',
      saveSettingsText: 'Zapisz ustawienia',
      declineAllText: 'Odrzuć wszystkie',
      learnMoreText: 'Dowiedz się więcej',
      cookieSettingsTitle: 'Ustawienia cookie',
      cookieSettingsDesc: 'Skonfiguruj rodzaje plików cookie, które zezwalasz na naszej stronie. Niezbędne pliki cookie są wymagane do funkcjonowania strony.',
      necessaryTitle: 'Niezbędne cookie',
      necessaryDesc: 'Zapewniają podstawową funkcjonalność strony. Strona nie może działać poprawnie bez tych plików.',
      analyticsTitle: 'Analityczne cookie',
      analyticsDesc: 'Pomagają nam zrozumieć, jak odwiedzający wchodzą w interakcję ze stroną, zbierając anonimowe informacje.',
      marketingTitle: 'Marketingowe cookie',
      marketingDesc: 'Używane do śledzenia odwiedzających na stronach w celu wyświetlania odpowiednich reklam.',
      alwaysActive: 'Zawsze aktywne'
    },
    uk: {
      cookiePolicyText: 'Політика Cookie',
      cookieBannerText: 'Ми використовуємо файли cookie для покращення вашого досвіду. Ви можете налаштувати свої вподобання.',
      acceptAllText: 'Прийняти всі',
      settingsText: 'Налаштування cookie',
      saveSettingsText: 'Зберегти налаштування',
      declineAllText: 'Відхилити всі',
      learnMoreText: 'Дізнатися більше',
      cookieSettingsTitle: 'Налаштування cookie',
      cookieSettingsDesc: 'Налаштуйте типи файлів cookie, які ви дозволяєте на нашому сайті. Необхідні cookie потрібні для функціонування сайту.',
      necessaryTitle: 'Необхідні cookie',
      necessaryDesc: 'Забезпечують базову функціональність сайту. Сайт не може нормально працювати без цих файлів.',
      analyticsTitle: 'Аналітичні cookie',
      analyticsDesc: 'Допомагають нам зрозуміти, як відвідувачі взаємодіють із сайтом, збираючи анонімну інформацію.',
      marketingTitle: 'Маркетингові cookie',
      marketingDesc: 'Використовуються для відстеження відвідувачів на веб-сайтах з метою відображення релевантної реклами.',
      alwaysActive: 'Завжди активні'
    },
    ru: {
      cookiePolicyText: 'Политика Cookie',
      cookieBannerText: 'Мы используем файлы cookie для улучшения вашего опыта. Вы можете настроить свои предпочтения.',
      acceptAllText: 'Принять все',
      settingsText: 'Настройки cookie',
      saveSettingsText: 'Сохранить настройки',
      declineAllText: 'Отклонить все',
      learnMoreText: 'Узнать больше',
      cookieSettingsTitle: 'Настройки cookie',
      cookieSettingsDesc: 'Настройте типы cookie-файлов, которые вы разрешаете использовать на нашем сайте. Обязательные cookie необходимы для функционирования сайта.',
      necessaryTitle: 'Необходимые cookie',
      necessaryDesc: 'Обеспечивают базовую функциональность сайта. Сайт не может нормально работать без этих файлов.',
      analyticsTitle: 'Аналитические cookie',
      analyticsDesc: 'Помогают нам понять, как посетители взаимодействуют с сайтом, собирая анонимную информацию.',
      marketingTitle: 'Маркетинговые cookie',
      marketingDesc: 'Используются для отслеживания посетителей на веб-сайтах с целью отображения релевантной рекламы.',
      alwaysActive: 'Всегда активны'
    },
    fr: {
      cookiePolicyText: 'Politique de Cookies',
      cookieBannerText: 'Nous utilisons des cookies pour améliorer votre expérience. Vous pouvez personnaliser vos préférences.',
      acceptAllText: 'Tout accepter',
      settingsText: 'Paramètres des cookies',
      saveSettingsText: 'Enregistrer',
      declineAllText: 'Tout refuser',
      learnMoreText: 'En savoir plus',
      cookieSettingsTitle: 'Paramètres des cookies',
      cookieSettingsDesc: 'Configurez les types de cookies que vous autorisez sur notre site. Les cookies nécessaires sont requis pour le fonctionnement du site.',
      necessaryTitle: 'Cookies nécessaires',
      necessaryDesc: 'Assurent la fonctionnalité de base du site. Le site ne peut pas fonctionner correctement sans ces cookies.',
      analyticsTitle: 'Cookies analytiques',
      analyticsDesc: 'Nous aident à comprendre comment les visiteurs interagissent avec le site en collectant des informations anonymes.',
      marketingTitle: 'Cookies marketing',
      marketingDesc: 'Utilisés pour suivre les visiteurs sur les sites web afin d\'afficher des publicités pertinentes.',
      alwaysActive: 'Toujours actif'
    },
    es: {
      cookiePolicyText: 'Política de Cookies',
      cookieBannerText: 'Utilizamos cookies para mejorar su experiencia. Puede personalizar sus preferencias.',
      acceptAllText: 'Aceptar todas',
      settingsText: 'Configuración de cookies',
      saveSettingsText: 'Guardar configuración',
      declineAllText: 'Rechazar todas',
      learnMoreText: 'Saber más',
      cookieSettingsTitle: 'Configuración de cookies',
      cookieSettingsDesc: 'Configure los tipos de cookies que permite en nuestro sitio. Las cookies necesarias son requeridas para el funcionamiento del sitio.',
      necessaryTitle: 'Cookies necesarias',
      necessaryDesc: 'Proporcionan la funcionalidad básica del sitio. El sitio no puede funcionar correctamente sin estas cookies.',
      analyticsTitle: 'Cookies analíticas',
      analyticsDesc: 'Nos ayudan a entender cómo los visitantes interactúan con el sitio, recopilando información anónima.',
      marketingTitle: 'Cookies de marketing',
      marketingDesc: 'Se utilizan para rastrear visitantes en los sitios web para mostrar anuncios relevantes.',
      alwaysActive: 'Siempre activas'
    },
    it: {
      cookiePolicyText: 'Politica dei Cookie',
      cookieBannerText: 'Utilizziamo i cookie per migliorare la tua esperienza. Puoi personalizzare le tue preferenze.',
      acceptAllText: 'Accetta tutti',
      settingsText: 'Impostazioni cookie',
      saveSettingsText: 'Salva impostazioni',
      declineAllText: 'Rifiuta tutti',
      learnMoreText: 'Scopri di più',
      cookieSettingsTitle: 'Impostazioni cookie',
      cookieSettingsDesc: 'Configura i tipi di cookie che consenti sul nostro sito. I cookie necessari sono richiesti per il funzionamento del sito.',
      necessaryTitle: 'Cookie necessari',
      necessaryDesc: 'Forniscono funzionalità di base del sito. Il sito non può funzionare correttamente senza questi cookie.',
      analyticsTitle: 'Cookie analitici',
      analyticsDesc: 'Ci aiutano a capire come i visitatori interagiscono con il sito raccogliendo informazioni anonime.',
      marketingTitle: 'Cookie di marketing',
      marketingDesc: 'Utilizzati per tracciare i visitatori sui siti web al fine di visualizzare annunci pertinenti.',
      alwaysActive: 'Sempre attivo'
    },
    ro: {
      cookiePolicyText: 'Politica Cookie',
      cookieBannerText: 'Folosim cookie-uri pentru a vă îmbunătăți experiența. Puteți personaliza preferințele.',
      acceptAllText: 'Acceptă toate',
      settingsText: 'Setări cookie',
      saveSettingsText: 'Salvează setările',
      declineAllText: 'Refuză toate',
      learnMoreText: 'Află mai multe',
      cookieSettingsTitle: 'Setări cookie',
      cookieSettingsDesc: 'Configurați tipurile de cookie-uri pe care le permiteți pe site-ul nostru. Cookie-urile necesare sunt obligatorii pentru funcționarea site-ului.',
      necessaryTitle: 'Cookie-uri necesare',
      necessaryDesc: 'Asigură funcționalitatea de bază a site-ului. Site-ul nu poate funcționa corect fără aceste cookie-uri.',
      analyticsTitle: 'Cookie-uri analitice',
      analyticsDesc: 'Ne ajută să înțelegem cum interacționează vizitatorii cu site-ul, colectând informații anonime.',
      marketingTitle: 'Cookie-uri de marketing',
      marketingDesc: 'Folosite pentru a urmări vizitatorii pe site-uri web pentru a afișa reclame relevante.',
      alwaysActive: 'Întotdeauna activ'
    },
    nl: {
      cookiePolicyText: 'Cookiebeleid',
      cookieBannerText: 'Wij gebruiken cookies om uw ervaring te verbeteren. U kunt uw voorkeuren aanpassen.',
      acceptAllText: 'Alles accepteren',
      settingsText: 'Cookie-instellingen',
      saveSettingsText: 'Instellingen opslaan',
      declineAllText: 'Alles weigeren',
      learnMoreText: 'Meer informatie',
      cookieSettingsTitle: 'Cookie-instellingen',
      cookieSettingsDesc: 'Configureer de soorten cookies die u op onze site toestaat. Noodzakelijke cookies zijn vereist voor de werking van de site.',
      necessaryTitle: 'Noodzakelijke cookies',
      necessaryDesc: 'Bieden basisfunctionaliteit van de site. De site kan niet goed functioneren zonder deze cookies.',
      analyticsTitle: 'Analytische cookies',
      analyticsDesc: 'Helpen ons te begrijpen hoe bezoekers omgaan met de site door anonieme informatie te verzamelen.',
      marketingTitle: 'Marketing cookies',
      marketingDesc: 'Worden gebruikt om bezoekers op websites te volgen om relevante advertenties weer te geven.',
      alwaysActive: 'Altijd actief'
    },
    pt: {
      cookiePolicyText: 'Política de Cookies',
      cookieBannerText: 'Usamos cookies para melhorar sua experiência. Você pode personalizar suas preferências.',
      acceptAllText: 'Aceitar todos',
      settingsText: 'Configurações de cookies',
      saveSettingsText: 'Salvar configurações',
      declineAllText: 'Recusar todos',
      learnMoreText: 'Saiba mais',
      cookieSettingsTitle: 'Configurações de cookies',
      cookieSettingsDesc: 'Configure os tipos de cookies que você permite em nosso site. Os cookies necessários são obrigatórios para o funcionamento do site.',
      necessaryTitle: 'Cookies necessários',
      necessaryDesc: 'Fornecem funcionalidade básica do site. O site não pode funcionar corretamente sem esses cookies.',
      analyticsTitle: 'Cookies analíticos',
      analyticsDesc: 'Nos ajudam a entender como os visitantes interagem com o site, coletando informações anônimas.',
      marketingTitle: 'Cookies de marketing',
      marketingDesc: 'Usados para rastrear visitantes em sites para exibir anúncios relevantes.',
      alwaysActive: 'Sempre ativo'
    }
  };
  
  // Detect language
  let detectedLang = 'en';
  if (langLower.includes('de')) detectedLang = 'de';
  else if (langLower.includes('pl')) detectedLang = 'pl';
  else if (langLower.includes('uk')) detectedLang = 'uk';
  else if (langLower.includes('ru')) detectedLang = 'ru';
  else if (langLower.includes('fr')) detectedLang = 'fr';
  else if (langLower.includes('es')) detectedLang = 'es';
  else if (langLower.includes('it')) detectedLang = 'it';
  else if (langLower.includes('ro')) detectedLang = 'ro';
  else if (langLower.includes('nl')) detectedLang = 'nl';
  else if (langLower.includes('pt')) detectedLang = 'pt';
  
  const t = cookieTexts[detectedLang] || cookieTexts.en;
  
  const cookiePolicyPath = cookiePolicyFile?.path.replace(/^\.?\//, '') || 'cookie-policy.html';
  
  // Cookie banner HTML with settings modal
  const COOKIE_BANNER_ID = 'lovable-cookie-banner';
  const COOKIE_MODAL_ID = 'lovable-cookie-modal';
  
  const cookieBannerHtml = `
<!-- Cookie Banner with Settings -->
<style>
#cookie-banner,.cookie-banner,#gdpr-cookie-banner,.gdpr-cookie-banner,.cookie-consent,.cookie-consent-banner{display:none!important}
#${COOKIE_BANNER_ID}{position:fixed;bottom:0;left:0;right:0;background:#1a1a1a;color:#fff;padding:16px 24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;z-index:9999;box-shadow:0 -2px 10px rgba(0,0,0,0.3);font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#${COOKIE_BANNER_ID} p{margin:0;flex:1;min-width:200px}
#${COOKIE_BANNER_ID} a{color:#4da6ff;text-decoration:underline}
#${COOKIE_BANNER_ID} .cookie-btn{border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-weight:600;font-size:14px;transition:opacity 0.2s}
#${COOKIE_BANNER_ID} .cookie-btn-primary{background:#4da6ff;color:#fff}
#${COOKIE_BANNER_ID} .cookie-btn-secondary{background:transparent;color:#4da6ff;border:1px solid #4da6ff}
#${COOKIE_BANNER_ID} .cookie-btn:hover{opacity:0.9}
#${COOKIE_MODAL_ID}{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#${COOKIE_MODAL_ID}.show{display:flex}
#${COOKIE_MODAL_ID} .modal-content{background:#fff;border-radius:12px;max-width:500px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
#${COOKIE_MODAL_ID} .modal-header{padding:20px 24px;border-bottom:1px solid #e5e5e5}
#${COOKIE_MODAL_ID} .modal-header h3{margin:0 0 8px 0;font-size:20px;color:#1a1a1a}
#${COOKIE_MODAL_ID} .modal-header p{margin:0;color:#666;font-size:14px;line-height:1.5}
#${COOKIE_MODAL_ID} .modal-body{padding:0}
#${COOKIE_MODAL_ID} .cookie-option{padding:20px 24px;border-bottom:1px solid #f0f0f0}
#${COOKIE_MODAL_ID} .cookie-option:last-child{border-bottom:none}
#${COOKIE_MODAL_ID} .cookie-option-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
#${COOKIE_MODAL_ID} .cookie-option-title{font-weight:600;color:#1a1a1a;font-size:15px}
#${COOKIE_MODAL_ID} .cookie-option-desc{color:#666;font-size:13px;line-height:1.5}
#${COOKIE_MODAL_ID} .cookie-toggle{position:relative;width:44px;height:24px}
#${COOKIE_MODAL_ID} .cookie-toggle input{opacity:0;width:0;height:0}
#${COOKIE_MODAL_ID} .cookie-toggle .slider{position:absolute;inset:0;background:#ccc;border-radius:24px;cursor:pointer;transition:0.3s}
#${COOKIE_MODAL_ID} .cookie-toggle .slider:before{content:'';position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:0.3s}
#${COOKIE_MODAL_ID} .cookie-toggle input:checked+.slider{background:#4da6ff}
#${COOKIE_MODAL_ID} .cookie-toggle input:checked+.slider:before{transform:translateX(20px)}
#${COOKIE_MODAL_ID} .cookie-toggle input:disabled+.slider{background:#4da6ff;cursor:default}
#${COOKIE_MODAL_ID} .always-active{color:#4da6ff;font-size:13px;font-weight:500}
#${COOKIE_MODAL_ID} .modal-footer{padding:16px 24px;border-top:1px solid #e5e5e5;display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap}
#${COOKIE_MODAL_ID} .modal-footer .cookie-btn{padding:12px 24px}
@media(max-width:480px){
  #${COOKIE_BANNER_ID}{flex-direction:column;text-align:center}
  #${COOKIE_MODAL_ID} .modal-footer{justify-content:center}
}
</style>
<div id="${COOKIE_BANNER_ID}">
  <p>${t.cookieBannerText} <a href="${cookiePolicyPath}">${t.learnMoreText}</a></p>
  <button class="cookie-btn cookie-btn-secondary" onclick="document.getElementById('${COOKIE_MODAL_ID}').classList.add('show')">${t.settingsText}</button>
  <button class="cookie-btn cookie-btn-primary" onclick="acceptAllCookies()">${t.acceptAllText}</button>
</div>
<div id="${COOKIE_MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header">
      <h3>${t.cookieSettingsTitle}</h3>
      <p>${t.cookieSettingsDesc}</p>
    </div>
    <div class="modal-body">
      <div class="cookie-option">
        <div class="cookie-option-header">
          <span class="cookie-option-title">${t.necessaryTitle}</span>
          <span class="always-active">${t.alwaysActive}</span>
        </div>
        <p class="cookie-option-desc">${t.necessaryDesc}</p>
      </div>
      <div class="cookie-option">
        <div class="cookie-option-header">
          <span class="cookie-option-title">${t.analyticsTitle}</span>
          <label class="cookie-toggle">
            <input type="checkbox" id="cookie-analytics">
            <span class="slider"></span>
          </label>
        </div>
        <p class="cookie-option-desc">${t.analyticsDesc}</p>
      </div>
      <div class="cookie-option">
        <div class="cookie-option-header">
          <span class="cookie-option-title">${t.marketingTitle}</span>
          <label class="cookie-toggle">
            <input type="checkbox" id="cookie-marketing">
            <span class="slider"></span>
          </label>
        </div>
        <p class="cookie-option-desc">${t.marketingDesc}</p>
      </div>
    </div>
    <div class="modal-footer">
      <button class="cookie-btn cookie-btn-secondary" onclick="declineAllCookies()">${t.declineAllText}</button>
      <button class="cookie-btn cookie-btn-primary" onclick="saveCookieSettings()">${t.saveSettingsText}</button>
    </div>
  </div>
</div>
<script>
(function(){
  var prefs=JSON.parse(localStorage.getItem('cookiePreferences')||'null');
  if(prefs){
    document.getElementById('${COOKIE_BANNER_ID}').style.display='none';
  }
  if(prefs){
    var a=document.getElementById('cookie-analytics');
    var m=document.getElementById('cookie-marketing');
    if(a)a.checked=!!prefs.analytics;
    if(m)m.checked=!!prefs.marketing;
  }
})();
function saveCookiePrefs(a,m){
  var prefs={necessary:true,analytics:!!a,marketing:!!m,savedAt:new Date().toISOString()};
  localStorage.setItem('cookiePreferences',JSON.stringify(prefs));
  document.getElementById('${COOKIE_BANNER_ID}').style.display='none';
  document.getElementById('${COOKIE_MODAL_ID}').classList.remove('show');
}
function acceptAllCookies(){saveCookiePrefs(true,true);}
function declineAllCookies(){saveCookiePrefs(false,false);}
function saveCookieSettings(){
  var a=document.getElementById('cookie-analytics');
  var m=document.getElementById('cookie-marketing');
  saveCookiePrefs(a&&a.checked,m&&m.checked);
}
document.getElementById('${COOKIE_MODAL_ID}').addEventListener('click',function(e){
  if(e.target===this)this.classList.remove('show');
});
</script>
<!-- End Cookie Banner -->`;
  
  const updatedFiles = files.map(f => {
    if (!/\.html?$/i.test(f.path)) return f;
    
    let content = f.content;
    let modified = false;
    
    // If the page has any cookie banner but not OUR settings modal, upgrade it.
    const hasOurCookieSettings =
      content.includes(COOKIE_MODAL_ID) ||
      content.includes(COOKIE_BANNER_ID) ||
      /cookiePreferences/i.test(content);

    const hasAnyCookieBanner =
      /cookie[-_]?(?:banner|consent|notice|popup)/i.test(content) ||
      /gdpr[-_]?(?:banner|consent|notice)/i.test(content) ||
      /id=["']cookie-banner["']/i.test(content) ||
      /class=["'][^"']*cookie-banner/i.test(content);

    if (!hasOurCookieSettings) {
      warnings.push(`${f.path}: Added/updated cookie settings (necessary/analytics/marketing)`);
      
      if (/<\/body>/i.test(content)) {
        content = content.replace(/<\/body>/i, `${cookieBannerHtml}\n</body>`);
      } else {
        content += cookieBannerHtml;
      }
      modified = true;
    }
    
    // Check footer for cookie policy link
    const hasFooter = /<footer\b/i.test(content);
    if (hasFooter) {
      const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
      if (footerMatch) {
        const footerContent = footerMatch[0];
        
        const hasCookieLink = 
          /href=["'][^"']*cookie/i.test(footerContent);
        
        if (!hasCookieLink) {
          warnings.push(`${f.path}: Added missing Cookie Policy link to footer`);
          
          const cookieLinkHtml = `<a href="${cookiePolicyPath}" class="footer-legal-link">${t.cookiePolicyText}</a>`;
          
          if (/<footer[\s\S]*?<(nav|ul)\b[\s\S]*?<\/\1>/i.test(content)) {
            content = content.replace(
              /(<footer[\s\S]*?)(<\/(?:nav|ul)>)/i,
              `$1 | ${cookieLinkHtml} $2`
            );
          } else if (/<footer[\s\S]*?class=["']footer-legal-links["']/i.test(content)) {
            content = content.replace(
              /(<div[^>]*class=["']footer-legal-links["'][^>]*>[\s\S]*?)(<\/div>)/i,
              `$1 | ${cookieLinkHtml}$2`
            );
          } else {
            const cookieBlock = `
      <div class="footer-cookie-link" style="margin-top: 8px; font-size: 0.875rem;">
        ${cookieLinkHtml}
      </div>`;
            content = content.replace(/<\/footer>/i, `${cookieBlock}\n</footer>`);
          }
          modified = true;
        }
      }
    }
    
    return modified ? { ...f, content } : f;
  });
  
  return { files: updatedFiles, warnings };
}

// ============ CRITICAL: PHONE ON ALL PAGES & CLICKABLE ============

// UTILITY: Strip attribute values to check for user-visible phone only
// This prevents false positives from phone numbers in src="", href="", content="", data-*=""
function stripAttributeValuesForPhoneScan(html: string): string {
  // Remove content inside src="...", href="..." (except tel:), content="...", data-*="..."
  return html
    .replace(/\bsrc=["'][^"']*["']/gi, 'src=""')
    .replace(/\bhref=["'](?!tel:)[^"']*["']/gi, 'href=""')
    .replace(/\bcontent=["'][^"']*["']/gi, 'content=""')
    .replace(/\bdata-[\w-]+=["'][^"']*["']/gi, 'data-x=""');
}

// Check if content has a user-visible phone number (ignoring URLs/attributes)
function hasUserVisiblePhone(content: string): boolean {
  const strippedContent = stripAttributeValuesForPhoneScan(content);
  return /\+\d[\d\s().-]{7,}\d/.test(strippedContent);
}

// Check if content has a PROPERLY FORMATTED clickable tel: link
// Must be: href="tel:+XXXXX" with closing quote
function hasClickableTelLink(content: string): boolean {
  // Match properly formatted tel: links with closing quote
  const properTelPattern = /href=["']tel:\+?\d[\d\s()-]*\d["']/i;
  return properTelPattern.test(content);
}

// Fix broken tel: links (missing closing quote, etc.)
function fixBrokenTelLinks(content: string, desiredPhone: string): string {
  const telNumber = desiredPhone.replace(/[^\d+]/g, '');
  
  // Pattern 1: href="tel: followed by phone but no closing quote before </a> or >
  // Example: <a href="tel: +49 30 123</a> -> <a href="tel:+49301234567">+49 30 123</a>
  content = content.replace(
    /<a\s+href=["']?tel:\s*([^"'<>]+?)(?:<\/a>|>)/gi,
    (match, phoneContent) => {
      // If properly formatted already, return as-is
      if (/^["']tel:\+?\d+["']$/i.test(`"tel:${phoneContent.trim()}"`)) {
        return match;
      }
      // Fix it
      console.log(`🔧 [fixBrokenTelLinks] Fixing broken tel link: ${match.substring(0, 50)}...`);
      return `<a href="tel:${telNumber}" class="site-phone-link" style="color:inherit;text-decoration:none;">${desiredPhone}</a>`;
    }
  );
  
  // Pattern 2: href="tel:XXX" but phone number has spaces inside href value
  // Example: href="tel: +49 30 123 456" -> href="tel:+49301234567"
  content = content.replace(
    /href=["']tel:\s*(\+?\d[\d\s().-]*\d)["']/gi,
    (match, phone) => {
      const cleanNumber = phone.replace(/[^\d+]/g, '');
      if (match.includes(cleanNumber)) return match; // Already clean
      return `href="tel:${cleanNumber}"`;
    }
  );
  
  return content;
}

// Make all phone numbers clickable with tel: links
function makeAllPhonesClickable(
  files: Array<{ path: string; content: string }>
): { files: Array<{ path: string; content: string }>; fixed: number } {
  let totalFixed = 0;
  
  // Regex to find phone numbers that are NOT already wrapped in tel: link
  // Matches: +XX XXX XXX XXXX patterns (international format)
  const PHONE_REGEX = /(?<!href=["']tel:[^"']*?)(?<!["'>])(\+\d[\d\s().-]{7,}\d)(?![^<]*<\/a>)/g;

  const updatedFiles = files.map(f => {
    if (!/\.(html?|php)$/i.test(f.path)) return f;

    let content = f.content;
    let fileFixed = 0;

    // Find all phones NOT in tel: links and wrap them
    content = content.replace(PHONE_REGEX, (match, phone, offset) => {
      const before = content.substring(Math.max(0, offset - 160), offset);

      // Skip if it is part of an URL/attribute/CSS url(...) (images MUST stay clean)
      if (/src=["'][^"']*$/i.test(before)) return match;
      if (/srcset=["'][^"']*$/i.test(before)) return match;
      if (/data-src=["'][^"']*$/i.test(before)) return match;
      if (/poster=["'][^"']*$/i.test(before)) return match;
      if (/href=["'](?!tel:)[^"']*$/i.test(before)) return match;
      if (/content=["'][^"']*$/i.test(before)) return match;
      if (/data-[\w-]+=["'][^"']*$/i.test(before)) return match;
      if (/url\(\s*["']?[^"')]*$/i.test(before)) return match;
      if (/https?:\/\/[^\s"']*$/i.test(before)) return match;

      // Skip if already inside an <a> tag
      const beforeLastOpenTag = content.substring(0, offset).match(/<a\s[^>]*>[^<]*$/i);
      if (beforeLastOpenTag) return match;

      fileFixed++;
      const telNumber = String(phone).replace(/[^\d+]/g, '');
      return `<a href="tel:${telNumber}" style="color:inherit;text-decoration:none;">${phone}</a>`;
    });

    totalFixed += fileFixed;
    return { ...f, content };
  });
  
  return { files: updatedFiles, fixed: totalFixed };
}

// Ensure EVERY page has a clickable phone number in header or footer
// CRITICAL: Always check for tel: link presence, not just visible phone text
function ensurePhoneOnAllPages(
  files: Array<{ path: string; content: string }>,
  desiredPhone: string,
  geo?: string
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  const phone = desiredPhone || generateRealisticPhone(geo);
  const telNumber = phone.replace(/[^\d+]/g, '');
  
  const phoneLink = `<a href="tel:${telNumber}" class="site-phone-link" style="color:inherit;text-decoration:none;font-weight:500;">${phone}</a>`;
  const phoneBlockHeader = `<div class="header-phone" style="padding:8px 16px;font-size:0.9rem;">${phoneLink}</div>`;
  const phoneBlockFooter = `<div class="footer-phone" style="margin:16px 0;font-size:0.95rem;">📞 ${phoneLink}</div>`;
  
  const updatedFiles = files.map(f => {
    if (!/\.(html?|php)$/i.test(f.path)) return f;
    
    let content = f.content;
    
    // FIRST: Fix any broken tel: links before checking
    content = fixBrokenTelLinks(content, phone);
    
    // PRIMARY CHECK: Is there a clickable tel: link?
    const hasTelLink = hasClickableTelLink(content);
    
    // SECONDARY CHECK: Is there a user-visible phone (not in URLs/attributes)?
    const hasVisiblePhoneReal = hasUserVisiblePhone(content);
    
    // Check if already has our marker class (prevent duplicate injections)
    const hasOurMarker = /class=["'][^"']*(?:site-phone-link|footer-phone|header-phone)[^"']*["']/i.test(content);
    
    // If no tel: link AND no user-visible phone AND no marker -> INJECT
    if (!hasTelLink && !hasVisiblePhoneReal && !hasOurMarker) {
      warnings.push(`[PHONE-INJECT] ${f.path}: No phone found - injecting clickable phone`);
      console.log(`📞 [ensurePhoneOnAllPages] Injecting phone into ${f.path} - no tel: or visible phone found`);
      
      // Try to add to header first
      if (/<header\b[^>]*>/i.test(content)) {
        content = content.replace(/(<header\b[^>]*>)/i, `$1\n${phoneBlockHeader}`);
      }
      
      // Always add to footer (most important!)
      if (/<footer\b[^>]*>/i.test(content)) {
        content = content.replace(/<\/footer>/i, `${phoneBlockFooter}\n</footer>`);
      } else if (/<\/body>/i.test(content)) {
        // Create footer if none exists
        content = content.replace(/<\/body>/i, `<footer style="padding:24px;text-align:center;">${phoneBlockFooter}</footer>\n</body>`);
      } else {
        content += `\n<footer style="padding:24px;text-align:center;">${phoneBlockFooter}</footer>`;
      }
    } else if (!hasTelLink && hasVisiblePhoneReal && !hasOurMarker) {
      // Phone exists but not clickable - check if it's in a good location
      const strippedFooter = stripAttributeValuesForPhoneScan(
        (content.match(/<footer[\s\S]*?<\/footer>/i) || [''])[0]
      );
      const strippedHeader = stripAttributeValuesForPhoneScan(
        (content.match(/<header[\s\S]*?<\/header>/i) || [''])[0]
      );
      
      const inFooter = /\+\d[\d\s().-]{7,}\d/.test(strippedFooter);
      const inHeader = /\+\d[\d\s().-]{7,}\d/.test(strippedHeader);
      
      if (!inFooter && !inHeader) {
        warnings.push(`[PHONE-INJECT] ${f.path}: Phone not in header/footer - adding to footer`);
        console.log(`📞 [ensurePhoneOnAllPages] Adding phone to footer in ${f.path} - phone exists but not in header/footer`);
        
        if (/<footer\b[^>]*>/i.test(content)) {
          content = content.replace(/<\/footer>/i, `${phoneBlockFooter}\n</footer>`);
        } else if (/<\/body>/i.test(content)) {
          content = content.replace(/<\/body>/i, `<footer style="padding:24px;text-align:center;">${phoneBlockFooter}</footer>\n</body>`);
        }
      }
    }
    // If hasTelLink is true, we're good - phone is already clickable
    
    return { ...f, content };
  });
  
  return { files: updatedFiles, warnings };
}
// ============ END PHONE ON ALL PAGES ============

// Combined post-validation function
function runContactValidation(
  files: Array<{ path: string; content: string }>,
  geo?: string,
  language?: string,
  desiredPhone?: string
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const allWarnings: string[] = [];
  
  // Step 0: CRITICAL - Ensure phone on ALL pages (most important!)
  const phoneToUse = desiredPhone || generateRealisticPhone(geo);
  const { files: filesWithPhones, warnings: phoneWarnings } = ensurePhoneOnAllPages(files, phoneToUse, geo);
  allWarnings.push(...phoneWarnings);
  
  // Step 0.5: Make ALL phone numbers clickable with tel: links
  const { files: filesWithClickablePhones, fixed: clickableFixed } = makeAllPhonesClickable(filesWithPhones);
  if (clickableFixed > 0) {
    allWarnings.push(`Made ${clickableFixed} phone number(s) clickable with tel: links`);
  }
  
  // Step 1: Validate contact page has phone/email
  const { files: filesAfterContactValidation, warnings: contactWarnings } = validateContactPage(filesWithClickablePhones, geo);
  allWarnings.push(...contactWarnings);
  
  // Step 2: Ensure all footers have contact link
  const { files: filesWithContactLinks, warnings: footerWarnings } = ensureContactLinkInFooters(filesAfterContactValidation);
  allWarnings.push(...footerWarnings);
  
  // Step 3: Ensure all footers have Privacy Policy and Terms links
  const { files: filesWithLegalLinks, warnings: legalWarnings } = ensureLegalLinksInFooters(filesWithContactLinks, language);
  allWarnings.push(...legalWarnings);
  
  // Step 4: Ensure Cookie Policy link and cookie banner in all pages
  const { files: finalFiles, warnings: cookieWarnings } = ensureCookiePolicyAndBanner(filesWithLegalLinks, language);
  allWarnings.push(...cookieWarnings);
  
  if (allWarnings.length > 0) {
    console.log(`📋 Contact & Legal validation complete with ${allWarnings.length} fixes:`);
    allWarnings.forEach(w => console.log(`   - ${w}`));
  } else {
    console.log(`✅ Contact & Legal validation passed - no fixes needed`);
  }
  
  return { files: finalFiles, warnings: allWarnings };
}
// ============ END CONTACT INFO & FOOTER LINK VALIDATION ============

function enforceResponsiveImagesInFiles(
  files: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
  const STYLE_ID = "lovable-responsive-images";
  // Prevent AI-generated pages from rendering "full height" banner images.
  // We keep generic responsiveness AND add guardrails for hero/banner containers.
  const css = `\n<style id="${STYLE_ID}">\n  img, svg, video { max-width: 100%; height: auto; }\n  img { display: block; }\n  figure { margin: 0; }\n\n  /* HERO/BANNER IMAGE GUARDRails */\n  .hero img,\n  .hero-media img,\n  .hero-image img,\n  .page-hero img,\n  .banner img,\n  .masthead img,\n  .cover img,\n  .header-image img,\n  .fullwidth img,\n  .media-visual img {\n    width: 100%;\n    height: clamp(240px, 45vh, 520px);\n    object-fit: cover;\n    object-position: center;\n  }\n</style>\n`;

  return files.map((f) => {
    if (!/\.(html?|php)$/i.test(f.path)) return f;
    if (!/(<img\b|<svg\b|<video\b)/i.test(f.content)) return f;
    if (new RegExp(`id=["']${STYLE_ID}["']`, "i").test(f.content)) return f;

    let content = f.content;
    if (/<\/head>/i.test(content)) {
      content = content.replace(/<\/head>/i, `${css}</head>`);
    } else {
      content = css + content;
    }
    return { ...f, content };
  });
}

function enforceUiUxBaselineInFiles(
  files: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
  const STYLE_ID = "lovable-uix-baseline";

  // Baseline UI/UX guardrails for generated HTML sites:
  // - prevent accidental 100vh heroes on mobile
  // - keep sections readable and not overly tall
  // - eliminate horizontal overflow
  const css = `\n<style id="${STYLE_ID}">\n  html { -webkit-text-size-adjust: 100%; }\n  body { overflow-x: hidden; }\n  img, video { max-width: 100%; }\n\n  /* HERO / BANNERS: clamp instead of full viewport */\n  .hero,\n  .page-hero,\n  .banner,\n  .masthead,\n  .cover,\n  .fullwidth {\n    min-height: clamp(420px, 70vh, 720px) !important;\n    max-height: none !important;\n  }\n\n  /* If generator produced 100vh directly, tame it */\n  [style*="height:100vh"],\n  [style*="height: 100vh"],\n  [style*="min-height:100vh"],\n  [style*="min-height: 100vh"] {\n    height: auto !important;\n    min-height: clamp(420px, 70vh, 720px) !important;\n  }\n\n  /* Sections: keep spacing balanced across devices */\n  section {\n    padding-block: clamp(56px, 7vw, 96px);\n  }\n\n  /* Containers: prevent accidental ultra-wide layouts */\n  .container {\n    width: min(1120px, 100% - 32px);\n    margin-inline: auto;\n  }\n\n  @media (max-width: 640px) {\n    .hero,\n    .page-hero,\n    .banner,\n    .masthead,\n    .cover,\n    .fullwidth {\n      min-height: clamp(360px, 62vh, 560px) !important;\n    }\n    section {\n      padding-block: clamp(44px, 9vw, 72px);\n    }\n  }\n</style>\n`;

  return files.map((f) => {
    if (!/\.(html?)$/i.test(f.path)) return f;
    if (new RegExp(`id=["']${STYLE_ID}["']`, "i").test(f.content)) return f;

    let content = f.content;
    if (/<\/head>/i.test(content)) {
      content = content.replace(/<\/head>/i, `${css}</head>`);
    } else {
      content = css + content;
    }
    return { ...f, content };
  });
}

function ensureFaviconAndLogoInFiles(
  files: Array<{ path: string; content: string }>,
  siteNameRaw?: string
): Array<{ path: string; content: string }> {
  const siteName = (siteNameRaw || "Website").trim() || "Website";
  const initials =
    siteName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => (w[0] ? w[0].toUpperCase() : ""))
      .join("") || "W";

  const safeText = (s: string) =>
    s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

  // Generate a small legacy-compatible favicon.ico (32-bit BMP inside ICO).
  // Note: we can't reliably rasterize SVG here without native deps, so we render
  // a simplified bitmap that matches the brand gradient + initials.
  const toBase64 = (bytes: Uint8Array) => {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  const font5x7: Record<string, string[]> = {
    A: ["01110","10001","10001","11111","10001","10001","10001"],
    B: ["11110","10001","10001","11110","10001","10001","11110"],
    C: ["01111","10000","10000","10000","10000","10000","01111"],
    D: ["11110","10001","10001","10001","10001","10001","11110"],
    E: ["11111","10000","10000","11110","10000","10000","11111"],
    F: ["11111","10000","10000","11110","10000","10000","10000"],
    G: ["01111","10000","10000","10111","10001","10001","01111"],
    H: ["10001","10001","10001","11111","10001","10001","10001"],
    I: ["11111","00100","00100","00100","00100","00100","11111"],
    J: ["00111","00010","00010","00010","10010","10010","01100"],
    K: ["10001","10010","10100","11000","10100","10010","10001"],
    L: ["10000","10000","10000","10000","10000","10000","11111"],
    M: ["10001","11011","10101","10101","10001","10001","10001"],
    N: ["10001","11001","10101","10011","10001","10001","10001"],
    O: ["01110","10001","10001","10001","10001","10001","01110"],
    P: ["11110","10001","10001","11110","10000","10000","10000"],
    Q: ["01110","10001","10001","10001","10101","10010","01101"],
    R: ["11110","10001","10001","11110","10100","10010","10001"],
    S: ["01111","10000","10000","01110","00001","00001","11110"],
    T: ["11111","00100","00100","00100","00100","00100","00100"],
    U: ["10001","10001","10001","10001","10001","10001","01110"],
    V: ["10001","10001","10001","10001","10001","01010","00100"],
    W: ["10001","10001","10001","10101","10101","11011","10001"],
    X: ["10001","10001","01010","00100","01010","10001","10001"],
    Y: ["10001","10001","01010","00100","00100","00100","00100"],
    Z: ["11111","00001","00010","00100","01000","10000","11111"],
    "0": ["01110","10001","10011","10101","11001","10001","01110"],
    "1": ["00100","01100","00100","00100","00100","00100","01110"],
    "2": ["01110","10001","00001","00010","00100","01000","11111"],
    "3": ["11110","00001","00001","01110","00001","00001","11110"],
    "4": ["00010","00110","01010","10010","11111","00010","00010"],
    "5": ["11111","10000","10000","11110","00001","00001","11110"],
    "6": ["01110","10000","10000","11110","10001","10001","01110"],
    "7": ["11111","00001","00010","00100","01000","01000","01000"],
    "8": ["01110","10001","10001","01110","10001","10001","01110"],
    "9": ["01110","10001","10001","01111","00001","00001","01110"],
    "?": ["01110","10001","00001","00010","00100","00000","00100"],
  };

  const createIcoBase64 = (text: string) => {
    const w = 32;
    const h = 32;

    const pickChars = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 2);
    const chars = pickChars.length ? pickChars.split("") : ["W"];

    // BGRA pixels, bottom-up for BMP in ICO
    const pixels = new Uint8Array(w * h * 4);

    // Gradient colors (roughly tailwind emerald 500 -> emerald 700)
    const c1 = { r: 16, g: 185, b: 129 };
    const c2 = { r: 4, g: 120, b: 87 };

    const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      const r = lerp(c1.r, c2.r, t);
      const g = lerp(c1.g, c2.g, t);
      const b = lerp(c1.b, c2.b, t);
      for (let x = 0; x < w; x++) {
        const i = ((h - 1 - y) * w + x) * 4; // bottom-up
        pixels[i + 0] = b;
        pixels[i + 1] = g;
        pixels[i + 2] = r;
        pixels[i + 3] = 255;
      }
    }

    // Rounded corners mask (approx)
    const radius = 7;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inCorner =
          (x < radius && y < radius) ||
          (x >= w - radius && y < radius) ||
          (x < radius && y >= h - radius) ||
          (x >= w - radius && y >= h - radius);
        if (!inCorner) continue;

        const cx = x < radius ? radius - 1 : w - radius;
        const cy = y < radius ? radius - 1 : h - radius;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > (radius - 1) * (radius - 1)) {
          const i = ((h - 1 - y) * w + x) * 4;
          pixels[i + 3] = 0;
        }
      }
    }

    // Draw 5x7 font scaled
    const scale = chars.length === 1 ? 3 : 3;
    const glyphW = 5 * scale;
    const glyphH = 7 * scale;
    const gap = scale;
    const totalW = chars.length * glyphW + (chars.length - 1) * gap;
    const startX = Math.floor((w - totalW) / 2);
    const startY = Math.floor((h - glyphH) / 2) + 1;

    const setPx = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = ((h - 1 - y) * w + x) * 4;
      // white
      pixels[i + 0] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = 255;
    };

    chars.forEach((ch, idx) => {
      const glyph = font5x7[ch] || font5x7["?"];
      const ox = startX + idx * (glyphW + gap);
      for (let gy = 0; gy < 7; gy++) {
        const row = glyph[gy];
        for (let gx = 0; gx < 5; gx++) {
          if (row[gx] !== "1") continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              setPx(ox + gx * scale + sx, startY + gy * scale + sy);
            }
          }
        }
      }
    });

    // AND mask: 1 means transparent, 0 opaque. We'll derive from alpha.
    const maskRowBytes = Math.ceil(w / 32) * 4; // aligned to 32 bits
    const mask = new Uint8Array(maskRowBytes * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((h - 1 - y) * w + x) * 4;
        const a = pixels[i + 3];
        const bit = a === 0 ? 1 : 0;
        const byteIndex = y * maskRowBytes + (x >> 3);
        const bitIndex = 7 - (x & 7);
        if (bit) mask[byteIndex] |= 1 << bitIndex;
      }
    }

    // BITMAPINFOHEADER
    const headerSize = 40;
    const dib = new Uint8Array(headerSize);
    const dv = new DataView(dib.buffer);
    dv.setUint32(0, headerSize, true);
    dv.setInt32(4, w, true);
    dv.setInt32(8, h * 2, true); // color + mask
    dv.setUint16(12, 1, true); // planes
    dv.setUint16(14, 32, true); // bpp
    dv.setUint32(16, 0, true); // BI_RGB
    dv.setUint32(20, pixels.length + mask.length, true);

    const imageData = new Uint8Array(dib.length + pixels.length + mask.length);
    imageData.set(dib, 0);
    imageData.set(pixels, dib.length);
    imageData.set(mask, dib.length + pixels.length);

    // ICO header + directory
    const icoHeader = new Uint8Array(6 + 16);
    const iv = new DataView(icoHeader.buffer);
    iv.setUint16(0, 0, true); // reserved
    iv.setUint16(2, 1, true); // type
    iv.setUint16(4, 1, true); // count
    icoHeader[6] = w; // width
    icoHeader[7] = h; // height
    icoHeader[8] = 0; // colors
    icoHeader[9] = 0; // reserved
    iv.setUint16(10, 1, true); // planes
    iv.setUint16(12, 32, true); // bpp
    iv.setUint32(14, imageData.length, true); // bytesInRes
    iv.setUint32(18, icoHeader.length, true); // offset

    const out = new Uint8Array(icoHeader.length + imageData.length);
    out.set(icoHeader, 0);
    out.set(imageData, icoHeader.length);
    return toBase64(out);
  };

  const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64" role="img" aria-label="${safeText(siteName)} logo">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#g)"/>
  <text x="32" y="41" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="26" font-weight="800" fill="#ffffff">${safeText(initials)}</text>
  <text x="76" y="41" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="18" font-weight="700" fill="#111827">${safeText(siteName)}</text>
</svg>`;

  const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${safeText(siteName)} favicon">
  <defs>
    <linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#fg)"/>
  <text x="32" y="42" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="26" font-weight="900" fill="#ffffff">${safeText(initials)}</text>
</svg>`;

  const hasLogo = files.some((f) => f.path.toLowerCase() === "logo.svg");
  const hasFaviconSvg = files.some((f) => f.path.toLowerCase() === "favicon.svg");
  const hasFaviconIco = files.some((f) => f.path.toLowerCase() === "favicon.ico");

  const withAssets = [...files];
  if (!hasLogo) withAssets.push({ path: "logo.svg", content: logoSvg });
  if (!hasFaviconSvg) withAssets.push({ path: "favicon.svg", content: faviconSvg });
  if (!hasFaviconIco) withAssets.push({ path: "favicon.ico", content: createIcoBase64(initials) });

  return withAssets.map((f) => {
    if (!/\.(html?|php)$/i.test(f.path)) return f;
    let content = f.content;

    // Ensure favicon link exists
    if (!/rel=["']icon["']/i.test(content)) {
      const link = `\n<link rel="icon" href="favicon.ico" type="image/x-icon">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n`;
      content = /<\/head>/i.test(content)
        ? content.replace(/<\/head>/i, `${link}</head>`)
        : `${link}${content}`;
    } else {
      // If there is already an icon, still try to add .ico for legacy browsers
      if (!/href=["']favicon\.ico["']/i.test(content)) {
        const link = `\n<link rel="icon" href="favicon.ico" type="image/x-icon">\n`;
        content = /<\/head>/i.test(content)
          ? content.replace(/<\/head>/i, `${link}</head>`)
          : `${link}${content}`;
      }
    }

    // Replace common text logo anchors with an <img> (only if there isn't already an <img>)
    content = content.replace(
      /<a([^>]*\bclass=["'][^"']*(?:nav-logo|logo|brand)[^"']*["'][^>]*)>(?!\s*<img\b)[\s\S]*?<\/a>/gi,
      (_m, aAttrs) =>
        `<a${aAttrs}><img src="logo.svg" alt="${safeText(siteName)} logo" style="height:40px;width:auto;display:block" loading="eager"></a>`
    );

    return { ...f, content };
  });
}

// MANDATORY: Ensure required utility pages exist for HTML generations.
// NOTE: There is also a nested implementation inside the main generation flow.
// This top-level version is required so background generation can call it too.
function ensureMandatoryPages(
  generatedFiles: GeneratedFile[],
  lang: string = "en"
): GeneratedFile[] {
  const fileMap = new Map(generatedFiles.map((f) => [f.path.toLowerCase(), f]));

  // Extract header/footer from index.html for consistent styling
  const indexFile = fileMap.get("index.html");
  let headerHtml = "";
  let footerHtml = "";
  let siteName = "Company";
  let indexHtml = "";

  if (indexFile) {
    const content = indexFile.content;
    indexHtml = content;
    const headerMatch = content.match(/<header[\s\S]*?<\/header>/i);
    if (headerMatch) headerHtml = headerMatch[0];
    const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
    if (footerMatch) footerHtml = footerMatch[0];
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) siteName = titleMatch[1].split(/[-|]/)[0].trim();
  }

  const backText =
    lang === "uk"
      ? "Повернутися на головну"
      : lang === "ru"
        ? "Вернуться на главную"
        : lang === "de"
          ? "Zurück zur Startseite"
          : "Back to Home";
  const notFoundTitle =
    lang === "uk"
      ? "Сторінку не знайдено"
      : lang === "ru"
        ? "Страница не найдена"
        : lang === "de"
          ? "Seite nicht gefunden"
          : "Page Not Found";
  const notFoundText =
    lang === "uk"
      ? "Схоже, цієї сторінки не існує або її було переміщено."
      : lang === "ru"
        ? "Похоже, этой страницы не существует или она была перемещена."
        : lang === "de"
          ? "Diese Seite existiert nicht oder wurde verschoben."
          : "This page doesn't exist or may have been moved.";
  const redirectText =
    lang === "uk"
      ? "Перенаправляємо на головну…"
      : lang === "ru"
        ? "Перенаправляем на главную…"
        : lang === "de"
          ? "Weiterleitung zur Startseite…"
          : "Redirecting to the homepage…";

  const generateLegalContent = (fileName: string): string => {
    // Keep these pages long enough to avoid being treated as “incomplete”.
    // (The main flow has a richer implementation; this is a stable fallback for BG flow.)
    const section = (h: string, p: string) =>
      `<section style="margin-bottom: 30px;"><h2>${h}</h2><p>${p}</p></section>`;

    if (fileName === "privacy.html") {
      if (lang === "uk" || lang === "ru") {
        const t1 =
          lang === "uk" ? "1. Загальні положення" : "1. Общие положения";
        const t2 = lang === "uk" ? "2. Які дані ми збираємо" : "2. Какие данные мы собираем";
        const t3 =
          lang === "uk" ? "3. Як ми використовуємо дані" : "3. Как мы используем данные";
        const t4 =
          lang === "uk" ? "4. Захист даних" : "4. Защита данных";
        const t5 = lang === "uk" ? "5. Ваші права" : "5. Ваши права";
        const t6 = lang === "uk" ? "6. Контакти" : "6. Контакты";

        return (
          section(t1, `${siteName} описує, як ми збираємо, використовуємо та захищаємо вашу інформацію.`) +
          section(t2, "Ми можемо збирати контактні дані, технічні дані (IP, браузер), та cookies.") +
          section(t3, "Дані використовуються для надання послуг, покращення сайту, комунікації та аналітики.") +
          section(t4, "Ми застосовуємо організаційні та технічні заходи для захисту даних.") +
          section(t5, "Ви можете запитувати доступ, виправлення або видалення персональних даних.") +
          section(t6, "Звертайтесь через контактну форму на сайті.") +
          "\n".repeat(30)
        );
      }

      return (
        section(
          "1. Introduction",
          `This Privacy Policy explains how ${siteName} collects, uses, and protects personal information.`
        ) +
        section("2. Data We Collect", "Contact details, technical data (IP, browser), cookies, and usage analytics.") +
        section("3. How We Use Data", "To provide services, improve the website, communicate with you, and for analytics.") +
        section("4. Security", "We apply reasonable technical and organizational safeguards to protect your information.") +
        section("5. Your Rights", "You may request access, correction, or deletion of your personal information.") +
        section("6. Contact", "Please contact us via the website contact form.") +
        "\n".repeat(30)
      );
    }

    if (fileName === "terms.html") {
      if (lang === "uk" || lang === "ru") {
        const t1 = lang === "uk" ? "1. Прийняття умов" : "1. Принятие условий";
        const t2 = lang === "uk" ? "2. Опис послуг" : "2. Описание услуг";
        const t3 = lang === "uk" ? "3. Правила користування" : "3. Правила использования";
        const t4 = lang === "uk" ? "4. Інтелектуальна власність" : "4. Интеллектуальная собственность";
        const t5 = lang === "uk" ? "5. Обмеження відповідальності" : "5. Ограничение ответственности";
        const t6 = lang === "uk" ? "6. Зміни умов" : "6. Изменения условий";
        return (
          section(t1, "Використовуючи сайт, ви погоджуєтесь з цими умовами.") +
          section(t2, `${siteName} надає інформаційні та/або консультаційні послуги, описані на сайті.`) +
          section(t3, "Заборонено використовувати сайт у незаконних цілях або порушувати права інших осіб.") +
          section(t4, "Матеріали сайту захищені законом. Заборонено копіювання без дозволу.") +
          section(t5, "Ми не несемо відповідальності за непрямі збитки або втрату даних.") +
          section(t6, "Ми можемо змінювати умови. Актуальна версія завжди доступна на сайті.") +
          "\n".repeat(30)
        );
      }
      return (
        section("1. Acceptance", "By using this website, you agree to these Terms of Service.") +
        section("2. Services", `${siteName} provides informational and/or consulting services as described on the site.`) +
        section("3. User Conduct", "You agree to use the site lawfully and not to violate others’ rights.") +
        section("4. Intellectual Property", "All content is protected; copying without permission is prohibited.") +
        section("5. Liability", "We are not liable for indirect damages or data loss to the extent permitted by law.") +
        section("6. Changes", "We may update these terms; the current version will be posted on the website.") +
        "\n".repeat(30)
      );
    }

    if (fileName === "cookie-policy.html") {
      if (lang === "uk" || lang === "ru") {
        const t1 = lang === "uk" ? "1. Що таке cookies" : "1. Что такое cookies";
        const t2 = lang === "uk" ? "2. Як ми використовуємо cookies" : "2. Как мы используем cookies";
        const t3 = lang === "uk" ? "3. Типи cookies" : "3. Типы cookies";
        const t4 = lang === "uk" ? "4. Управління cookies" : "4. Управление cookies";
        return (
          section(t1, "Cookies — це невеликі файли, що зберігаються у вашому браузері.") +
          section(t2, "Ми використовуємо cookies для роботи сайту, аналітики та запам’ятовування налаштувань.") +
          `<section style="margin-bottom: 30px;"><h2>${t3}</h2><table style="width:100%; border-collapse: collapse; margin: 20px 0;"><thead><tr style="background:#f5f5f5;"><th style="padding:12px; border:1px solid #ddd;">Name</th><th style="padding:12px; border:1px solid #ddd;">Type</th><th style="padding:12px; border:1px solid #ddd;">Duration</th><th style="padding:12px; border:1px solid #ddd;">Purpose</th></tr></thead><tbody><tr><td style="padding:12px; border:1px solid #ddd;">cookieConsent</td><td style="padding:12px; border:1px solid #ddd;">Necessary</td><td style="padding:12px; border:1px solid #ddd;">1 year</td><td style="padding:12px; border:1px solid #ddd;">Stores cookie consent</td></tr></tbody></table></section>` +
          section(t4, "Ви можете керувати cookies у налаштуваннях браузера.") +
          "\n".repeat(30)
        );
      }
      return (
        section("1. What Are Cookies", "Cookies are small text files stored on your device when you visit a website.") +
        section("2. How We Use Cookies", "We use cookies for core functionality, analytics, and remembering preferences.") +
        section("3. Types", "Necessary cookies (cookieConsent) and optional analytics cookies may be used.") +
        section("4. Managing Cookies", "You can control cookies in your browser settings.") +
        "\n".repeat(30)
      );
    }

    return "";
  };

  const generateMandatoryPageContent = (fileName: string, title: string): string => {
    if (fileName === "200.html") {
      if (indexHtml && indexHtml.length > 300) return indexHtml;
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <meta http-equiv="refresh" content="0; url=index.html">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  ${headerHtml}
  <main class="section" style="min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 20px;">
    <div class="container">
      <h1 style="font-size:2rem;margin-bottom:12px;">${redirectText}</h1>
      <p style="color:#666;">${backText}: <a href="index.html">index.html</a></p>
    </div>
  </main>
  ${footerHtml}
  <script src="cookie-banner.js"></script>
  <script>window.location.replace('index.html');</script>
</body>
</html>`;
    }

    if (fileName === "404.html") {
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notFoundTitle} - ${siteName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  ${headerHtml}
  <main class="section" style="min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 20px;">
    <div class="container">
      <div style="font-size:64px;line-height:1;margin-bottom:18px;font-weight:800;">404</div>
      <h1 style="font-size:2rem;margin-bottom:12px;">${notFoundTitle}</h1>
      <p style="color:#666;max-width:700px;margin:0 auto 28px;">${notFoundText}</p>
      <a href="index.html" class="btn" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">${backText}</a>
    </div>
  </main>
  ${footerHtml}
  <script src="cookie-banner.js"></script>
</body>
</html>`;
    }

    if (fileName === "thank-you.html") {
      const thankYouTitle =
        lang === "uk"
          ? "Дякуємо за звернення!"
          : lang === "ru"
            ? "Спасибо за обращение!"
            : lang === "de"
              ? "Danke für Ihre Nachricht!"
              : "Thank You for Contacting Us!";
      const thankYouText =
        lang === "uk"
          ? "Ми отримали ваше повідомлення і зв'яжемося з вами найближчим часом."
          : lang === "ru"
            ? "Мы получили ваше сообщение и свяжемся с вами в ближайшее время."
            : lang === "de"
              ? "Wir haben Ihre Nachricht erhalten und werden uns in Kürze bei Ihnen melden."
              : "We have received your message and will get back to you shortly.";

      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${siteName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  ${headerHtml}
  <main class="thank-you-page" style="min-height: 60vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 80px 20px;">
    <div class="container">
      <div style="font-size: 80px; margin-bottom: 30px;">✓</div>
      <h1 style="font-size: 2.5rem; margin-bottom: 20px;">${thankYouTitle}</h1>
      <p style="font-size: 1.2rem; color: #666; margin-bottom: 40px;">${thankYouText}</p>
      <a href="index.html" class="btn" style="display: inline-block; padding: 15px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">${backText}</a>
    </div>
  </main>
  ${footerHtml}
  <script src="cookie-banner.js"></script>
</body>
</html>`;
    }

    // Legal pages
    const legalContent = generateLegalContent(fileName);
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${siteName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  ${headerHtml}
  <main class="legal-page" style="padding: 80px 20px; max-width: 900px; margin: 0 auto;">
    <h1 style="font-size: 2.5rem; margin-bottom: 40px;">${title}</h1>
    ${legalContent}
    <p style="margin-top: 40px;"><a href="index.html">${backText}</a></p>
  </main>
  ${footerHtml}
  <script src="cookie-banner.js"></script>
</body>
</html>`;
  };

  const mandatoryPages = [
    {
      file: "privacy.html",
      title:
        lang === "uk"
          ? "Політика конфіденційності"
          : lang === "ru"
            ? "Политика конфиденциальности"
            : lang === "de"
              ? "Datenschutzerklärung"
              : "Privacy Policy",
      minLength: 2000,
    },
    {
      file: "terms.html",
      title:
        lang === "uk" ? "Умови використання" : lang === "ru" ? "Условия использования" : lang === "de" ? "Nutzungsbedingungen" : "Terms of Service",
      minLength: 2000,
    },
    {
      file: "cookie-policy.html",
      title:
        lang === "uk" ? "Політика cookies" : lang === "ru" ? "Политика cookies" : lang === "de" ? "Cookie-Richtlinie" : "Cookie Policy",
      minLength: 2000,
    },
    {
      file: "thank-you.html",
      title: lang === "uk" ? "Дякуємо" : lang === "ru" ? "Спасибо" : lang === "de" ? "Danke" : "Thank You",
      minLength: 500,
    },
    // Static hosting helpers
    { file: "404.html", title: notFoundTitle, minLength: 300 },
    { file: "200.html", title: siteName, minLength: 300 },
  ];

  // Filter out incomplete mandatory pages and add proper versions
  const filteredFiles = generatedFiles.filter((f) => {
    const fileName = f.path.toLowerCase();
    const mandatoryPage = mandatoryPages.find((mp) => mp.file === fileName);
    if (mandatoryPage && f.content.length < mandatoryPage.minLength) {
      console.log(
        `⚠️ Replacing incomplete page ${f.path} (${f.content.length} chars < ${mandatoryPage.minLength} min)`
      );
      return false;
    }
    return true;
  });

  const filteredFileMap = new Map(filteredFiles.map((f) => [f.path.toLowerCase(), f]));

  for (const page of mandatoryPages) {
    if (!filteredFileMap.has(page.file)) {
      console.log(`📁 Adding/regenerating mandatory page: ${page.file}`);
      const pageContent = generateMandatoryPageContent(page.file, page.title);
      filteredFiles.push({ path: page.file, content: pageContent });
    }
  }

  return filteredFiles;
}

// ============ BILINGUAL I18N (ONE HTML SET + JS) ============
function normalizeLang(code: string): string {
  return (code || "").toLowerCase().trim().replace(/_/g, "-").split("-")[0];
}

function ensureBilingualI18nInFiles(
  files: Array<{ path: string; content: string }>,
  bilingualLanguages: string[] | null | undefined,
  siteName?: string
): Array<{ path: string; content: string }> {
  if (!bilingualLanguages || !Array.isArray(bilingualLanguages) || bilingualLanguages.length !== 2) return files;
  const lang1 = normalizeLang(bilingualLanguages[0]);
  const lang2 = normalizeLang(bilingualLanguages[1]);
  if (!lang1 || !lang2 || lang1 === lang2) return files;

  const fileMap = new Map(files.map((f) => [f.path.toLowerCase(), f]));
  const hasI18nJs = fileMap.has("i18n/i18n.js");
  const hasTranslationsJs = fileMap.has("i18n/translations.js");

  const defaultTranslations = `// Auto-generated fallback. You can edit freely.
// eslint-disable-next-line no-var
var __SITE_TRANSLATIONS__ = {
  "${lang1}": {
    "meta": { "siteName": "${(siteName || "Website").replace(/"/g, "\\\"")}" },
    "lang": { "label": "${lang1.toUpperCase()}" },
    "nav": { "home": "Home", "about": "About", "services": "Services", "contact": "Contact" },
    "common": { "learnMore": "Learn more", "send": "Send" }
  },
  "${lang2}": {
    "meta": { "siteName": "${(siteName || "Website").replace(/"/g, "\\\"")}" },
    "lang": { "label": "${lang2.toUpperCase()}" },
    "nav": { "home": "Home", "about": "About", "services": "Services", "contact": "Contact" },
    "common": { "learnMore": "Learn more", "send": "Send" }
  }
};
// Expose on window for i18n.js
// eslint-disable-next-line no-var
if (typeof window !== "undefined") window.__SITE_TRANSLATIONS__ = __SITE_TRANSLATIONS__;
`;

  const defaultI18n = `// Minimal runtime i18n for static sites (works on file:// too)
(function () {
  var allowed = ["${lang1}", "${lang2}"];
  function norm(code) {
    return (code || "").toLowerCase().trim().replace(/_/g, "-").split("-")[0];
  }
  function getFromQuery() {
    try {
      var u = new URL(window.location.href);
      return norm(u.searchParams.get("lang") || "");
    } catch (_) {
      return "";
    }
  }
  function detectBrowserLang() {
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).map(norm);
    for (var i = 0; i < langs.length; i++) {
      if (allowed.indexOf(langs[i]) !== -1) return langs[i];
    }
    return allowed[0];
  }
  function getSaved() {
    try {
      return norm(localStorage.getItem("siteLang") || "");
    } catch (_) {
      return "";
    }
  }
  function setSaved(lang) {
    try {
      localStorage.setItem("siteLang", lang);
    } catch (_) {}
  }
  function deepGet(obj, key) {
    if (!obj) return undefined;
    var parts = (key || "").split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur && typeof cur === "object" && parts[i] in cur) cur = cur[parts[i]];
      else return undefined;
    }
    return cur;
  }
  function applyLang(lang) {
    var dictAll = window.__SITE_TRANSLATIONS__ || {};
    var dict = dictAll[lang] || {};
    document.documentElement.setAttribute("lang", lang);

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute("data-i18n");
      var v = deepGet(dict, k) || deepGet(dictAll[allowed[0]] || {}, k);
      if (typeof v === "string") nodes[i].textContent = v;
    }
    var attrs = [
      { attr: "placeholder", key: "data-i18n-placeholder" },
      { attr: "title", key: "data-i18n-title" },
      { attr: "aria-label", key: "data-i18n-aria" }
    ];
    for (var a = 0; a < attrs.length; a++) {
      var list = document.querySelectorAll("[" + attrs[a].key + "]");
      for (var j = 0; j < list.length; j++) {
        var kk = list[j].getAttribute(attrs[a].key);
        var vv = deepGet(dict, kk) || deepGet(dictAll[allowed[0]] || {}, kk);
        if (typeof vv === "string") list[j].setAttribute(attrs[a].attr, vv);
      }
    }

    // Update switcher active state
    var s = document.querySelectorAll("[data-lang-switch] ");
    for (var x = 0; x < s.length; x++) {
      var code = s[x].getAttribute("data-lang-switch");
      if (norm(code) === lang) s[x].classList.add("lang-active");
      else s[x].classList.remove("lang-active");
    }
  }
  function ensureSwitcher(currentLang) {
    var header = document.querySelector("header") || document.querySelector(".header") || null;
    var mount = header || document.body;
    if (!mount) return;

    if (mount.querySelector(".language-switcher")) return;

    var wrap = document.createElement("div");
    wrap.className = "language-switcher";
    wrap.innerHTML =
      '<a href="#" data-lang-switch="${lang1}">${lang1.toUpperCase()}</a><span>|</span><a href="#" data-lang-switch="${lang2}">${lang2.toUpperCase()}</a>';

    // Try place into nav if exists
    var nav = mount.querySelector("nav") || null;
    (nav || mount).appendChild(wrap);

    var links = wrap.querySelectorAll("[data-lang-switch]");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function (e) {
        e.preventDefault();
        var next = norm(this.getAttribute("data-lang-switch"));
        if (allowed.indexOf(next) === -1) return;
        setSaved(next);
        try {
          var url = new URL(window.location.href);
          url.searchParams.set("lang", next);
          window.history.replaceState({}, "", url.toString());
        } catch (_) {}
        applyLang(next);
      });
    }
    applyLang(currentLang);
  }

  var q = getFromQuery();
  var saved = getSaved();
  var lang = allowed.indexOf(q) !== -1 ? q : allowed.indexOf(saved) !== -1 ? saved : detectBrowserLang();
  setSaved(lang);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      ensureSwitcher(lang);
      applyLang(lang);
    });
  } else {
    ensureSwitcher(lang);
    applyLang(lang);
  }
})();
`;

  const out = [...files];
  if (!hasTranslationsJs) out.push({ path: "i18n/translations.js", content: defaultTranslations });
  if (!hasI18nJs) out.push({ path: "i18n/i18n.js", content: defaultI18n });

  // Ensure styles for switcher exist
  const cssPath = fileMap.has("styles.css") ? "styles.css" : fileMap.has("css/styles.css") ? "css/styles.css" : null;
  const cssSnippet = `\n\n/* Bilingual language switcher */\n.language-switcher{display:inline-flex;gap:10px;align-items:center;justify-content:flex-end;margin-left:16px;font-size:14px}\n.language-switcher a{text-decoration:none;opacity:.8}\n.language-switcher a:hover{opacity:1;text-decoration:underline}\n.language-switcher .lang-active{font-weight:700;opacity:1;text-decoration:underline}\n`;
  if (cssPath) {
    const css = fileMap.get(cssPath) as { path: string; content: string };
    if (!/\.language-switcher\b/.test(css.content)) {
      const idx = out.findIndex((f) => f.path.toLowerCase() === cssPath);
      if (idx >= 0) out[idx] = { ...out[idx], content: out[idx].content + cssSnippet };
    }
  }

  // Ensure scripts are referenced in all HTML pages
  return out.map((f) => {
    if (!/\.html?$/i.test(f.path)) return f;
    let c = f.content;
    if (!/i18n\/translations\.js/i.test(c)) {
      c = c.replace(/<\/body>/i, `  <script src="i18n/translations.js"></script>\n</body>`);
    }
    if (!/i18n\/i18n\.js/i.test(c)) {
      c = c.replace(/<\/body>/i, `  <script src="i18n/i18n.js" defer></script>\n</body>`);
    }
    return c === f.content ? f : { ...f, content: c };
  });
}
// ============ END PHONE NUMBER VALIDATION ============

const SYSTEM_PROMPT = `You are a prompt refiner for professional, multi-page websites.

Your job:
- Analyze the user's request
- Extract the required pages/sections, brand details, geo/country, and contact info
- Produce a clear GENERATION BRIEF that a separate website generator will follow

LANGUAGE (CRITICAL, NON-NEGOTIABLE):
- If the user explicitly specifies a language (e.g. "Language: EN", "Мова: українська", "Язык: русский"), set TARGET_LANGUAGE to that exact language/code.
- Otherwise infer from the language of the user's message.
- If still unclear, default to EN.
- IMPORTANT: Do NOT "default" to Ukrainian unless explicitly requested.

OUTPUT RULES:
- Write the brief itself in ENGLISH (meta-instructions), but keep TARGET_LANGUAGE exactly as determined.
- Do NOT translate the user's business content; only describe what to generate.

Return ONLY this structure:
TARGET_LANGUAGE: <value>
SITE_NAME: <value if present>
GEO/COUNTRY: <value if present>
PAGES:
- <page 1>
- <page 2>
DESIGN:
- style: <summary>
- colors: <summary>
CONTENT:
- key offerings: <bullets>
- primary CTAs: <bullets>
CONTACT:
- phone: <required format + must be clickable tel: link>
- email: <if present + must be clickable mailto: link>
- address: <if present>
`.trim();

// 10 unique layout variations for randomization or manual selection
const LAYOUT_VARIATIONS = [
  {
    id: "classic",
    name: "Classic Corporate",
    description: `LAYOUT STYLE: Classic Corporate
- Hero: Full-width hero with centered content, large background image with dark overlay
- Sections: Alternating left-right content blocks with images
- Features: 3-column grid of cards with icons on top
- Testimonials: Carousel-style slider with large quotes
- CTA: Full-width banner with gradient background
- Footer: 4-column layout with newsletter subscription`
  },
  {
    id: "asymmetric",
    name: "Modern Asymmetric",
    description: `LAYOUT STYLE: Modern Asymmetric
- Hero: Split-screen layout - 60% text left, 40% large image right with overlap effect
- Sections: Asymmetric grid with varying column widths (2:1, 1:2 ratio)
- Features: Staggered cards with alternating sizes, some overlapping
- Testimonials: Large single testimonial with portrait photo offset to corner
- CTA: Diagonal section divider with angled background
- Footer: Minimalist 2-column with large logo`
  },
  {
    id: "editorial",
    name: "Editorial Magazine",
    description: `LAYOUT STYLE: Editorial Magazine
- Hero: Minimal text-only hero with huge typography, small accent image in corner
- Sections: Newspaper-style multi-column layout with pull quotes
- Features: Masonry grid with varying heights and widths
- Testimonials: Inline quotes styled as editorial callouts with decorative quotation marks
- CTA: Text-heavy with minimal button, focus on copywriting
- Footer: Single-line footer with horizontal link list`
  },
  {
    id: "bold",
    name: "Bold Blocks",
    description: `LAYOUT STYLE: Bold Blocks
- Hero: Full-viewport hero with video or animated background, text at bottom
- Sections: Large full-width color blocks alternating between content types
- Features: Single row horizontal scroll cards on mobile, grid on desktop
- Testimonials: Full-width color section with centered large text
- CTA: Sticky bottom bar that appears on scroll
- Footer: Compact dark footer with social icons prominent`
  },
  {
    id: "minimalist",
    name: "Minimalist Zen",
    description: `LAYOUT STYLE: Minimalist Zen
- Hero: Lots of whitespace, small centered text with subtle line animations
- Sections: Single column centered layout with generous margins (max-width: 800px)
- Features: Vertical stack with large icons and minimal text
- Testimonials: Simple italic text with em-dash attribution, no photos
- CTA: Subtle underlined text link instead of button
- Footer: Ultra-minimal with only essential links`
  },
  {
    id: "showcase",
    name: "Dynamic Showcase",
    description: `LAYOUT STYLE: Dynamic Showcase
- Hero: Image gallery/slideshow hero with thumbnails below
- Sections: Card-heavy layout with hover effects revealing more content
- Features: Hexagonal or circular icon grid with connecting lines
- Testimonials: Grid of small cards with photos and star ratings
- CTA: Floating action button that follows scroll
- Footer: Multi-level footer with expandable sections on mobile`
  },
  {
    id: "gradient",
    name: "Gradient Flow",
    description: `LAYOUT STYLE: Gradient Flow
- Hero: Animated gradient background with floating geometric shapes
- Sections: Smooth color transitions between sections with wave dividers
- Features: Glassmorphism cards with blur effects and subtle borders
- Testimonials: Floating quote bubbles with gradient borders
- CTA: Pulsing gradient button with glow effect
- Footer: Dark footer with gradient accent line at top`
  },
  {
    id: "brutalist",
    name: "Brutalist Raw",
    description: `LAYOUT STYLE: Brutalist Raw
- Hero: Bold oversized typography, harsh contrasts, visible grid lines
- Sections: Exposed structure with visible borders and raw edges
- Features: Monospace font, numbered lists, stark black/white with one accent
- Testimonials: Plain text with quotation marks, no styling
- CTA: Thick bordered button with underline on hover
- Footer: Minimal with just copyright and essential links`
  },
  {
    id: "saas",
    name: "SaaS Product",
    description: `LAYOUT STYLE: SaaS Product
- Hero: Product screenshot mockup in browser frame, floating UI elements
- Sections: Feature comparison tables, pricing cards side by side
- Features: Icon + title + description in 2x3 grid with hover animations
- Testimonials: Company logos carousel + featured case study card
- CTA: Free trial button with "No credit card required" text
- Footer: Multi-column with product links, resources, company info`
  },
  {
    id: "portfolio",
    name: "Creative Portfolio",
    description: `LAYOUT STYLE: Creative Portfolio
- Hero: Full-screen image/video with name overlay and scroll indicator
- Sections: Case study cards with large thumbnails and project details
- Features: Skills as animated progress bars or tag clouds
- Testimonials: Client logos with expandable reviews
- CTA: "Let's work together" with contact form modal
- Footer: Social links prominent with simple copyright`
  }
];

const HTML_GENERATION_PROMPT = `CRITICAL: CREATE A PREMIUM, CONTENT-RICH PROFESSIONAL WEBSITE

🌐🌐🌐 LANGUAGE - FIRST PRIORITY - READ BEFORE ANYTHING ELSE! 🌐🌐🌐
**THE WEBSITE LANGUAGE IS SPECIFIED IN THE "TARGET WEBSITE LANGUAGE" SECTION BELOW!**
YOU MUST GENERATE ALL CONTENT IN THAT EXACT LANGUAGE - THIS IS THE #1 PRIORITY!

⏰⏰⏰ BUSINESS HOURS - MANDATORY IN EVERY FOOTER! ⏰⏰⏰
**EVERY PAGE FOOTER MUST INCLUDE BUSINESS HOURS IN THIS EXACT FORMAT:**
Monday - Friday: 9:00 AM - 6:00 PM
Saturday - Sunday: Closed

THIS IS NOT OPTIONAL! IF FOOTER HAS NO BUSINESS HOURS = BROKEN SITE!
Include under "Working Hours:" or "Business Hours:" label with icon.

⛔ LANGUAGE VIOLATIONS - THESE BREAK THE WEBSITE:
- Generating in Ukrainian when English was requested = BROKEN!
- Generating in English when German was requested = BROKEN!
- Mixing languages (English navigation with Ukrainian content) = BROKEN!
- Ignoring the language parameter = BROKEN!

✅ CORRECT BEHAVIOR:
- If language = "en" → ALL text in English (Home, About, Services, Contact, buttons, footer, everything!)
- If language = "de" → ALL text in German (Startseite, Über uns, Dienstleistungen, Kontakt, etc.)
- If language = "uk" → ALL text in Ukrainian (Головна, Про нас, Послуги, Контакти, etc.)
- If language = "pl" → ALL text in Polish (Strona główna, O nas, Usługi, Kontakt, etc.)
- And so on for ALL language codes!

LANGUAGE MUST BE CONSISTENT ACROSS:
- Navigation menu items
- All headings and paragraphs
- Button text
- Form labels and placeholders
- Footer content
- Cookie banner
- Privacy policy / Terms pages
- Meta tags (title, description)
- Image alt texts
- Error messages

**IF WEBSITE IS IN WRONG LANGUAGE = WEBSITE IS COMPLETELY BROKEN! CHECK LANGUAGE BEFORE GENERATING!**

🚨🚨🚨 REFERENCE QUALITY STANDARD - FOLLOW THIS STRUCTURE 🚨🚨🚨

⛔⛔⛔ TEXT CONTRAST - ABSOLUTELY CRITICAL - NO EXCEPTIONS! ⛔⛔⛔
**NEVER USE WHITE TEXT ON WHITE/LIGHT BACKGROUNDS!** This makes text INVISIBLE and BREAKS the website!

MANDATORY CONTRAST RULES:
- Light backgrounds (#fff, #f5f5f5, #fafafa, white, cream, beige, light-gray): Use DARK text (#333, #222, #1a1a1a, black)
- Dark backgrounds (#1a1a1a, #222, #333, black, navy, dark-blue): Use WHITE or LIGHT text (#fff, #f5f5f5)
- Hero sections with background images: ALWAYS add dark overlay (rgba(0,0,0,0.5)) before white text
- Cards on light pages: Use dark text (#333 or darker) - NEVER white!
- Buttons: Ensure button text contrasts with button background color

WRONG EXAMPLES (NEVER DO THIS):
❌ White text on white background: color: #fff; background: #ffffff;
❌ Light gray text on white: color: #ccc; background: #fff;
❌ White text on light section without overlay
❌ Hero with white text but no dark overlay on image

CORRECT EXAMPLES:
✅ Dark text on light: color: #333; background: #f5f5f5;
✅ White text on dark: color: #fff; background: #1a1a1a;
✅ Hero with overlay: background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(image.jpg); color: #fff;

**IF TEXT IS UNREADABLE = WEBSITE IS BROKEN!**

👤👥🚨 TEAM/STAFF PORTRAITS - MANDATORY HUMAN PHOTOS! 🚨👥👤
**When creating ANY section with people (Team, Staff, Employees, About Us with team, Testimonials with photos):**

YOU MUST USE REAL HUMAN PORTRAIT PHOTOS FROM PEXELS! These are VERIFIED working URLs:

MALE PORTRAITS (use these exact URLs):
- https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/2380794/pexels-photo-2380794.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop

FEMALE PORTRAITS (use these exact URLs):
- https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop

⛔ NEVER USE FOR PEOPLE:
- picsum.photos - these are RANDOM images, not faces!
- Placeholder URLs with random numbers
- Abstract images, icons, or silhouettes
- Any URL that doesn't show a real human face

✅ MANDATORY FOR TEAM SECTIONS:
- Alternate male/female portraits (CEO: male, CFO: female, CTO: male, etc.)
- Each team member card: photo + name + job title + short bio
- Photos must be circular or rounded with consistent sizing
- Use different portrait URLs for each person (never repeat same photo!)

**IF TEAM SECTION HAS NO REAL FACE PHOTOS = WEBSITE IS BROKEN!**

📞📧🚨 CONTACT INFO - ABSOLUTELY MANDATORY - READ FIRST! 🚨📧📞
EVERY website MUST have a REAL phone number and email. NO EXCEPTIONS!

🚨🚨🚨 PHONE NUMBERS - WHERE THEY BELONG (CRITICAL!) 🚨🚨🚨
Phone numbers should ONLY appear in these locations:
1. Footer contact section (visible text + tel: link)
2. Contact page contact info
3. Inside <a href="tel:..."> links

⛔⛔⛔ PHONE NUMBERS MUST NEVER APPEAR IN: ⛔⛔⛔
- Image URLs (src="https://..." MUST NEVER contain phone-like digits!)
- CSS classes or IDs
- JavaScript code
- File names
- Pexels/Unsplash URLs (use proper photo IDs like "3184418", NOT phone numbers!)
- Any URL or path

CORRECT IMAGE URL: src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg"
WRONG IMAGE URL: src="https://images.pexels.com/photos/+49 30 435/pexels-photo-+49 30 217.jpeg" ❌

**PHONE NUMBER - REQUIRED IN FOOTER ONLY:**
- MUST appear in FOOTER on ALL pages (NOT in header!)
- MUST be realistic for the country/GEO (see examples below)
- MUST be clickable (tel:): <a href="tel:+493028976543">+49 30 2897 6543</a>
- The visible text MUST include the country code with "+" and spacing (never a bare local number)
- MUST be at least 10 digits total (excluding spaces, parentheses, dashes)
- NEVER output only the local part like "4567890" or "123456" (this is INVALID)
- NEVER use fake/placeholder patterns: 123456, 4567890, 555-1234, XXX, 000000, 999999, (555)
- ⚠️ CRITICAL: NEVER DUPLICATE THE COUNTRY CODE! 
  * WRONG: "+49 +49 30...", "+353 1 +49 30...", "++49", "+353+353"
  * CORRECT: "+49 30 2897 6543" (ONE country code only!)
- ⚠️ NEVER MIX COUNTRY CODES! Pick ONE country code and use it consistently!
- Examples by country (pick ONE and format similarly):
  * Germany: +49 30 2897 6543, +49 89 4521 7892
  * Poland: +48 22 593 27 41, +48 12 784 63 19
  * Spain: +34 912 643 781, +34 932 815 604
  * France: +33 1 42 68 53 21, +33 4 93 45 67 12
  * Italy: +39 06 8745 6321, +39 02 7654 3219
  * UK: +44 20 7946 0958, +44 161 496 0753
  * USA: +1 (212) 647-3812, +1 (415) 781-2046
  * Netherlands: +31 20 794 5682, +31 10 593 2741
  * Czech Republic: +420 221 643 781, +420 257 815 604
  * Ireland: +353 1 234 5678, +353 21 987 6543
  * Ukraine: +380 44 239 4187, +380 67 381 2046
  * Russia: +7 495 239 4187, +7 812 381 2046
  * Austria: +43 1 239 4187, +43 512 381 204

**EMAIL - REQUIRED IN FOOTER ONLY:**
- MUST appear in FOOTER on ALL pages (NOT in header!)
- MUST use the site's domain: info@<sitename>.com, contact@<sitename>.com
- Extract domain from business name (lowercase, no spaces, no special chars)
- MUST be clickable: <a href="mailto:info@sitename.com">info@sitename.com</a>
- NEVER use generic emails like info@company.com or test@example.com

**BUSINESS HOURS - REQUIRED IN FOOTER (EXACT FORMAT):**
- MUST appear in FOOTER on ALL pages
- USE THIS EXACT FORMAT (two lines):
  Line 1: Monday - Friday: 9:00 AM - 6:00 PM
  Line 2: Saturday - Sunday: Closed
- This is the ONLY acceptable format for business hours!
- For non-English sites, translate the day names appropriately but keep the same structure:
  * German: Montag - Freitag: 9:00 - 18:00 / Samstag - Sonntag: Geschlossen
  * French: Lundi - Vendredi: 9h00 - 18h00 / Samedi - Dimanche: Fermé
  * Spanish: Lunes - Viernes: 9:00 - 18:00 / Sábado - Domingo: Cerrado
- Include label "Working Hours:" or "Business Hours:" (translated appropriately)
- HTML example:
  <div class="footer-hours">
    <strong>Working Hours:</strong><br>
    Monday - Friday: 9:00 AM - 6:00 PM<br>
    Saturday - Sunday: Closed
  </div>

⚠️ IF NO PHONE/EMAIL/HOURS IN OUTPUT = SITE IS BROKEN! ALWAYS INCLUDE THEM!

**🎯 CENTERING & LAYOUT - ABSOLUTELY CRITICAL:**
ALL content MUST be centered on the page:
- Use max-width: 1200px for main container
- Use margin: 0 auto for centering
- All grids must be centered within container
- Cards should be in clean 3-column grid (2 on tablet, 1 on mobile)
- Light background (#f0f9f0 or similar) for card sections
- Section headers centered with text-align: center

**MANDATORY PAGE STRUCTURE (index.html must have ALL of these):**
1. Header with navigation ONLY (NO phone/email in header! centered nav, max-width container)
2. Hero section (split layout: text + image side by side, centered)
3. Stats/metrics section with big numbers (3-4 stats, centered)
4. Featured cards section (6 cards in 3x2 grid, CENTERED, with "Read More" buttons)
5. Media object section (text + image side by side, centered)
6. Timeline/process steps section (4 numbered steps, centered)
7. Contact/CTA form section (centered) - WITH PHONE AND EMAIL displayed
8. Footer with PHONE, EMAIL, ADDRESS (centered content)

**EVERY SECTION MUST HAVE:**
- Section label (small badge above title): <span class="section-label">Section Topic</span>
- Main heading: <h2>Clear compelling title</h2>
- Description paragraph: <p>Detailed explanation...</p>
- Actual content (lists, cards, stats, forms)
- ALL CONTENT CENTERED IN max-width CONTAINER

🎯 **CONTENT DENSITY REQUIREMENTS:**
- Homepage MUST have 6+ content sections
- Each section MUST have 100+ words of real text
- Cards MUST have title + description + meta info + "Read More" button
- Lists MUST have 3+ bullet points with full sentences
- Stats MUST have 3+ metrics with numbers and labels
- CONTACT INFO (phone + email) MUST be visible on every page

**MANDATORY HERO STRUCTURE (SPLIT LAYOUT) - FOLLOW EXACTLY:**
\`\`\`html
<section class="page-hero homepage-hero">
  <div class="hero-inner">
    <div class="hero-copy">
      <span class="badge">Tagline here</span>
      <h1>Main headline that explains value proposition clearly.</h1>
      <p>Detailed paragraph explaining what you do, who you help, and why it matters. This should be 2-3 sentences minimum.</p>
      <div class="hero-actions">
        <a class="cta-button" href="contact.html">Primary Action</a>
        <a class="button-outline" href="services.html">Secondary Action</a>
      </div>
      <div class="tag-pills">
        <span>Feature 1</span>
        <span>Feature 2</span>
        <span>Feature 3</span>
        <span>Feature 4</span>
      </div>
    </div>
    <div class="hero-visual">
      <img src="https://picsum.photos/seed/hero-main/820/580" alt="Hero visual">
    </div>
  </div>
</section>
\`\`\`

🚨 **HERO CRITICAL RULES - NO EXCEPTIONS:**
- The page-hero section MUST NOT have style="" attribute
- The page-hero section MUST NOT have background-image
- ONLY ONE class="" attribute per element - NEVER duplicate class attributes
- The ONLY image in hero is inside hero-visual div as an <img> tag
- hero-visual MUST contain EXACTLY ONE <img> element, nothing else

**MANDATORY STATS SECTION:**
\`\`\`html
<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-label">Key Metrics</span>
      <h2>Compelling headline about achievements</h2>
      <p>Brief description of what these numbers mean.</p>
    </div>
    <div class="stats-highlight">
      <ul class="highlight-list">
        <li>First key point with detailed explanation.</li>
        <li>Second key point with detailed explanation.</li>
        <li>Third key point with detailed explanation.</li>
      </ul>
      <div class="stats-numbers">
        <div><div class="stat-number">€4.6B</div><div class="stat-caption">Metric description</div></div>
        <div><div class="stat-number">72 hrs</div><div class="stat-caption">Metric description</div></div>
        <div><div class="stat-number">98%</div><div class="stat-caption">Metric description</div></div>
      </div>
    </div>
  </div>
</section>
\`\`\`

**MANDATORY CARDS GRID (CENTERED, BEAUTIFUL):**
\`\`\`html
<section class="section light">
  <div class="section-inner centered">
    <div class="section-header centered">
      <span class="section-label">Services</span>
      <h2>What we offer</h2>
      <p>Brief intro to services.</p>
    </div>
    <div class="cards-grid">
      <article class="card">
        <h3>Service Title</h3>
        <p>Detailed description of service with real information.</p>
        <div class="card-meta"><span class="meta-tag">Category</span> | <span class="meta-date">Published Date</span></div>
        <a href="#" class="card-button">Read More</a>
      </article>
      <!-- 5 more cards for 6 total, or 3x2 grid -->
    </div>
  </div>
</section>
\`\`\`

**🎯 CARD GRID CENTERING - CRITICAL CSS:**
\`\`\`css
/* CENTERED CONTAINER FOR ALL CONTENT */
.section-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-inner.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-header.centered {
  text-align: center;
  max-width: 700px;
  margin-bottom: 48px;
}

/* BEAUTIFUL CENTERED CARD GRID */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 992px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}

/* BEAUTIFUL CARD STYLING */
.card {
  background: white;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.04);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}

.card h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-dark);
}

.card p {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 16px;
  flex-grow: 1;
}

.card-meta {
  font-size: 0.85rem;
  color: var(--primary-color);
  margin-bottom: 16px;
}

.meta-tag, .meta-date {
  font-weight: 500;
}

.card-button {
  display: inline-block;
  padding: 12px 24px;
  border: 2px solid var(--primary-color);
  border-radius: 8px;
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: all 0.3s ease;
  align-self: flex-start;
}

.card-button:hover {
  background: var(--primary-color);
  color: white;
}
\`\`\`

**MANDATORY MEDIA OBJECT (TEXT + IMAGE):**
\`\`\`html
<section class="section">
  <div class="section-inner">
    <div class="media-object">
      <div class="media-copy">
        <span class="section-label">About</span>
        <h3>Compelling headline about approach</h3>
        <p>Detailed paragraph about methodology and approach.</p>
        <ul>
          <li>Key benefit with explanation.</li>
          <li>Second benefit with explanation.</li>
          <li>Third benefit with explanation.</li>
        </ul>
        <div class="cta-buttons">
          <a class="cta-button" href="about.html">Learn More</a>
        </div>
      </div>
      <div class="media-visual">
        <img src="https://picsum.photos/seed/about-img/760/560" alt="Description">
      </div>
    </div>
  </div>
</section>
\`\`\`

**MANDATORY TIMELINE/PROCESS:**
\`\`\`html
<section class="section light">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-label">Process</span>
      <h2>How we work</h2>
    </div>
    <div class="timeline">
      <div class="timeline-step">
        <h3>1 · Step Title</h3>
        <p>Detailed description of this step.</p>
      </div>
      <!-- 3-4 steps -->
    </div>
  </div>
</section>
\`\`\`

**MANDATORY CONTACT FORM:**
\`\`\`html
<section class="section">
  <div class="section-inner">
    <div class="section-header">
      <span class="section-label">Contact</span>
      <h2>Get in touch</h2>
      <p>Description of what happens when they contact.</p>
    </div>
    <div class="form-card">
      <form class="form-grid">
        <div class="form-grid two-columns">
          <div class="form-group"><label>Name</label><input type="text" required></div>
          <div class="form-group"><label>Email</label><input type="email" required></div>
        </div>
        <div class="form-group"><label>Message</label><textarea required></textarea></div>
        <button type="submit" class="cta-button">Submit</button>
      </form>
    </div>
  </div>
</section>
\`\`\`

🚨 **IMAGE RULES - CRITICAL FOR PREVENTING OVERLAP:**
- Hero: Use SINGLE <img> inside hero-visual div, max 820x580
- Section images: SINGLE <img> inside media-visual div, max 760x560
- Card images: NOT required, cards are text-based
- Use picsum.photos/seed/[unique-name]/WxH for consistent images
- NEVER full-screen images (no 100vw, 100vh)
- NEVER use position:absolute on images
- NEVER place multiple images in the same container
- NEVER use background-image combined with <img> tag in same element
- Each image container (.hero-visual, .media-visual) must have ONLY ONE <img> child

🎯 **IMAGE THEME MATCHING - ALL IMAGES MUST FIT THE WEBSITE TOPIC:**
- EVERY image MUST be relevant to the website's industry/theme/topic!
- Use descriptive seed names that match content: seed/medical-team, seed/car-repair, seed/restaurant-food
- Examples by industry:
  * Medical/Clinic: doctors, medical equipment, patients, hospital rooms
  * Restaurant/Food: dishes, kitchen, dining area, chefs
  * Auto/Car services: cars, mechanics, garage, car parts
  * Legal/Law: office, courthouse, lawyers, documents
  * Real Estate: houses, apartments, interiors, architecture
  * Construction: buildings, workers, equipment, sites
  * Beauty/Spa: treatments, salon, cosmetics, relaxation
  * Fitness/Sport: gym, training, athletes, equipment
- NEVER use random unrelated images!
- Image seeds should describe the actual content: seed/kitchen-chef, seed/legal-office, seed/gym-training

👥 **TEAM/STAFF SECTIONS - MANDATORY PORTRAIT PHOTOS:**
- When creating Team, Staff, About Us, or Employee sections - MUST use REAL portrait photos of people!
- NEVER use random picsum images for team members - they need actual human face photos!
- Use verified Pexels portrait IDs (see IMAGE_STRATEGY section for exact URLs)
- Alternate between male and female portraits for realistic teams
- Each team member card MUST have: photo, name, job title/role

🚫 **ABSOLUTE PROHIBITION - IMAGE OVERLAP:**
- NEVER generate an <img> tag on top of another <img>
- NEVER use CSS that positions one image over another
- NEVER use ::before or ::after pseudo-elements with background-image near <img> tags
- Each visual container must have exactly ONE image source, not multiple

**❌ WHAT NEVER TO DO - ABSOLUTE PROHIBITIONS:**
- Empty pages or sections
- Plain unstyled text without structure
- Missing section labels
- Cards without descriptions
- Forms without proper labels
- Lists with only 1-2 items
- Sections without section-header
- Images without proper sizing constraints
- MULTIPLE IMAGES IN SAME CONTAINER
- OVERLAPPING IMAGES
- Using style="background-image:..." on page-hero section
- Duplicate class="" attributes on any element (class="x" class="y" is INVALID HTML)
- Adding inline styles to hero sections
- Using background-image AND <img> tag in the same visual context

**🚫 HTML SYNTAX RULES - NEVER VIOLATE:**
- Each HTML element can have ONLY ONE class attribute
- WRONG: <section class="page-hero" style="..." class="another">
- CORRECT: <section class="page-hero homepage-hero">
- page-hero sections must NOT have style="" attribute at all

**🎨 CRITICAL DESIGN RULES - UNIQUE STYLING FOR EACH SITE:**

**IMPORTANT: Each website MUST have UNIQUE visual identity!**
- Generate a UNIQUE color palette based on the industry/theme (medical = blues/greens, food = warm colors, tech = modern blues, luxury = golds/blacks)
- Choose border-radius style that fits the brand (corporate = subtle 8-12px, playful = 20px+, brutalist = 0px, modern = 16px)
- Vary shadow styles (soft subtle shadows for elegance, sharp shadows for modern, no shadows for minimalist)
- Mix up section backgrounds (some sites: alternating white/gray, others: gradient sections, others: solid color accents)

**CSS VARIABLES - GENERATE UNIQUE PALETTE BASED ON THEME:**
\`\`\`css
:root {
  /* Generate UNIQUE colors based on industry/theme! Examples: */
  /* Medical/Health: --primary-color: #0891b2; --accent-color: #06b6d4; */
  /* Legal/Finance: --primary-color: #1e3a5f; --accent-color: #3b82f6; */
  /* Food/Restaurant: --primary-color: #b91c1c; --accent-color: #ef4444; */
  /* Eco/Nature: --primary-color: #166534; --accent-color: #22c55e; */
  /* Tech/Startup: --primary-color: #4f46e5; --accent-color: #818cf8; */
  /* Luxury/Premium: --primary-color: #78350f; --accent-color: #d97706; */
  
  --primary-color: [CHOOSE BASED ON THEME];
  --primary-dark: [DARKER VARIANT];
  --secondary-color: [COMPLEMENTARY];
  --text-dark: #1a1a1a;
  --text-light: #666666;
  --text-muted: #888888;
  --bg-light: [LIGHT TINT OF PRIMARY];
  --bg-white: #ffffff;
  --border-color: [SUBTLE BORDER];
  --shadow-sm: [CHOOSE STYLE];
  --shadow-md: [CHOOSE STYLE];
  --shadow-lg: [CHOOSE STYLE];
  --radius-sm: [8px OR 0 OR 16px - CHOOSE];
  --radius-md: [12px OR 0 OR 20px - CHOOSE];
  --radius-lg: [20px OR 0 OR 30px - CHOOSE];
  --transition: all 0.3s ease;
  --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
\`\`\`

**BASE RESET & TYPOGRAPHY:**
\`\`\`css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-main);
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-dark);
  background: var(--bg-white);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-dark);
}

h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.5rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.75rem); }

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: var(--transition);
}

a:hover {
  color: var(--primary-dark);
}
\`\`\`

**HEADER & NAVIGATION - PREMIUM STYLING:**
\`\`\`css
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.header.scrolled {
  background: rgba(255,255,255,0.98);
  box-shadow: var(--shadow-md);
}

.nav {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-dark);
}

.nav-links {
  display: flex;
  gap: 32px;
  list-style: none;
}

.nav-links a {
  font-weight: 500;
  color: var(--text-dark);
  padding: 8px 0;
  position: relative;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--primary-color);
  transition: var(--transition);
}

.nav-links a:hover::after,
.nav-links a.active::after {
  width: 100%;
}

/* Mobile menu button */
.nav-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.nav-toggle span {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--text-dark);
  margin: 6px 0;
  transition: var(--transition);
}

@media (max-width: 768px) {
  .nav-toggle { display: block; }
  .nav-links {
    position: absolute;
    top: 70px;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    padding: 20px;
    gap: 16px;
    box-shadow: var(--shadow-md);
    display: none;
  }
  .nav-links.active { display: flex; }
}
\`\`\`

**BUTTONS - PREMIUM DESIGN:**
\`\`\`css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
}

.btn-secondary {
  background: transparent;
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
}

.btn-secondary:hover {
  background: var(--primary-color);
  color: white;
}

.btn-white {
  background: white;
  color: var(--text-dark);
}

.btn-white:hover {
  background: var(--bg-light);
  transform: translateY(-2px);
}
\`\`\`

**🚨🚨🚨 IMAGE SIZING - ABSOLUTELY CRITICAL - NEVER FULL-SCREEN 🚨🚨🚨:**

**RULES FOR IMAGE SIZES (STRICTLY FOLLOW):**
1. Images must NEVER be full-width or full-screen (no 100vw, no width: 100%)
2. All images must be CONTEXTUAL - sized appropriately for their content role
3. Card images: max 400px height, contained within card boundaries
4. Hero: background-image with overlay, NOT full-screen photos
5. Section images: max-width 600px, centered or alongside text
6. Gallery images: uniform size in grid, max 350px each

\`\`\`css
/* BASE IMAGE CONSTRAINTS - NEVER REMOVE */
img {
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

/* HERO - CONTROLLED HEIGHT, NEVER FULL-SCREEN PHOTO */
.hero {
  min-height: 60vh;
  max-height: 70vh; /* STRICT LIMIT - never full viewport */
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  position: relative;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%);
}

.hero-content {
  position: relative;
  z-index: 1;
  color: white;
  max-width: 700px;
}

/* CARD IMAGES - FIXED HEIGHT, NEVER OVERSIZED */
.card-image, .service-card img, .feature-img {
  width: 100%;
  height: 200px; /* FIXED - never bigger */
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* SECTION IMAGES - CONSTRAINED */
.section-image, .about-image, .content-image {
  max-width: 500px;
  height: auto;
  max-height: 350px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* AVATARS - SMALL AND UNIFORM */
.avatar, .team-photo, .testimonial-img {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  object-fit: cover;
}

/* GALLERY - UNIFORM GRID */
.gallery-item img {
  width: 100%;
  height: 220px; /* FIXED height */
  max-height: 220px;
  object-fit: cover;
  border-radius: var(--radius-md);
}

/* PARTNER LOGOS - SMALL */
.partner-logo, .client-logo {
  height: 40px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
  filter: grayscale(100%);
  opacity: 0.6;
  transition: var(--transition);
}

.partner-logo:hover {
  filter: grayscale(0);
  opacity: 1;
}

/* PREVENT OVERSIZED IMAGES */
section img:not(.avatar):not(.partner-logo):not(.client-logo) {
  max-height: 400px;
}
\`\`\`

**🎨 CONSISTENT STYLING - ALL SECTIONS MUST MATCH:**

**CRITICAL RULE: Every page section must follow the SAME design language:**
1. ALL cards must have IDENTICAL styling (same border-radius, shadow, padding)
2. ALL sections must have UNIFORM spacing (80px padding top/bottom)
3. ALL text elements must follow typography hierarchy
4. NO mixing of styled cards with plain lists - use cards OR styled lists
5. Newsletter/CTA sections must have proper background styling

\`\`\`css
/* CONSISTENT SECTION STYLING */
.section {
  padding: 80px 0;
}

.section.bg-light {
  background: var(--bg-light);
}

.section.bg-dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}

/* CONSISTENT CARD STYLING - ALL CARDS IDENTICAL */
.card, .service-card, .feature-card, .category-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid rgba(0,0,0,0.05);
}

.card:hover, .service-card:hover, .feature-card:hover, .category-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}

/* CATEGORY/LIST SECTIONS - MUST BE STYLED AS CARDS */
.category-list, .services-list, .features-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.category-item, .service-item, .feature-item {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border-left: 4px solid var(--primary-color);
  transition: all 0.3s ease;
}

.category-item:hover, .service-item:hover, .feature-item:hover {
  transform: translateX(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.category-item h3, .service-item h3, .feature-item h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-dark);
}

.category-item p, .service-item p, .feature-item p {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.5;
}

/* NEWSLETTER/CTA SECTIONS - PROPERLY STYLED */
.newsletter-section, .cta-section, .subscribe-section {
  background: linear-gradient(135deg, var(--bg-light) 0%, #e8f4f8 100%);
  padding: 60px 0;
  text-align: center;
  border-radius: 0;
}

.newsletter-section .container, .cta-section .container {
  max-width: 700px;
}

.newsletter-form, .subscribe-form {
  display: flex;
  gap: 12px;
  max-width: 500px;
  margin: 24px auto 0;
  flex-wrap: wrap;
  justify-content: center;
}

.newsletter-form input, .subscribe-form input {
  flex: 1;
  min-width: 250px;
  padding: 14px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 1rem;
}

.newsletter-form button, .subscribe-form button {
  padding: 14px 28px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.newsletter-form button:hover, .subscribe-form button:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
}
\`\`\`

**❌ WHAT NOT TO DO (NEVER GENERATE LIKE THIS):**
- Plain text lists without styling (Energy, Infrastructure, Technology as plain text)
- Sections with inconsistent backgrounds
- Cards with different border-radius values
- Images that are too large or too small
- Newsletter sections with basic unstyled inputs
- Mixed styling within same page
- **PLAIN/UNSTYLED FORM FIELDS** (raw input, select, textarea without styling)
- Browser-default form elements without custom borders/backgrounds/radius

**✅ WHAT TO DO:**
- All categories/services in styled cards with icons or borders
- Consistent 80px section padding throughout
- Uniform card styling with shadows and hover effects
- Properly sized images (200-400px height max)
- Styled newsletter with gradient background
- **ALL form elements (input, select, textarea) MUST have:**
  - Custom border (1px solid with theme color)
  - Rounded corners (border-radius from theme)
  - Padding (12-16px)
  - Background color (white or theme background)
  - Focus state with box-shadow
  - Consistent font-family and font-size

**SECTIONS & CONTAINERS:**
\`\`\`css
section {
  padding: 80px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 50px;
}

.section-title {
  margin-bottom: 16px;
}

.section-subtitle {
  color: var(--text-light);
  font-size: 1.1rem;
}

.bg-light {
  background: var(--bg-light);
}
\`\`\`

**CARDS & GRIDS:**
\`\`\`css
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }

@media (max-width: 992px) {
  .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 576px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
}

.card {
  background: white;
  border-radius: var(--radius-lg);
  overflow: visible;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}

.card-body {
  padding: 24px;
  overflow: visible;
}

.card-title {
  font-size: 1.2rem;
  margin-bottom: 12px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.card-text {
  color: var(--text-light);
  font-size: 0.95rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
\`\`\`

**FORMS:**
\`\`\`css
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-dark);
}

.form-control {
  width: 100%;
  padding: 14px 18px;
  font-size: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: var(--transition);
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

textarea.form-control {
  resize: vertical;
  min-height: 140px;
}
\`\`\`

**🦶 PREMIUM FOOTER DESIGN - ABSOLUTELY MANDATORY:**
Footer MUST be professional, compact, and well-structured:

\`\`\`css
/* PREMIUM FOOTER STYLES */
.footer {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0;
  padding: 60px 0 30px;
  margin-top: 80px;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-brand {
  max-width: 280px;
}

.footer-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 16px;
  display: block;
}

.footer-description {
  font-size: 0.9rem;
  line-height: 1.6;
  color: #a0a0a0;
  margin-bottom: 20px;
}

.footer-heading {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links li {
  margin-bottom: 12px;
}

.footer-links a {
  color: #a0a0a0;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.footer-links a:hover {
  color: white;
}

.footer-contact-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 0.9rem;
  color: #a0a0a0;
}

.footer-contact-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent-color, #3b82f6);
}

.footer-social {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.footer-social a {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.3s ease;
}

.footer-social a:hover {
  background: var(--accent-color, #3b82f6);
  transform: translateY(-3px);
}

.footer-divider {
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 30px 0;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.footer-copyright {
  font-size: 0.85rem;
  color: #707070;
}

.footer-legal-links {
  display: flex;
  gap: 24px;
}

.footer-legal-links a {
  font-size: 0.85rem;
  color: #707070;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-legal-links a:hover {
  color: white;
}

@media (max-width: 992px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 576px) {
  .footer-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .footer-brand {
    max-width: 100%;
  }
  .footer-bottom {
    flex-direction: column;
    text-align: center;
  }
  .footer-social {
    justify-content: center;
  }
}
\`\`\`

**FOOTER HTML STRUCTURE (USE THIS EXACT STRUCTURE):**
\`\`\`html
<footer class="footer">
  <div class="footer-container">
    <div class="footer-grid">
      <!-- Brand Column -->
      <div class="footer-brand">
        <span class="footer-logo">Company Name</span>
        <p class="footer-description">Brief company description in 2-3 sentences. Professional and concise.</p>
        <div class="footer-social">
          <a href="#" aria-label="Facebook"><svg>...</svg></a>
          <a href="#" aria-label="Instagram"><svg>...</svg></a>
          <a href="#" aria-label="LinkedIn"><svg>...</svg></a>
        </div>
      </div>
      
      <!-- Quick Links -->
      <div>
        <h4 class="footer-heading">Navigation</h4>
        <ul class="footer-links">
          <li><a href="index.html">Home</a></li>
          <li><a href="about.html">About</a></li>
          <li><a href="services.html">Services</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      
      <!-- Legal Links -->
      <div>
        <h4 class="footer-heading">Legal</h4>
        <ul class="footer-links">
          <li><a href="privacy.html">Privacy Policy</a></li>
          <li><a href="terms.html">Terms of Service</a></li>
          <li><a href="cookie-policy.html">Cookie Policy</a></li>
        </ul>
      </div>
      
      <!-- Contact Info - PHONE AND EMAIL ARE MANDATORY -->
      <div>
        <h4 class="footer-heading">Contact</h4>
        <div class="footer-contact-item">
          <svg>location icon</svg>
          <span>123 Business Street, City</span>
        </div>
        <div class="footer-contact-item">
          <svg>phone icon</svg>
          <!-- REPLACE WITH REALISTIC PHONE FOR YOUR GEO! Examples: +49 30 2897 6543, +48 22 456 78 90, +34 912 456 789 -->
          <a href="tel:+493028976543">+49 30 2897 6543</a>
        </div>
        <div class="footer-contact-item">
          <svg>email icon</svg>
          <!-- REPLACE WITH DOMAIN-BASED EMAIL! Use sitename from business name -->
          <a href="mailto:info@companyname.com">info@companyname.com</a>
        </div>
      </div>
    </div>
    
    <!-- Disclaimer -->
    <div class="disclaimer-section">
      <p><strong>Disclaimer:</strong> Adapted disclaimer text...</p>
    </div>
    
    <div class="footer-divider"></div>
    
    <div class="footer-bottom">
      <p class="footer-copyright">© 2024 Company Name. All rights reserved.</p>
      <div class="footer-legal-links">
        <a href="privacy.html">Privacy</a>
        <a href="terms.html">Terms</a>
      </div>
    </div>
  </div>
</footer>
\`\`\`

**📐 PAGE STRUCTURE - CENTERED SECTIONS (CRITICAL):**

\`\`\`css
/* GLOBAL CENTERING - APPLY TO ALL PAGES */
body {
  background: #f8faf8;
}

/* MAIN CONTAINER - ALWAYS CENTERED */
.container, .section-inner, .page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* CLEAN SECTION STRUCTURE */
section {
  padding: 80px 0;
}

section.light {
  background: #f0f9f0;
}

/* CENTERED SECTION HEADER */
.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 48px;
}

.section-label {
  display: inline-block;
  background: var(--primary-color, #059669);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.section-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--heading-color, #1a1a1a);
}

.section-subtitle {
  font-size: 1.1rem;
  color: var(--text-muted, #666);
  line-height: 1.6;
}

/* CARDS GRID - CENTERED 3-COLUMN LAYOUT */
.cards-grid, .featured-grid, .articles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 992px) {
  .cards-grid, .featured-grid, .articles-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .cards-grid, .featured-grid, .articles-grid {
    grid-template-columns: 1fr;
  }
}

/* BEAUTIFUL CARD STYLING */
.card {
  background: white;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.04);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}

.card h3, .card-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-dark, #1a1a1a);
}

.card p, .card-text {
  color: var(--text-muted, #666);
  line-height: 1.6;
  font-size: 0.95rem;
  margin-bottom: 16px;
  flex-grow: 1;
}

.card-meta {
  font-size: 0.85rem;
  color: var(--primary-color, #059669);
  margin-bottom: 16px;
  font-weight: 500;
}

/* READ MORE BUTTON */
.card-button, .read-more {
  display: inline-block;
  padding: 12px 24px;
  border: 2px solid var(--primary-color, #059669);
  border-radius: 8px;
  color: var(--primary-color, #059669);
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: all 0.3s ease;
  align-self: flex-start;
}

.card-button:hover, .read-more:hover {
  background: var(--primary-color, #059669);
  color: white;
}

/* SEARCH/FILTER SECTION */
.search-section {
  max-width: 600px;
  margin: 0 auto 48px;
  text-align: center;
}

.search-input {
  width: 100%;
  padding: 16px 24px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 16px;
}

.search-button {
  padding: 14px 32px;
  background: var(--primary-color, #059669);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

/* PAGINATION */
.pagination {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 48px;
}

.pagination a {
  padding: 8px 16px;
  color: var(--primary-color, #059669);
  text-decoration: none;
  font-weight: 500;
}

.pagination a.active {
  background: var(--primary-color, #059669);
  color: white;
  border-radius: 6px;
}
\`\`\`

**🌍 LANGUAGE COMPLIANCE - ABSOLUTELY MANDATORY:**
The website MUST be generated in the EXACT language specified:
- ALL text content MUST be in the specified language
- Button text, navigation, form labels - EVERYTHING in the correct language
- NEVER mix languages
- NEVER default to Ukrainian unless explicitly specified

**NAVIGATION LINKS - USE RELATIVE PATHS:**
- ALL links MUST use: href="about.html" NOT href="/about"
- ALWAYS include .html extension

**🍪 COOKIE CONSENT - MANDATORY:**
Include working cookie banner with localStorage:
\`\`\`javascript
document.addEventListener('DOMContentLoaded', function() {
  const cookieConsent = localStorage.getItem('cookieConsent');
  const banner = document.getElementById('cookie-banner');
  if (!cookieConsent && banner) {
    banner.style.display = 'flex';
  }
});
function acceptCookies() {
  localStorage.setItem('cookieConsent', 'accepted');
  document.getElementById('cookie-banner').style.display = 'none';
}
function declineCookies() {
  localStorage.setItem('cookieConsent', 'declined');
  document.getElementById('cookie-banner').style.display = 'none';
}
\`\`\`

**🚫 NUMBERS PROHIBITION:**
NEVER include prices, statistics, percentages, years of experience, client counts, etc.
ALLOWED: Phone numbers, postal codes, copyright year.
Use alternatives: "Contact for pricing", "Experienced team", "Many satisfied clients"

**📞 PHONE NUMBERS - MUST BE REALISTIC BY COUNTRY:**
- NEVER use fake numbers like 123456, 555-1234, or placeholder XXX
- Generate REALISTIC phone numbers based on GEO/COUNTRY:
  * Germany: +49 30 2897 6543, +49 89 4521 7890
  * Poland: +48 22 456 78 90, +48 12 345 67 89
  * Spain: +34 912 456 789, +34 932 876 543
  * France: +33 1 42 68 53 00, +33 4 93 45 67 89
  * Italy: +39 06 8745 6321, +39 02 7654 3210
  * UK: +44 20 7946 0958, +44 161 496 0753
  * USA: +1 (212) 555-0147, +1 (415) 555-0198
  * Netherlands: +31 20 794 5682, +31 10 456 7890
  * Czech Republic: +420 221 456 789, +420 257 891 234
  * Ukraine: +380 44 456 7890, +380 67 123 4567
  * Russia: +7 495 123 4567, +7 812 456 7890
  * Default international: Use the country code + realistic local format
- MUST be clickable: <a href="tel:+14155550147">+1 (415) 555-0147</a>

**📧 EMAILS - MUST MATCH SITE DOMAIN:**
- Email MUST use the site's domain name
- Format: info@<sitename>.com, contact@<sitename>.com, support@<sitename>.com
- Extract sitename from the business name (lowercase, no spaces, no special chars)
- Examples:
  * Business "Green Garden Services" → info@greengarden.com
  * Business "Auto Pro Center" → contact@autoprocenter.com
  * Business "Dr. Smith Clinic" → info@drsmithclinic.com
- MUST be clickable: <a href="mailto:info@sitename.com">info@sitename.com</a>
- NEVER use generic emails like info@company.com or test@example.com

**🙏 THANK YOU PAGE:**
Every site needs thank-you.html with success message and link back to homepage.

**🗺️ GOOGLE MAPS:**
Contact page MUST include working Google Maps embed matching the site's location.

**⚠️ DISCLAIMER:**
Include in footer, adapted to site's industry/theme.

**MANDATORY FILES:**
- index.html (hero + 6-8 quality sections with smooth animations)
- about.html (company story, mission, team, values sections)
- services.html (detailed services with cards, process steps, benefits)
- contact.html (form, map embed, working hours, multiple contact methods)
- thank-you.html (success message, next steps, back to home)
- privacy.html (EXACTLY 10 detailed sections with substantial content each - Introduction, Data We Collect, How We Use Data, Data Sharing, Data Security, Your Rights, Cookies, Third Parties, Data Retention, Contact & Changes)
- terms.html (EXACTLY 14 sections - Acceptance, Definitions, Services, User Accounts, Acceptable Use, Intellectual Property, User Content, Privacy, Disclaimers, Limitation of Liability, Indemnification, Termination, Changes, Governing Law)
- cookie-policy.html (What Are Cookies, Types We Use, Cookie Table with ALL cookies listed, How to Manage, Third-Party Cookies, Policy Updates)
- styles.css (600+ lines, premium design system with CSS variables, animations, responsive breakpoints)
- script.js (mobile menu, cookie banner, scroll animations, form validation)
- cookie-banner.js (separate file for cookie consent logic)
- robots.txt
- sitemap.xml

**QUALITY STANDARDS:**
- Each page must be SUBSTANTIAL - no empty or minimal pages
- Legal pages (privacy, terms, cookie) must each have 3000+ characters of real content
- All sections must have proper styling and spacing
- Mobile-first responsive design throughout
- Smooth hover effects and transitions
- Professional typography with proper hierarchy

**CSS MUST INCLUDE:**
- CSS variables in :root
- Image size constraints (CRITICAL!)
- Premium footer styles
- Mobile responsive breakpoints
- Card hover effects
- Form styling
- Cookie banner
- Smooth transitions

`.trim();

// Image strategy - Basic (reliable random photos)
const IMAGE_STRATEGY_BASIC = `
🚨🚨🚨 CRITICAL IMAGE RULES - MANDATORY 🚨🚨🚨

**USE picsum.photos FOR ALL IMAGES - THIS IS NON-NEGOTIABLE:**

**1. HERO VISUAL (NO background-image, NO inline style on hero section):**
Use the split hero with a single <img> inside .hero-visual:

\`\`\`html
<section class="page-hero homepage-hero">
  <div class="hero-inner">
    <div class="hero-copy">
      <span class="badge">Tagline here</span>
      <h1>Title</h1>
      <p>Subtitle</p>
      <div class="hero-actions">
        <a href="contact.html" class="cta-button">CTA Button</a>
      </div>
    </div>
    <div class="hero-visual">
      <img src="https://picsum.photos/seed/hero-main/820/580" alt="Hero visual" loading="lazy">
    </div>
  </div>
</section>
\`\`\`

**2. CONTENT IMAGES (single <img>):**
<img src="https://picsum.photos/seed/section-1/800/600" alt="[Description in site language]" loading="lazy">

**3. CARD IMAGES (optional):**
<img src="https://picsum.photos/seed/card-1/600/400" alt="[Description]" loading="lazy">

**4. TEAM/STAFF/EMPLOYEE PORTRAITS - MANDATORY FACE PHOTOS:**
🚨 When creating Team, Staff, About Us, or Employee sections, you MUST use portrait photos of people!
- Use Pexels portrait URLs: https://images.pexels.com/photos/[ID]/pexels-photo-[ID].jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop
- These are REAL portrait photo IDs for team sections (verified working):
  * Man portrait 1: https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 1: https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Man portrait 2: https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 2: https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Man portrait 3: https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 3: https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Man portrait 4: https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 4: https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Man portrait 5: https://images.pexels.com/photos/2380794/pexels-photo-2380794.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 5: https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- NEVER use random numbers or picsum for team members - people need REAL face photos!
- ALWAYS alternate between male and female portraits for realistic teams

**TEAM SECTION STRUCTURE (use EXACTLY this format):**
\`\`\`html
<section class="section team-section">
  <div class="section-inner centered">
    <div class="section-header centered">
      <span class="section-label">Our Team</span>
      <h2>Meet Our Experts</h2>
    </div>
    <div class="team-grid">
      <div class="team-member">
        <img src="https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" alt="John Smith" class="team-photo">
        <h3>John Smith</h3>
        <p class="team-role">CEO & Founder</p>
      </div>
      <div class="team-member">
        <img src="https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" alt="Maria Garcia" class="team-photo">
        <h3>Maria Garcia</h3>
        <p class="team-role">Marketing Director</p>
      </div>
      <!-- Add more team members using the portrait IDs above -->
    </div>
  </div>
</section>
\`\`\`

**5. GALLERY/FEATURE IMAGES:**
<img src="https://picsum.photos/seed/gallery-1/500/350" alt="[Description]" loading="lazy">

⚠️ MANDATORY RULES:
- Prefer stable /seed URLs: https://picsum.photos/seed/<unique>/WxH
- NEVER use SVG icons as main content images
- NEVER use placeholder.svg or any placeholder images
- NEVER use data:image URLs
- EVERY <img> tag MUST have src with picsum.photos or a real photo URL
- NEVER set background-image on hero sections (or any element that also contains an <img>)
- NEVER position images absolutely
- Alt text MUST be in the same language as website content

**WRONG (NEVER DO):**
❌ <img src="placeholder.svg">
❌ <svg class="hero-icon">...</svg>
❌ <img src="">
❌ <img src="icon.svg">
❌ <section class="page-hero" style="background-image: ..."> ... <img ...> ...

**CORRECT:**
✅ <img src="https://picsum.photos/seed/service-7/800/600" alt="Professional service" loading="lazy">
✅ <section class="page-hero homepage-hero"> ... <div class="hero-visual"><img ...></div> ...

**🏢 BRAND LOGOS - USE REAL LOGOS, NOT PLACEHOLDERS:**
For partner logos, client logos, certification badges, or any brand logos - ALWAYS use real logos from CDN services:

**Logo CDN Sources (use these URLs):**
- https://logo.clearbit.com/[company-domain] - e.g., https://logo.clearbit.com/google.com
- https://cdn.brandfetch.io/[company-domain]/w/400/h/400 - e.g., https://cdn.brandfetch.io/apple.com/w/400/h/400

**Industry-Specific Logo Examples:**
- Tech/Software: google.com, microsoft.com, aws.amazon.com, github.com, stripe.com, slack.com
- E-commerce/Payments: visa.com, mastercard.com, paypal.com, shopify.com, amazon.com
- Shipping/Logistics: dhl.com, fedex.com, ups.com, dpd.com
- Cloud/Hosting: cloudflare.com, digitalocean.com, heroku.com, vercel.com
- Certifications: iso.org, tuv.com, bsigroup.com
- Social: facebook.com, instagram.com, twitter.com, linkedin.com, youtube.com

**Usage in HTML:**
<img src="https://logo.clearbit.com/stripe.com" alt="Stripe" class="partner-logo" loading="lazy">
<img src="https://logo.clearbit.com/visa.com" alt="Visa" class="payment-logo" loading="lazy">

**RULES:**
- NEVER use placeholder logos or generic icons for brand logos
- Choose logos that make sense for the website's industry
- Use 4-8 partner/client logos in "Partners" or "Trusted By" sections
- Include relevant payment logos on e-commerce sites
- Add certification logos for professional services
`.trim();

// Pexels API helper function
async function fetchPexelsPhotos(query: string, count: number = 15): Promise<string[]> {
  const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_API_KEY) {
    console.log("PEXELS_API_KEY not configured, falling back to picsum");
    return [];
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: { Authorization: PEXELS_API_KEY },
      }
    );

    if (!response.ok) {
      console.error("Pexels API error:", response.status);
      return [];
    }

    const data = await response.json();
    const photos = data.photos || [];
    
    console.log(`📸 Pexels: Found ${photos.length} photos for "${query}"`);
    
    return photos.map((photo: { src: { large2x: string; large: string; medium: string } }) => 
      photo.src.large2x || photo.src.large || photo.src.medium
    );
  } catch (error) {
    console.error("Pexels API error:", error);
    return [];
  }
}

// AI-powered keyword extraction for better Pexels search
async function extractKeywordsAI(prompt: string, apiKey: string, isJunior: boolean): Promise<string> {
  try {
    const apiUrl = isJunior
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const model = isJunior ? "gpt-4o-mini" : "google/gemini-2.5-flash";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You extract the main visual topic for stock photo search. 
Return ONLY 2-4 English words that describe what photos would fit this website.
Examples:
- "Сайт для ветеринарної клініки" → "veterinary clinic pets"
- "Restaurant landing page Italian food" → "italian restaurant food"
- "Fitness gym website" → "gym fitness workout"
- "Продаж автозапчастин" → "car parts automotive"
- "Dog grooming salon" → "dog grooming salon"
NO explanations, NO quotes, ONLY the search keywords in English.`
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      console.log("AI keyword extraction failed, using fallback");
      return extractKeywordsFallback(prompt);
    }

    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content?.trim() || "";
    
    if (keywords && keywords.length > 2 && keywords.length < 50) {
      console.log(`🔍 AI extracted keywords: "${keywords}"`);
      return keywords;
    }
    
    return extractKeywordsFallback(prompt);
  } catch (error) {
    console.error("Keyword extraction error:", error);
    return extractKeywordsFallback(prompt);
  }
}

// Fallback keyword extraction (no AI)
function extractKeywordsFallback(prompt: string): string {
  // Translation map for common Ukrainian business terms
  const translations: Record<string, string> = {
    "ресторан": "restaurant food",
    "кафе": "cafe coffee",
    "піца": "pizza restaurant",
    "суші": "sushi japanese food",
    "ветеринар": "veterinary pets animals",
    "собак": "dogs pets",
    "кішок": "cats pets",
    "тварин": "animals pets",
    "авто": "cars automotive",
    "машин": "cars automotive",
    "запчастин": "car parts automotive",
    "будівництв": "construction building",
    "ремонт": "repair renovation",
    "фітнес": "fitness gym workout",
    "спорт": "sports fitness",
    "краса": "beauty salon spa",
    "салон": "beauty salon",
    "перукар": "hairdresser salon",
    "юрист": "lawyer legal office",
    "адвокат": "lawyer legal",
    "медицин": "medical healthcare",
    "стоматолог": "dentist dental",
    "подорож": "travel vacation",
    "туризм": "tourism travel",
    "готель": "hotel hospitality",
    "нерухом": "real estate property",
    "освіта": "education school",
    "школ": "school education",
    "технолог": "technology business",
    "програм": "software technology",
    "магазин": "shop retail store",
    "одяг": "fashion clothing",
    "взуття": "shoes footwear",
    "меблі": "furniture interior",
    "квіти": "flowers florist",
    "весілля": "wedding celebration",
    "фото": "photography camera",
  };

  const lowerPrompt = prompt.toLowerCase();
  
  // Find matching translation
  for (const [ukr, eng] of Object.entries(translations)) {
    if (lowerPrompt.includes(ukr)) {
      console.log(`🔍 Fallback keywords (matched "${ukr}"): "${eng}"`);
      return eng;
    }
  }

  // Generic extraction as last resort
  const cleanPrompt = prompt
    .replace(/сайт|website|web|page|create|generate|for|the|a|an|і|та|для|про|створ|генер/gi, "")
    .trim();
  
  const words = cleanPrompt.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  const result = words.join(" ") || "business professional";
  console.log(`🔍 Fallback keywords (generic): "${result}"`);
  return result;
}

// Build image strategy with Pexels URLs
function buildPexelsImageStrategy(pexelsUrls: string[]): string {
  if (pexelsUrls.length === 0) {
    return `
**IMAGE STRATEGY - RELIABLE STOCK PHOTOS:**
Use images.unsplash.com for ALL images - it's reliable, fast and always loads:

**Hero images:** <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop" alt="[Description]" loading="lazy">
**Content images:** <img src="https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&h=600&fit=crop" alt="[Description]" loading="lazy">
**Card images:** <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop" alt="[Description]" loading="lazy">
**Portrait images:** <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop" alt="[Description]" loading="lazy">

IMPORTANT: Change the photo ID (number after photo-) for each different image!
Example photo IDs for variety:
- Business: 1497366216548-37526070297c, 1560179707-f14e90ef3623, 1454165804606-c3d57bc86b40
- Office: 1497366811353-6870744d04b2, 1497366754146-60ec025e3a30, 1497215842964-4b71f27eda52
- Team: 1522202176988-66273c2fd55f, 1552664730-d307ca884978, 1600880292203-757bb62b4baf
- Portrait: 1507003211169-0a1dd7228f2d, 1438761681033-6461ffad8d80, 1472099645785-5658abf4ff4e
`.trim();
  }

  // Distribute URLs for different purposes
  const heroUrl = pexelsUrls[0] || "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop";
  const contentUrls = pexelsUrls.slice(1, 6);
  const cardUrls = pexelsUrls.slice(6, 12);
  const portraitUrls = pexelsUrls.slice(12, 15);

  return `
**IMAGE STRATEGY - HIGH QUALITY STOCK PHOTOS FROM PEXELS:**
Use these PRE-SELECTED high-quality Pexels photos. Each URL is unique and themed to the website topic.

**HERO IMAGE (use this exact URL):**
${heroUrl}

**CONTENT IMAGES (use these for main sections, about page, features):**
${contentUrls.map((url, i) => `Image ${i + 1}: ${url}`).join("\n")}

**CARD/FEATURE IMAGES (use these for service cards, gallery, products):**
${cardUrls.map((url, i) => `Card ${i + 1}: ${url}`).join("\n")}

**PORTRAIT/TEAM IMAGES (use these for testimonials, team members):**
${portraitUrls.length > 0 ? portraitUrls.map((url, i) => `Portrait ${i + 1}: ${url}`).join("\n") : "Use https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop with different photo IDs"}

**FALLBACK:** If you need more images than provided above, use: https://images.unsplash.com/photo-{photo-id}?w={width}&h={height}&fit=crop
Change the photo-id for each image!

**IMPORTANT:**
- Use EACH Pexels URL only ONCE (they are unique photos)
- Alt text MUST be in the same language as the website content
- Add loading="lazy" to all images
- For img tags: <img src="..." alt="[Description in site language]" loading="lazy">
`.trim();
}

// CSS for images - common to both strategies
const IMAGE_CSS = `
**REQUIRED CSS FOR IMAGES:**
.hero {
  position: relative;
  min-height: 80vh;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}
.hero-content { position: relative; z-index: 1; color: white; text-align: center; }
img { max-width: 100%; height: auto; display: block; }
.card img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; }

**MOBILE-FIRST BREAKPOINTS:**
/* Mobile (default) */
/* Tablet: 768px */
@media (min-width: 768px) { ... }
/* Desktop: 1024px */
@media (min-width: 1024px) { ... }
/* Large: 1280px */
@media (min-width: 1280px) { ... }

**MOBILE MENU (MANDATORY in script.js):**
- Hamburger button visible on mobile
- Toggle menu open/close
- Close menu when clicking a link

**COOKIE BANNER - DESIGN INTEGRATED:**
- Subtle, non-intrusive design at bottom
- Matches site color scheme
- Clear Accept/Decline buttons
- position: fixed; bottom: 0

**OUTPUT FORMAT (MANDATORY):**
<!-- FILE: styles.css -->
[Complete CSS 300+ lines with all styles including image handling]

<!-- FILE: index.html -->
[Homepage with hero background image, feature cards with images, WORKING navigation with href="page.html" format]

<!-- FILE: about.html -->
[SAME header/footer with IDENTICAL navigation, about content]

<!-- FILE: services.html -->
[SAME header/footer with IDENTICAL navigation, services content]

<!-- FILE: contact.html -->
[SAME header/footer with IDENTICAL navigation, contact form]

<!-- FILE: privacy.html -->
[SAME header/footer with IDENTICAL navigation, privacy policy]

<!-- FILE: script.js -->
[Cookie banner, mobile menu toggle]

<!-- FILE: robots.txt -->
User-agent: *
Allow: /

<!-- FILE: sitemap.xml -->
[Complete sitemap with relative URLs]

CRITICAL: ALL navigation links MUST use relative paths like href="about.html", NOT absolute paths. Header and footer HTML structure MUST be identical across all HTML files with working links between pages.`;


type GeneratedFile = { path: string; content: string };

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

// Retry helper with exponential backoff for AI API calls
// Optimized: shorter timeout (90s), fewer retries (2) to stay within edge function limits
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  baseDelay = 1500,
  timeoutMs = 90000 // 90 seconds default timeout
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt + 1}/${maxRetries} (timeout: ${timeoutMs/1000}s)...`);
      
      // Create AbortController with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If we get a response (even error), return it
      if (response) {
        console.log(`✅ Fetch successful on attempt ${attempt + 1}, status: ${response.status}`);
        return response;
      }
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError?.message || String(error);
      console.error(`❌ Fetch attempt ${attempt + 1} failed: ${errorMessage}`);
      
      // Check if it's a connection error worth retrying
      const isRetryable = 
        errorMessage.includes('error reading a body from connection') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network') ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT');
      
      if (!isRetryable) {
        // Non-retryable error - fail immediately
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        // Quick retry: 1.5s, 3s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('All fetch retries exhausted');
}

// Pricing per 1000 tokens (in USD)
const TOKEN_PRICING = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "google/gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
  "google/gemini-2.5-pro": { input: 0.00125, output: 0.005 },
};

const calculateCost = (usage: TokenUsage, model: string): number => {
  const pricing = TOKEN_PRICING[model as keyof typeof TOKEN_PRICING];
  if (!pricing) {
    console.log(`Unknown model for pricing: ${model}, using default`);
    return 0;
  }
  const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1000) * pricing.output;
  const totalCost = inputCost + outputCost;
  console.log(`💰 Token usage for ${model}: ${usage.prompt_tokens} in, ${usage.completion_tokens} out = $${totalCost.toFixed(6)}`);
  return totalCost;
};

type GenerationResult = {
  success: boolean;
  files?: GeneratedFile[];
  refinedPrompt?: string;
  totalFiles?: number;
  fileList?: string[];
  error?: string;
  rawResponse?: string;
  totalCost?: number;
  specificModel?: string;
};

const cleanFileContent = (content: string) => {
  let c = content.trim();
  c = c.replace(/^```[a-z0-9_-]*\s*\n/i, "");
  c = c.replace(/\n```\s*$/i, "");
  return c.trim();
};

const parseFilesFromModelText = (rawText: string) => {
  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const filesMap = new Map<string, string>();
  let hasIncompleteFile = false;

  const upsertFile = (path: string, content: string, source: string, isPartial = false) => {
    const cleanPath = path.trim();
    let cleanContent = cleanFileContent(content);
    
    // Skip empty files
    if (!cleanPath || cleanContent.length <= 10) return;
    
    // Try to fix truncated HTML files
    if (cleanPath.endsWith('.html') && isPartial) {
      cleanContent = fixTruncatedHtml(cleanContent);
      console.log(`⚠️ Fixed truncated HTML file: ${cleanPath}`);
    }
    
    // Try to fix truncated CSS files
    if (cleanPath.endsWith('.css') && isPartial) {
      cleanContent = fixTruncatedCss(cleanContent);
      console.log(`⚠️ Fixed truncated CSS file: ${cleanPath}`);
    }
    
    filesMap.set(cleanPath, cleanContent);
    console.log(`✅ Found (${source}${isPartial ? ', partial' : ''}): ${cleanPath} (${cleanContent.length} chars)`);
  };

  // Format 1: <!-- FILE: filename --> markers
  const filePattern1 = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;
  let match;
  while ((match = filePattern1.exec(normalizedText)) !== null) {
    const fileName = match[1].trim();
    const content = match[2];
    // Check if this is the last file and might be truncated
    const isLastFile = match.index + match[0].length >= normalizedText.length - 100;
    const mightBeTruncated = isLastFile && !content.trim().endsWith('</html>') && !content.trim().endsWith('}') && !content.trim().endsWith('</xml>');
    if (mightBeTruncated) hasIncompleteFile = true;
    upsertFile(fileName, content, "format1", mightBeTruncated);
  }

  // Format 2: Try markdown headings if format1 failed
  if (filesMap.size === 0) {
    console.log("Trying OpenAI markdown headings format...");

    const headers: { path: string; start: number; contentStart: number }[] = [];
    const headerRegex = /(^|\n)(?:###\s*(?:File:\s*)?(?:[A-Za-z]+\s*\()?\s*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\)?|\*\*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\*\*)/gi;

    while ((match = headerRegex.exec(normalizedText)) !== null) {
      const fileName = (match[2] || match[3] || "").trim();
      if (!fileName) continue;

      const afterHeader = match.index + match[0].length;
      const lineBreak = normalizedText.indexOf("\n", afterHeader);
      const contentStart = lineBreak === -1 ? normalizedText.length : lineBreak + 1;

      headers.push({ path: fileName, start: match.index, contentStart });
    }

    for (let i = 0; i < headers.length; i++) {
      const start = headers[i].contentStart;
      const end = headers[i + 1]?.start ?? normalizedText.length;
      const chunk = normalizedText.slice(start, end);
      const isLastFile = i === headers.length - 1;
      upsertFile(headers[i].path, chunk, "format2", isLastFile);
    }
  }

  // Format 3: Try to extract from code blocks if still no files
  if (filesMap.size === 0) {
    console.log("Trying code block extraction format...");
    
    // Try to find code blocks with file names
    const codeBlockPattern = /```(?:html|css|javascript|js)\s*\n\/\*\s*([a-zA-Z0-9_\-\.\/]+)\s*\*\/|```(?:html|css|javascript|js)\s*\n<!--\s*([a-zA-Z0-9_\-\.\/]+)\s*-->/gi;
    const simpleCodeBlocks = /```(html|css|javascript|js)\s*\n([\s\S]*?)```/gi;
    
    let blockMatch;
    const foundBlocks: { type: string; content: string }[] = [];
    
    while ((blockMatch = simpleCodeBlocks.exec(normalizedText)) !== null) {
      foundBlocks.push({ type: blockMatch[1], content: blockMatch[2] });
    }
    
    // If we found code blocks, assign them to files based on type
    if (foundBlocks.length > 0) {
      const htmlBlocks = foundBlocks.filter(b => b.type === 'html');
      const cssBlocks = foundBlocks.filter(b => b.type === 'css');
      const jsBlocks = foundBlocks.filter(b => b.type === 'javascript' || b.type === 'js');
      
      // Create files from blocks
      if (cssBlocks.length > 0) {
        upsertFile('styles.css', cssBlocks.map(b => b.content).join('\n\n'), 'codeblock');
      }
      if (htmlBlocks.length > 0) {
        htmlBlocks.forEach((block, i) => {
          const fileName = i === 0 ? 'index.html' : `page-${i}.html`;
          upsertFile(fileName, block.content, 'codeblock');
        });
      }
      if (jsBlocks.length > 0) {
        upsertFile('script.js', jsBlocks.map(b => b.content).join('\n\n'), 'codeblock');
      }
    }
  }

  if (hasIncompleteFile) {
    console.log(`⚠️ Warning: Response appears to be truncated, some files may be incomplete`);
  }

  return Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
};

// Fix truncated HTML by closing open tags
function fixTruncatedHtml(content: string): string {
  let fixed = content;
  
  // Common unclosed tags to check
  const tagsToClose = ['html', 'body', 'head', 'div', 'section', 'main', 'footer', 'header', 'article', 'aside', 'nav'];
  
  for (const tag of tagsToClose) {
    const openCount = (fixed.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length;
    const closeCount = (fixed.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    
    for (let i = closeCount; i < openCount; i++) {
      fixed += `</${tag}>`;
    }
  }
  
  // Ensure basic structure
  if (!fixed.includes('</body>') && fixed.includes('<body')) {
    fixed += '</body>';
  }
  if (!fixed.includes('</html>') && fixed.includes('<html')) {
    fixed += '</html>';
  }
  
  return fixed;
}

// Fix truncated CSS by closing open braces
function fixTruncatedCss(content: string): string {
  let fixed = content;
  
  // Count open and close braces
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  
  // Add missing close braces
  for (let i = closeBraces; i < openBraces; i++) {
    fixed += '\n}';
  }
  
  return fixed;
}

async function runGeneration({
  prompt,
  language,
  aiModel,
  layoutStyle,
  imageSource = "basic",
  siteName,
  bilingualLanguages,
}: {
  prompt: string;
  language?: string;
  aiModel: "junior" | "senior";
  layoutStyle?: string;
  imageSource?: "basic" | "ai";
  siteName?: string;
  bilingualLanguages?: string[] | null;
}): Promise<GenerationResult> {
  const isJunior = aiModel === "junior";
  console.log(`Using ${isJunior ? "Junior AI (OpenAI GPT-4o)" : "Senior AI (Lovable AI)"} for HTML generation`);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (isJunior && !OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return { success: false, error: "OpenAI API key not configured for Junior AI" };
  }

  if (!isJunior && !LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return { success: false, error: "Lovable AI not configured for Senior AI" };
  }

  console.log("Generating HTML website for prompt:", prompt.substring(0, 100));

  const apiUrl = isJunior
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const apiKey = isJunior ? OPENAI_API_KEY : LOVABLE_API_KEY;
  const refineModel = isJunior ? "gpt-4o-mini" : "google/gemini-2.5-flash";
  const generateModel = isJunior ? "gpt-4o" : "google/gemini-2.5-pro";

  // Step 1: refined prompt (with retry logic, shorter timeout for refine step)
  let agentResponse: Response;
  try {
    agentResponse = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: refineModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + (siteName ? `\n\nCRITICAL SITE NAME REQUIREMENT: The website/business/brand name MUST be "${siteName}". Use this EXACT name in the logo, header, footer, page titles, meta tags, copyright, and all references to the business. Do NOT invent a different name.` : "") },
          {
            role: "user",
            content: `Create a detailed prompt for static HTML/CSS website generation based on this request:\n\n"${prompt}"${siteName ? `\n\nIMPORTANT: The website name/brand MUST be "${siteName}".` : ""}\n\n${bilingualLanguages && Array.isArray(bilingualLanguages) && bilingualLanguages.length === 2 ? `BILINGUAL MODE: The website must support TWO languages (${bilingualLanguages[0]} and ${bilingualLanguages[1]}) using ONE set of HTML pages and a JS i18n layer. Do NOT generate duplicate pages per language. Generate i18n/translations.js + i18n/i18n.js and mark texts with data-i18n keys.` : `TARGET CONTENT LANGUAGE: ${language === "uk" ? "Ukrainian" : language === "en" ? "English" : language === "de" ? "German" : language === "pl" ? "Polish" : language === "ru" ? "Russian" : language || "auto-detect from user's request, default to English"}`}`,
          },
        ],
      }),
    }, 2, 1000, 30000); // 2 retries, 1s delay, 30s timeout for refine
  } catch (fetchError) {
    const errorMsg = (fetchError as Error)?.message || String(fetchError);
    console.error("Agent AI fetch failed after retries:", errorMsg);
    return { success: false, error: errorMsg };
  }

  if (!agentResponse.ok) {
    const errorText = await agentResponse.text();
    console.error("Agent AI error:", agentResponse.status, errorText);

    if (agentResponse.status === 429) return { success: false, error: "Rate limit exceeded. Please try again later." };
    if (agentResponse.status === 402) return { success: false, error: "AI credits exhausted. Please add funds." };

    return { success: false, error: "AI agent error" };
  }

  const agentData = await agentResponse.json();
  const refinedPrompt = agentData.choices?.[0]?.message?.content || prompt;
  
  // Track token usage for refine step
  let totalCost = 0;
  const agentUsage = agentData.usage as TokenUsage | undefined;
  if (agentUsage) {
    totalCost += calculateCost(agentUsage, refineModel);
  }
  
  console.log("Refined prompt generated, now generating HTML website...");

  // Select layout: use provided layoutStyle or random
  const selectedLayout = layoutStyle 
    ? LAYOUT_VARIATIONS.find(l => l.id === layoutStyle) || LAYOUT_VARIATIONS[Math.floor(Math.random() * LAYOUT_VARIATIONS.length)]
    : LAYOUT_VARIATIONS[Math.floor(Math.random() * LAYOUT_VARIATIONS.length)];
  console.log(`Selected layout variation: ${selectedLayout.name} (${layoutStyle ? 'manual' : 'random'})`);

  // Fetch Pexels photos if AI image source selected
  let imageStrategy = IMAGE_STRATEGY_BASIC;
  if (imageSource === "ai") {
    const keywords = await extractKeywordsAI(prompt, apiKey!, isJunior);
    console.log(`📸 Fetching Pexels photos for keywords: "${keywords}"`);
    const pexelsUrls = await fetchPexelsPhotos(keywords, 15);
    imageStrategy = buildPexelsImageStrategy(pexelsUrls);
  }

  // Step 2: Static HTML website generation
  const websiteRequestBody: Record<string, unknown> = {
    model: generateModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert HTML/CSS/JS generator. Return ONLY file blocks using exact markers like: <!-- FILE: index.html -->. No explanations. No markdown.",
      },
      {
        role: "user",
        content: `${HTML_GENERATION_PROMPT}\n\n${imageStrategy}\n\n${IMAGE_CSS}\n\n=== MANDATORY LAYOUT STRUCTURE (FOLLOW EXACTLY) ===\n${selectedLayout.description}\n\n=== USER'S ORIGINAL REQUEST (MUST FOLLOW EXACTLY) ===\n${prompt}\n\n${bilingualLanguages && Array.isArray(bilingualLanguages) && bilingualLanguages.length === 2 ? `=== BILINGUAL REQUIREMENTS (ONE HTML SET + JS) ===\n- Supported languages: ${bilingualLanguages[0]} and ${bilingualLanguages[1]}\n- Generate ONE set of pages: index.html, about.html, services.html, contact.html, etc. (NO suffixes, NO duplicated pages).\n- Add a visible language switcher in the header on every page (labels: ${bilingualLanguages[0].toUpperCase()} | ${bilingualLanguages[1].toUpperCase()}).\n- Implement i18n via JS (NOT separate pages):\n  * Create i18n/translations.js (window.__SITE_TRANSLATIONS__ = {<lang>: {...}})\n  * Create i18n/i18n.js that picks language by priority: ?lang=xx -> localStorage.siteLang -> browser language -> default lang1\n  * Mark all text with data-i18n keys (and data-i18n-placeholder/title/aria where needed) and have i18n.js replace them at runtime.\n- The site MUST be fully translated (no mixed languages).\n` : `=== TARGET WEBSITE LANGUAGE (CRITICAL - MUST FOLLOW EXACTLY) ===\nALL website content MUST be in: ${language === "uk" ? "UKRAINIAN language" : language === "en" ? "ENGLISH language" : language === "de" ? "GERMAN language" : language === "pl" ? "POLISH language" : language === "ru" ? "RUSSIAN language" : language === "fr" ? "FRENCH language" : language === "es" ? "SPANISH language" : language ? language.toUpperCase() + " language" : "ENGLISH language (default)"}\n\nThis includes: navigation, buttons, headings, paragraphs, footer, cookie banner, ALL text content. DO NOT MIX LANGUAGES.\n`}\n\n=== ENHANCED DETAILS (KEEP FIDELITY TO ORIGINAL) ===\n${refinedPrompt}`,
      },
    ],
  };

  // Set max_tokens for both models to ensure complete generation
  // Junior: 16000 tokens, Senior: 65536 tokens for comprehensive multi-page websites
  // CRITICAL: OpenAI GPT-5 series uses max_completion_tokens, not max_tokens
  const isOpenAIGPT5Model = generateModel.includes('gpt-5');
  if (isOpenAIGPT5Model) {
    websiteRequestBody.max_completion_tokens = isJunior ? 16000 : 65536;
  } else {
    websiteRequestBody.max_tokens = isJunior ? 16000 : 65536;
  }
  
  console.log(`📊 Prompt length: ${prompt.length} chars, System prompt length: ${HTML_GENERATION_PROMPT.length} chars`);

  // Helper function to attempt generation with a specific model
  const attemptGeneration = async (modelToUse: string, isRetry: boolean = false): Promise<{ rawText: string; websiteData: Record<string, unknown>; modelUsed: string; isPartial?: boolean } | null> => {
    const requestBody: Record<string, unknown> = { ...websiteRequestBody, model: modelToUse };
    
    // CRITICAL: Fix max_tokens vs max_completion_tokens for OpenAI GPT-5 series
    const isGPT5Series = modelToUse.includes('gpt-5');
    if (isGPT5Series) {
      delete requestBody.max_tokens;
      requestBody.max_completion_tokens = isJunior ? 16000 : 65536;
    } else if (!requestBody.max_tokens) {
      // Ensure non-GPT5 models have max_tokens set
      requestBody.max_tokens = isJunior ? 16000 : 65536;
    }
    
    console.log(`${isRetry ? '🔄 RETRY with' : '🚀 Attempting'} model: ${modelToUse} (${isGPT5Series ? 'max_completion_tokens' : 'max_tokens'})`);
    
    let response: Response;
    try {
      response = await fetchWithRetry(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }, 2, 2000, 180000);
    } catch (fetchError) {
      const errorMsg = (fetchError as Error)?.message || String(fetchError);
      console.error(`❌ Fetch failed for ${modelToUse}: ${errorMsg}`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${modelToUse} error: ${response.status} ${errorText.substring(0, 200)}`);
      return null;
    }

    const rawResponse = await response.text();
    console.log(`📥 Raw response length from ${modelToUse}: ${rawResponse.length}`);

    // If response is too short, consider it failed
    // Senior models should return more content than junior
    const minResponseLength = isJunior ? 5000 : 12000;
    if (rawResponse.length < minResponseLength) {
      console.error(`❌ Response too short from ${modelToUse}: ${rawResponse.length} chars (min: ${minResponseLength})`);
      return null;
    }

    let data: Record<string, unknown> = {};
    let text = "";
    let isPartial = false;
    
    try {
      data = JSON.parse(rawResponse);
      text = (data.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content || "";
      
      // Check if response was truncated due to token limit
      const finishReason = (data.choices as Array<{ finish_reason?: string }>)?.[0]?.finish_reason;
      if (finishReason === 'length') {
        console.log(`⚠️ Response truncated due to token limit (finish_reason: length)`);
        isPartial = true;
      }
    } catch (parseError) {
      console.log("JSON parse failed, attempting to extract content from incomplete response...");
      
      // Try multiple extraction strategies for incomplete JSON
      
      // Strategy 1: Find content field and extract everything after it
      let contentMatch = rawResponse.match(/"content"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"(?:role|refusal|annotations)|\"\s*}\s*\]|$)/);
      if (contentMatch && contentMatch[1]) {
        text = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        isPartial = true;
        console.log(`📄 Extracted content via strategy 1: ${text.length} chars`);
      }
      
      // Strategy 2: If content field found but cut off, get everything after "content":"
      if (!text && rawResponse.includes('"content"')) {
        const contentStartMatch = rawResponse.match(/"content"\s*:\s*"/);
        if (contentStartMatch) {
          const startIdx = (contentStartMatch.index || 0) + contentStartMatch[0].length;
          let extracted = rawResponse.slice(startIdx);
          // Unescape the content
          extracted = extracted.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          // Remove trailing incomplete JSON
          extracted = extracted.replace(/"\s*,?\s*"?(?:role|refusal|annotations|logprobs|finish_reason)?\s*:?[^}]*$/, '');
          if (extracted.length > 1000) {
            text = extracted;
            isPartial = true;
            console.log(`📄 Extracted content via strategy 2: ${text.length} chars`);
          }
        }
      }
      
      // Strategy 3: If raw response contains FILE markers, use it directly
      if (!text && rawResponse.includes("<!-- FILE:")) {
        // Find the start of actual content (after JSON headers)
        const fileMarkerIdx = rawResponse.indexOf("<!-- FILE:");
        if (fileMarkerIdx > 0) {
          text = rawResponse.slice(fileMarkerIdx);
          isPartial = true;
          console.log(`📄 Extracted content via strategy 3 (direct FILE markers): ${text.length} chars`);
        }
      }
      
      if (!text) {
        console.error(`❌ Failed to extract content from incomplete JSON response`);
        return null;
      }
    }

    // Check if we got meaningful content - be more lenient if partial
    const minLength = isPartial ? 2000 : 3000;
    const hasFileMarkers = text.includes("<!-- FILE:") || text.includes("```html") || text.includes("```css");
    
    if (text.length < minLength) {
      console.error(`❌ Insufficient content from ${modelToUse}: ${text.length} chars (min: ${minLength})`);
      return null;
    }
    
    if (!hasFileMarkers) {
      console.error(`❌ No file markers found in response from ${modelToUse}`);
      return null;
    }

    console.log(`✅ Got ${isPartial ? 'partial' : 'valid'} response from ${modelToUse}: ${text.length} chars`);
    return { rawText: text, websiteData: data, modelUsed: modelToUse, isPartial };
  };

  // Try primary model first (gemini-2.5-pro for senior, gpt-4o for junior)
  let generationResult = await attemptGeneration(generateModel);

  // If primary model failed, try fallback models
  if (!generationResult) {
    const fallbackModels = isJunior 
      ? ["gpt-4o-mini"] 
      : ["google/gemini-2.5-flash", "openai/gpt-5"];
    
    for (const fallbackModel of fallbackModels) {
      console.log(`🔄 Primary model failed, trying fallback: ${fallbackModel}`);
      generationResult = await attemptGeneration(fallbackModel, true);
      if (generationResult) break;
    }
  }

  if (!generationResult) {
    return { success: false, error: "All AI models failed to generate website content", totalCost };
  }

  const { rawText, websiteData, modelUsed } = generationResult;

  // Track token usage for generation step (if available)
  const websiteUsage = (websiteData.usage as { prompt_tokens?: number; completion_tokens?: number }) || undefined;
  if (websiteUsage) {
    totalCost += calculateCost(websiteUsage as TokenUsage, modelUsed);
  }
  
  console.log(`💰 Total generation cost: $${totalCost.toFixed(6)}`);
  console.log(`🎯 Final model used: ${modelUsed}`);

  console.log("HTML website generated, parsing files...");

  let files = parseFilesFromModelText(rawText);
  console.log(`📁 Total files parsed: ${files.length}`);

  // CRITICAL: Check if index.html exists - if not, try fallback model
  let hasIndexHtml = files.some(f => f.path.toLowerCase() === 'index.html');
  let htmlFileCount = files.filter(f => f.path.toLowerCase().endsWith('.html')).length;
  
  // If no index.html or no HTML files at all, try fallback models
  if (!hasIndexHtml || htmlFileCount === 0) {
    console.error(`❌ CRITICAL: No index.html found! Files: ${files.map(f => f.path).join(', ')}`);
    console.log(`🔄 Attempting recovery with fallback models...`);
    
    // Use stable recovery models - avoid openai/gpt-5-mini due to max_tokens incompatibility
    const recoveryModels = ["google/gemini-2.5-flash", "google/gemini-3-flash-preview"];
    let recovered = false;
    let finalModelUsed = modelUsed;
    
    for (const recoveryModel of recoveryModels) {
      if (recoveryModel === modelUsed) continue; // Skip if already tried this model
      
      console.log(`🔄 Recovery attempt with: ${recoveryModel}`);
      const recoveryResult = await attemptGeneration(recoveryModel, true);
      
      if (recoveryResult) {
        const recoveryFiles = parseFilesFromModelText(recoveryResult.rawText);
        const recoveryHasIndex = recoveryFiles.some(f => f.path.toLowerCase() === 'index.html');
        const recoveryHtmlCount = recoveryFiles.filter(f => f.path.toLowerCase().endsWith('.html')).length;
        
        if (recoveryHasIndex && recoveryHtmlCount > 0) {
          console.log(`✅ Recovery successful with ${recoveryModel}: ${recoveryHtmlCount} HTML files`);
          files = recoveryFiles;
          hasIndexHtml = true;
          htmlFileCount = recoveryHtmlCount;
          recovered = true;
          finalModelUsed = recoveryModel;
          break;
        } else {
          console.log(`❌ Recovery model ${recoveryModel} also failed to produce index.html`);
        }
      }
    }
    
    if (!recovered) {
      console.error(`❌ All recovery attempts failed. No index.html in final output.`);
      return {
        success: false,
        error: "Generation incomplete: no index.html found after multiple attempts. Please retry.",
        rawResponse: rawText.substring(0, 500),
        totalCost,
        specificModel: finalModelUsed, // Record which model was attempted
      };
    }
  }

  if (files.length === 0) {
    console.error("No files parsed from response");
    return {
      success: false,
      error: "Failed to parse generated files",
      rawResponse: rawText.substring(0, 500),
      totalCost,
    };
  }
  
  console.log(`✅ index.html found, ${htmlFileCount} HTML files total`);

  // MANDATORY: Create separate cookie-banner.js file and include in all HTML files
  const ensureCookieBannerFile = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const COOKIE_BANNER_JS = `/**
 * Cookie Banner - MANDATORY FILE
 * This file handles cookie consent for GDPR compliance
 */
(function() {
  'use strict';
  
  // Cookie Banner HTML
  var bannerHTML = '<div id="cookie-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.95);color:#fff;padding:20px;z-index:99999;box-shadow:0 -4px 20px rgba(0,0,0,0.3);font-family:system-ui,-apple-system,sans-serif;">' +
    '<div style="max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:15px;">' +
    '<p style="margin:0;flex:1;min-width:200px;font-size:14px;line-height:1.5;">We use cookies to enhance your browsing experience and analyze site traffic. By clicking "Accept", you consent to our use of cookies.</p>' +
    '<div style="display:flex;gap:10px;">' +
    '<button id="cookie-accept" style="background:#22c55e;color:#fff;border:none;padding:12px 24px;cursor:pointer;font-weight:600;border-radius:6px;transition:all 0.2s;">Accept</button>' +
    '<button id="cookie-decline" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.3);padding:12px 24px;cursor:pointer;font-weight:600;border-radius:6px;transition:all 0.2s;">Decline</button>' +
    '</div></div></div>';

  function initCookieBanner() {
    // Check if consent already given
    if (localStorage.getItem('cookieConsent')) {
      return;
    }
    
    // Inject banner into page
    var container = document.createElement('div');
    container.innerHTML = bannerHTML;
    document.body.appendChild(container.firstChild);
    
    var banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.style.display = 'flex';
      
      // Accept button
      var acceptBtn = document.getElementById('cookie-accept');
      if (acceptBtn) {
        acceptBtn.addEventListener('click', function() {
          localStorage.setItem('cookieConsent', 'accepted');
          banner.style.display = 'none';
        });
      }
      
      // Decline button
      var declineBtn = document.getElementById('cookie-decline');
      if (declineBtn) {
        declineBtn.addEventListener('click', function() {
          localStorage.setItem('cookieConsent', 'declined');
          banner.style.display = 'none';
        });
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
  } else {
    initCookieBanner();
  }
})();`;

    // Always add cookie-banner.js file
    const hasCookieBannerFile = generatedFiles.some(f => f.path === 'cookie-banner.js');
    if (!hasCookieBannerFile) {
      console.log("📁 Adding mandatory cookie-banner.js file");
      generatedFiles.push({
        path: "cookie-banner.js",
        content: COOKIE_BANNER_JS
      });
    }

    // Ensure all HTML files include the cookie-banner.js script
    return generatedFiles.map(file => {
      if (!file.path.endsWith('.html')) return file;
      
      let content = file.content;
      const hasCookieScript = content.includes('cookie-banner.js') || content.includes('cookie-banner') || content.includes('cookieConsent');
      
      if (!hasCookieScript) {
        console.log(`⚠️ Adding cookie-banner.js script to ${file.path}`);
        
        // Add script tag before </body>
        if (content.includes('</body>')) {
          content = content.replace('</body>', '  <script src="cookie-banner.js"></script>\n</body>');
        } else if (content.includes('</html>')) {
          content = content.replace('</html>', '<script src="cookie-banner.js"></script>\n</html>');
        } else {
          content = content + '\n<script src="cookie-banner.js"></script>';
        }
      }
      
      return { ...file, content };
    });
  };

  // MANDATORY: Ensure all required legal pages exist and have proper content
  // Also replaces incomplete/empty pages (less than 2000 chars for legal pages)
  const ensureMandatoryPages = (generatedFiles: GeneratedFile[], lang: string = "en"): GeneratedFile[] => {
    const fileMap = new Map(generatedFiles.map(f => [f.path.toLowerCase(), f]));
    
    // Extract header/footer from index.html for consistent styling
    const indexFile = fileMap.get("index.html");
    let headerHtml = "";
    let footerHtml = "";
    let siteName = "Company";
    let cssLink = '<link rel="stylesheet" href="styles.css">';
    let indexHtml = "";
    
    if (indexFile) {
      const content = indexFile.content;
      indexHtml = content;
      // Extract header
      const headerMatch = content.match(/<header[\s\S]*?<\/header>/i);
      if (headerMatch) headerHtml = headerMatch[0];
      // Extract footer
      const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
      if (footerMatch) footerHtml = footerMatch[0];
      // Extract site name from title
      const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) siteName = titleMatch[1].split(/[-|]/)[0].trim();
      // Extract CSS link for consistent styling
      const cssMatch = content.match(/<link[^>]*stylesheet[^>]*>/i);
      if (cssMatch) cssLink = cssMatch[0];
    }
    
    const mandatoryPages = [
      { file: "privacy.html", title: lang === "uk" ? "Політика конфіденційності" : lang === "ru" ? "Политика конфиденциальности" : lang === "de" ? "Datenschutzerklärung" : "Privacy Policy", minLength: 2000 },
      { file: "terms.html", title: lang === "uk" ? "Умови використання" : lang === "ru" ? "Условия использования" : lang === "de" ? "Nutzungsbedingungen" : "Terms of Service", minLength: 2000 },
      { file: "cookie-policy.html", title: lang === "uk" ? "Політика cookies" : lang === "ru" ? "Политика cookies" : lang === "de" ? "Cookie-Richtlinie" : "Cookie Policy", minLength: 2000 },
      { file: "thank-you.html", title: lang === "uk" ? "Дякуємо" : lang === "ru" ? "Спасибо" : lang === "de" ? "Danke" : "Thank You", minLength: 500 },
      // Netlify static hosting helpers
      { file: "404.html", title: lang === "uk" ? "Сторінку не знайдено" : lang === "ru" ? "Страница не найдена" : lang === "de" ? "Seite nicht gefunden" : "Page Not Found", minLength: 300 },
      { file: "200.html", title: siteName, minLength: 300 },
    ];
    
    // Filter out incomplete mandatory pages and add proper versions
    const filteredFiles = generatedFiles.filter(f => {
      const fileName = f.path.toLowerCase();
      const mandatoryPage = mandatoryPages.find(mp => mp.file === fileName);
      if (mandatoryPage) {
        // Check if page is too short (incomplete)
        if (f.content.length < mandatoryPage.minLength) {
          console.log(`⚠️ Replacing incomplete page ${f.path} (${f.content.length} chars < ${mandatoryPage.minLength} min)`);
          return false; // Remove this file, will be regenerated
        }
      }
      return true;
    });
    
    const filteredFileMap = new Map(filteredFiles.map(f => [f.path.toLowerCase(), f]));
    
    for (const page of mandatoryPages) {
      if (!filteredFileMap.has(page.file)) {
        console.log(`📁 Adding/regenerating mandatory page: ${page.file}`);
        const pageContent = generateMandatoryPageContent(page.file, page.title, siteName, headerHtml, footerHtml, lang, indexHtml);
        filteredFiles.push({ path: page.file, content: pageContent });
      }
    }
    
    return filteredFiles;
  };

  const generateMandatoryPageContent = (fileName: string, title: string, siteName: string, header: string, footer: string, lang: string, indexHtml?: string): string => {
    const backText = lang === "uk" ? "Повернутися на головну" : lang === "ru" ? "Вернуться на главную" : lang === "de" ? "Zurück zur Startseite" : "Back to Home";
    const notFoundTitle = lang === "uk" ? "Сторінку не знайдено" : lang === "ru" ? "Страница не найдена" : lang === "de" ? "Seite nicht gefunden" : "Page Not Found";
    const notFoundText = lang === "uk" ? "Схоже, цієї сторінки не існує або її було переміщено." : lang === "ru" ? "Похоже, этой страницы не существует или она была перемещена." : lang === "de" ? "Diese Seite existiert nicht oder wurde verschoben." : "This page doesn't exist or may have been moved.";
    const redirectText = lang === "uk" ? "Перенаправляємо на головну…" : lang === "ru" ? "Перенаправляем на главную…" : lang === "de" ? "Weiterleitung zur Startseite…" : "Redirecting to the homepage…";

    // 200.html: for static hosts that use it as a fallback (e.g., SPA deep links).
    // For multi-page static sites, the safest behavior is to serve the homepage.
    if (fileName === "200.html") {
      if (indexHtml && indexHtml.length > 300) {
        return indexHtml;
      }

      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <meta http-equiv="refresh" content="0; url=index.html">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  ${header}
  <main class="section" style="min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 20px;">
    <div class="container">
      <h1 style="font-size:2rem;margin-bottom:12px;">${redirectText}</h1>
      <p style="color:#666;">${backText}: <a href="index.html">index.html</a></p>
    </div>
  </main>
  ${footer}
  <script src="cookie-banner.js"></script>
  <script>window.location.replace('index.html');</script>
</body>
</html>`;
    }

    if (fileName === "404.html") {
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notFoundTitle} - ${siteName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  ${header}
  <main class="section" style="min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 20px;">
    <div class="container">
      <div style="font-size:64px;line-height:1;margin-bottom:18px;font-weight:800;">404</div>
      <h1 style="font-size:2rem;margin-bottom:12px;">${notFoundTitle}</h1>
      <p style="color:#666;max-width:700px;margin:0 auto 28px;">${notFoundText}</p>
      <a href="index.html" class="btn" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">${backText}</a>
    </div>
  </main>
  ${footer}
  <script src="cookie-banner.js"></script>
</body>
</html>`;
    }
    
    if (fileName === "thank-you.html") {
      const thankYouTitle = lang === "uk" ? "Дякуємо за звернення!" : lang === "ru" ? "Спасибо за обращение!" : lang === "de" ? "Danke für Ihre Nachricht!" : "Thank You for Contacting Us!";
      const thankYouText = lang === "uk" ? "Ми отримали ваше повідомлення і зв'яжемося з вами найближчим часом." : lang === "ru" ? "Мы получили ваше сообщение и свяжемся с вами в ближайшее время." : lang === "de" ? "Wir haben Ihre Nachricht erhalten und werden uns in Kürze bei Ihnen melden." : "We have received your message and will get back to you shortly.";
      
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${siteName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    ${header}
    <main class="thank-you-page" style="min-height: 60vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 80px 20px;">
        <div class="container">
            <div style="font-size: 80px; margin-bottom: 30px;">✓</div>
            <h1 style="font-size: 2.5rem; margin-bottom: 20px;">${thankYouTitle}</h1>
            <p style="font-size: 1.2rem; color: #666; margin-bottom: 40px;">${thankYouText}</p>
            <a href="index.html" class="btn" style="display: inline-block; padding: 15px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">${backText}</a>
        </div>
    </main>
    ${footer}
    <script src="cookie-banner.js"></script>
</body>
</html>`;
    }
    
    // Generate legal page content
    const legalContent = generateLegalContent(fileName, siteName, lang);
    
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${siteName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    ${header}
    <main class="legal-page" style="padding: 80px 20px; max-width: 900px; margin: 0 auto;">
        <h1 style="font-size: 2.5rem; margin-bottom: 40px;">${title}</h1>
        ${legalContent}
        <p style="margin-top: 40px;"><a href="index.html">${backText}</a></p>
    </main>
    ${footer}
    <script src="cookie-banner.js"></script>
</body>
</html>`;
  };

  const generateLegalContent = (fileName: string, siteName: string, lang: string): string => {
    if (fileName === "privacy.html") {
      if (lang === "uk" || lang === "ru") {
        return `<section style="margin-bottom: 30px;"><h2>1. Загальні положення</h2><p>Ця Політика конфіденційності описує, як ${siteName} збирає, використовує та захищає вашу особисту інформацію.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Які дані ми збираємо</h2><p>Ми можемо збирати: контактну інформацію (ім'я, email, телефон), технічні дані (IP-адреса, тип браузера), файли cookies.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Як ми використовуємо дані</h2><p>Дані використовуються для: надання послуг, покращення сервісу, зв'язку з вами, аналітики.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Захист даних</h2><p>Ми вживаємо всіх необхідних заходів для захисту ваших персональних даних.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Ваші права</h2><p>Ви маєте право на доступ, виправлення та видалення ваших даних.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Контакти</h2><p>З питань конфіденційності зв'яжіться з нами через контактну форму.</p></section>`;
      }
      return `<section style="margin-bottom: 30px;"><h2>1. Introduction</h2><p>This Privacy Policy describes how ${siteName} collects, uses, and protects your personal information when you use our website.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Information We Collect</h2><p>We may collect: contact information (name, email, phone), technical data (IP address, browser type), cookies and usage data.</p></section>
<section style="margin-bottom: 30px;"><h2>3. How We Use Your Information</h2><p>Your data is used to: provide our services, improve user experience, communicate with you, analyze website usage.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Data Protection</h2><p>We implement appropriate security measures to protect your personal data from unauthorized access.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Your Rights</h2><p>You have the right to access, correct, and delete your personal data at any time.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Contact Us</h2><p>For privacy-related questions, please contact us through our contact form.</p></section>`;
    }
    
    if (fileName === "terms.html") {
      if (lang === "uk" || lang === "ru") {
        return `<section style="margin-bottom: 30px;"><h2>1. Прийняття умов</h2><p>Використовуючи наш веб-сайт, ви погоджуєтеся з цими Умовами використання.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Опис послуг</h2><p>${siteName} надає інформаційні та консультаційні послуги.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Правила користування</h2><p>Ви погоджуєтеся використовувати сайт лише в законних цілях.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Інтелектуальна власність</h2><p>Весь контент сайту є власністю ${siteName} і захищений законом.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Обмеження відповідальності</h2><p>Ми не несемо відповідальності за будь-які прямі чи непрямі збитки.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Зміни умов</h2><p>Ми залишаємо за собою право змінювати ці умови в будь-який час.</p></section>`;
      }
      return `<section style="margin-bottom: 30px;"><h2>1. Acceptance of Terms</h2><p>By using our website, you agree to be bound by these Terms of Service.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Description of Services</h2><p>${siteName} provides informational and consulting services as described on our website.</p></section>
<section style="margin-bottom: 30px;"><h2>3. User Conduct</h2><p>You agree to use our website only for lawful purposes and in compliance with all applicable laws.</p></section>
<section style="margin-bottom: 30px;"><h2>4. Intellectual Property</h2><p>All content on this website is the property of ${siteName} and protected by copyright law.</p></section>
<section style="margin-bottom: 30px;"><h2>5. Limitation of Liability</h2><p>We shall not be liable for any direct, indirect, incidental, or consequential damages.</p></section>
<section style="margin-bottom: 30px;"><h2>6. Changes to Terms</h2><p>We reserve the right to modify these terms at any time without prior notice.</p></section>`;
    }
    
    if (fileName === "cookie-policy.html") {
      if (lang === "uk" || lang === "ru") {
        return `<section style="margin-bottom: 30px;"><h2>1. Що таке cookies</h2><p>Cookies — це невеликі текстові файли, які зберігаються на вашому пристрої при відвідуванні веб-сайту.</p></section>
<section style="margin-bottom: 30px;"><h2>2. Як ми використовуємо cookies</h2><p>Ми використовуємо cookies для: запам'ятовування ваших налаштувань, аналітики, покращення функціональності сайту.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Типи cookies</h2>
<table style="width:100%; border-collapse: collapse; margin: 20px 0;"><thead><tr style="background:#f5f5f5;"><th style="padding:12px; border:1px solid #ddd;">Назва</th><th style="padding:12px; border:1px solid #ddd;">Тип</th><th style="padding:12px; border:1px solid #ddd;">Термін</th><th style="padding:12px; border:1px solid #ddd;">Призначення</th></tr></thead><tbody><tr><td style="padding:12px; border:1px solid #ddd;">cookieConsent</td><td style="padding:12px; border:1px solid #ddd;">Необхідний</td><td style="padding:12px; border:1px solid #ddd;">1 рік</td><td style="padding:12px; border:1px solid #ddd;">Зберігає згоду на cookies</td></tr></tbody></table></section>
<section style="margin-bottom: 30px;"><h2>4. Управління cookies</h2><p>Ви можете видалити або заблокувати cookies в налаштуваннях вашого браузера.</p></section>`;
      }
      return `<section style="margin-bottom: 30px;"><h2>1. What Are Cookies</h2><p>Cookies are small text files stored on your device when you visit a website.</p></section>
<section style="margin-bottom: 30px;"><h2>2. How We Use Cookies</h2><p>We use cookies to: remember your preferences, analyze website traffic, improve site functionality.</p></section>
<section style="margin-bottom: 30px;"><h2>3. Types of Cookies</h2>
<table style="width:100%; border-collapse: collapse; margin: 20px 0;"><thead><tr style="background:#f5f5f5;"><th style="padding:12px; border:1px solid #ddd;">Name</th><th style="padding:12px; border:1px solid #ddd;">Type</th><th style="padding:12px; border:1px solid #ddd;">Duration</th><th style="padding:12px; border:1px solid #ddd;">Purpose</th></tr></thead><tbody><tr><td style="padding:12px; border:1px solid #ddd;">cookieConsent</td><td style="padding:12px; border:1px solid #ddd;">Essential</td><td style="padding:12px; border:1px solid #ddd;">1 year</td><td style="padding:12px; border:1px solid #ddd;">Stores cookie consent</td></tr></tbody></table></section>
<section style="margin-bottom: 30px;"><h2>4. Managing Cookies</h2><p>You can delete or block cookies through your browser settings.</p></section>`;
    }
    
    return "";
  };

  // QUALITY CSS ENFORCEMENT: Ensure styles.css has proper quality and all required styles
  // Reference: Based on professional site examples with 600+ lines of comprehensive CSS
  const ensureQualityCSS = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const MINIMUM_CSS_LINES = 500; // Minimum lines for quality CSS (increased from 400)
    const MINIMUM_QUALITY_SCORE = 6; // Minimum quality score out of 10 indicators
    
    // 10 unique color schemes for variety (with RGB values for rgba usage)
    const COLOR_SCHEMES = [
      { name: 'ocean', primary: '#0d4f8b', primaryRgb: '13, 79, 139', secondary: '#1a365d', accent: '#3182ce', heading: '#1a202c', text: '#4a5568', bgLight: '#ebf8ff', border: '#bee3f8' },
      { name: 'forest', primary: '#276749', primaryRgb: '39, 103, 73', secondary: '#22543d', accent: '#38a169', heading: '#1a202c', text: '#4a5568', bgLight: '#f0fff4', border: '#9ae6b4' },
      { name: 'sunset', primary: '#c53030', primaryRgb: '197, 48, 48', secondary: '#9b2c2c', accent: '#e53e3e', heading: '#1a202c', text: '#4a5568', bgLight: '#fff5f5', border: '#feb2b2' },
      { name: 'royal', primary: '#553c9a', primaryRgb: '85, 60, 154', secondary: '#44337a', accent: '#805ad5', heading: '#1a202c', text: '#4a5568', bgLight: '#faf5ff', border: '#d6bcfa' },
      { name: 'slate', primary: '#2d3748', primaryRgb: '45, 55, 72', secondary: '#1a202c', accent: '#4a5568', heading: '#1a202c', text: '#4a5568', bgLight: '#f7fafc', border: '#e2e8f0' },
      { name: 'teal', primary: '#234e52', primaryRgb: '35, 78, 82', secondary: '#1d4044', accent: '#319795', heading: '#1a202c', text: '#4a5568', bgLight: '#e6fffa', border: '#81e6d9' },
      { name: 'coral', primary: '#c05621', primaryRgb: '192, 86, 33', secondary: '#9c4221', accent: '#dd6b20', heading: '#1a202c', text: '#4a5568', bgLight: '#fffaf0', border: '#fbd38d' },
      { name: 'midnight', primary: '#1a1a2e', primaryRgb: '26, 26, 46', secondary: '#16213e', accent: '#2563eb', heading: '#1a202c', text: '#4a5568', bgLight: '#f7fafc', border: '#e2e8f0' },
      { name: 'rose', primary: '#97266d', primaryRgb: '151, 38, 109', secondary: '#702459', accent: '#d53f8c', heading: '#1a202c', text: '#4a5568', bgLight: '#fff5f7', border: '#fbb6ce' },
      { name: 'emerald', primary: '#047857', primaryRgb: '4, 120, 87', secondary: '#065f46', accent: '#10b981', heading: '#1a202c', text: '#4a5568', bgLight: '#ecfdf5', border: '#6ee7b7' },
    ];
    
    // 5 unique border-radius styles
    const RADIUS_STYLES = [
      { sm: '4px', md: '8px', lg: '12px' },      // Sharp
      { sm: '8px', md: '12px', lg: '20px' },     // Rounded
      { sm: '12px', md: '16px', lg: '24px' },    // Soft
      { sm: '0', md: '0', lg: '0' },             // Square/Brutalist
      { sm: '50px', md: '50px', lg: '50px' },    // Pill
    ];
    
    // 5 unique shadow styles
    const SHADOW_STYLES = [
      { sm: '0 1px 3px rgba(0,0,0,0.08)', md: '0 4px 12px rgba(0,0,0,0.1)', lg: '0 12px 35px rgba(0,0,0,0.12)' },
      { sm: '0 2px 8px rgba(0,0,0,0.06)', md: '0 8px 25px rgba(0,0,0,0.08)', lg: '0 20px 50px rgba(0,0,0,0.1)' },
      { sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 3px 10px rgba(0,0,0,0.08)', lg: '0 8px 30px rgba(0,0,0,0.12)' },
      { sm: 'none', md: '0 4px 20px rgba(0,0,0,0.05)', lg: '0 10px 40px rgba(0,0,0,0.08)' },
      { sm: '2px 2px 0 rgba(0,0,0,0.1)', md: '4px 4px 0 rgba(0,0,0,0.15)', lg: '8px 8px 0 rgba(0,0,0,0.2)' }, // Brutalist
    ];
    
    // Randomly select style variations
    const colorScheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];
    const radiusStyle = RADIUS_STYLES[Math.floor(Math.random() * RADIUS_STYLES.length)];
    const shadowStyle = SHADOW_STYLES[Math.floor(Math.random() * SHADOW_STYLES.length)];
    
    console.log(`🎨 Selected style: ${colorScheme.name} theme, radius: ${radiusStyle.md}, shadow style: ${shadowStyle.md.substring(0, 20)}...`);
    
    // Premium baseline CSS with randomized variables
    const BASELINE_CSS = `:root {
  --primary-color: ${colorScheme.primary};
  --primary-color-rgb: ${colorScheme.primaryRgb};
  --secondary-color: ${colorScheme.secondary};
  --accent-color: ${colorScheme.accent};
  --heading-color: ${colorScheme.heading};
  --text-color: ${colorScheme.text};
  --text-muted: #718096;
  --bg-color: #f7fafc;
  --bg-light: ${colorScheme.bgLight};
  --white: #ffffff;
  --light-gray: ${colorScheme.bgLight};
  --border-color: ${colorScheme.border};
  --shadow-sm: ${shadowStyle.sm};
  --shadow-md: ${shadowStyle.md};
  --shadow-lg: ${shadowStyle.lg};
  --radius-sm: ${radiusStyle.sm};
  --radius-md: ${radiusStyle.md};
  --radius-lg: ${radiusStyle.lg};
  --transition: all 0.3s ease;
  --font-family-body: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-family-heading: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font-family-body);
  color: var(--text-color);
  background-color: var(--bg-color);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-family-heading);
  color: var(--heading-color);
  line-height: 1.3;
  font-weight: 700;
}

h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.5rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.75rem); }

a {
  color: var(--accent-color);
  text-decoration: none;
  transition: var(--transition);
}
a:hover { text-decoration: underline; }

img {
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

/* FORM ELEMENTS - ALWAYS STYLED, NEVER PLAIN */
input, select, textarea {
  font-family: var(--font-family-body);
  font-size: 1rem;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--white);
  color: var(--text-color);
  transition: var(--transition);
  width: 100%;
  box-sizing: border-box;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

input::placeholder, textarea::placeholder {
  color: var(--text-muted);
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23718096' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
  cursor: pointer;
}

textarea {
  min-height: 120px;
  resize: vertical;
}

/* Form layouts */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--heading-color);
}

.form-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.form-row .form-group {
  flex: 1;
  min-width: 200px;
}

/* Search forms */
.search-form, .filter-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.search-form input[type="search"],
.search-form input[type="text"] {
  flex: 1;
  min-width: 250px;
}

.search-form select,
.filter-form select {
  min-width: 180px;
  width: auto;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* HEADER & NAVIGATION */
.header {
  background-color: var(--white);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: var(--shadow-sm);
  border-bottom: 1px solid var(--border-color);
}

.nav, .nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.site-logo, .nav-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  text-decoration: none;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 1.5rem;
}

.nav-links a {
  color: var(--heading-color);
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  position: relative;
  padding: 0.5rem 0;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: var(--accent-color);
  transition: width 0.3s ease;
}

.nav-links a:hover::after,
.nav-links a.active::after {
  width: 100%;
}

.hamburger-menu, .nav-toggle {
  display: none;
  cursor: pointer;
  background: none;
  border: none;
  padding: 8px;
}

.hamburger-menu .bar, .nav-toggle span {
  display: block;
  width: 25px;
  height: 3px;
  margin: 5px 0;
  background-color: var(--primary-color);
  transition: var(--transition);
}

/* HERO SECTION */
.hero {
  position: relative;
  min-height: 70vh;
  max-height: 85vh;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
}

.hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(22, 33, 62, 0.6);
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 800px;
  padding: 0 20px;
}

.hero-title {
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 800;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  font-weight: 400;
  max-width: 700px;
  margin: 0 auto 2rem;
  opacity: 0.9;
}

/* IMAGES - CONSTRAINED */
.card-image, .service-card img, .feature-img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.avatar, .team-photo, .testimonial-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.gallery-item img {
  width: 100%;
  height: 250px;
  object-fit: cover;
}

.partner-logo, .client-logo {
  height: 40px;
  width: auto;
  max-width: 120px;
  object-fit: contain;
  filter: grayscale(100%);
  opacity: 0.7;
  transition: var(--transition);
}

.partner-logo:hover { filter: grayscale(0); opacity: 1; }

/* BUTTONS */
.btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
  border: none;
  cursor: pointer;
}

.btn-primary {
  background-color: var(--accent-color);
  color: var(--white);
}

.btn-primary:hover {
  background-color: #1d4ed8;
  transform: translateY(-2px);
  text-decoration: none;
}

.btn-secondary {
  background: transparent;
  color: var(--accent-color);
  border: 2px solid var(--accent-color);
}

.btn-secondary:hover {
  background: var(--accent-color);
  color: white;
}

/* SECTIONS */
section, .section {
  padding: 80px 0;
}

section.light, .section.light {
  background: var(--light-gray);
}

.section-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 60px;
}

.section-label {
  display: inline-block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-color);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.section-title {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  margin-bottom: 16px;
}

.section-subtitle {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.7;
}

/* HERO - SPLIT LAYOUT */
.page-hero, .homepage-hero {
  padding: 100px 0 80px;
  background: var(--white);
}

.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.hero-copy {
  max-width: 560px;
}

.hero-copy .badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--light-gray), #e8f4f8);
  color: var(--heading-color);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 20px;
}

.hero-copy h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 20px;
}

.hero-copy > p {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 28px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.cta-button {
  display: inline-block;
  background: var(--accent-color);
  color: var(--white);
  padding: 14px 28px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}

.cta-button:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
  text-decoration: none;
}

.button-outline {
  display: inline-block;
  background: transparent;
  color: var(--accent-color);
  padding: 14px 28px;
  border: 2px solid var(--accent-color);
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}

.button-outline:hover {
  background: var(--accent-color);
  color: var(--white);
  text-decoration: none;
}

/* TAG PILLS / FILTER BUTTONS - THEMED STYLING */
.tag-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.tag-pills span {
  font-family: var(--font-family-body);
  background: linear-gradient(135deg, rgba(var(--primary-color-rgb, 37, 99, 235), 0.08) 0%, rgba(var(--primary-color-rgb, 37, 99, 235), 0.15) 100%);
  color: var(--primary-color);
  border: 1px solid rgba(var(--primary-color-rgb, 37, 99, 235), 0.25);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  backdrop-filter: blur(4px);
}

.tag-pills span:hover {
  background: var(--primary-color);
  color: var(--white);
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(var(--primary-color-rgb, 37, 99, 235), 0.25);
}

.tag-pills span.active {
  background: var(--primary-color);
  color: var(--white);
  border-color: var(--primary-color);
}

/* FILTER TABS - Alternative styled tabs for filtering */
.filter-tabs, .category-tabs, .service-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px;
  background: var(--bg-light);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.filter-tabs button, .category-tabs button, .service-tabs button,
.filter-tabs a, .category-tabs a, .service-tabs a {
  font-family: var(--font-family-body);
  background: transparent;
  color: var(--text-muted);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  text-decoration: none;
}

.filter-tabs button:hover, .category-tabs button:hover, .service-tabs button:hover,
.filter-tabs a:hover, .category-tabs a:hover, .service-tabs a:hover {
  background: rgba(var(--primary-color-rgb, 37, 99, 235), 0.1);
  color: var(--primary-color);
}

.filter-tabs button.active, .category-tabs button.active, .service-tabs button.active,
.filter-tabs a.active, .category-tabs a.active, .service-tabs a.active {
  background: var(--primary-color);
  color: var(--white);
  box-shadow: 0 2px 8px rgba(var(--primary-color-rgb, 37, 99, 235), 0.3);
}

/* BADGE/CHIP STYLING */
.badge, .chip, .tag {
  font-family: var(--font-family-body);
  display: inline-block;
  padding: 6px 14px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
  color: var(--white);
}

.badge.outline, .chip.outline, .tag.outline {
  background: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
}

.badge.secondary, .chip.secondary, .tag.secondary {
  background: var(--bg-light);
  color: var(--text-muted);
}

/* HERO VISUAL - PREVENT IMAGE OVERLAP */
.hero-visual {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  z-index: 1;
  isolation: isolate;
}

.hero-visual img {
  position: relative !important;
  display: block;
  width: 100%;
  max-width: 820px;
  height: auto;
  max-height: 580px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1;
}

/* Prevent any absolute positioned elements inside hero-visual */
.hero-visual::before,
.hero-visual::after {
  display: none !important;
}

.hero-visual * {
  position: relative !important;
}

/* STATS SECTION */
.stats-highlight {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: start;
}

.highlight-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.highlight-list li {
  position: relative;
  padding-left: 28px;
  margin-bottom: 20px;
  line-height: 1.7;
  color: var(--text-color);
}

.highlight-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 8px;
  height: 8px;
  background: var(--accent-color);
  border-radius: 50%;
}

.stats-numbers {
  display: grid;
  gap: 24px;
}

.stat-number {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  color: var(--accent-color);
  line-height: 1;
  margin-bottom: 8px;
}

.stat-caption {
  font-size: 0.95rem;
  color: var(--text-muted);
}

/* FEATURED GRID */
.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}

.featured-grid .card {
  background: var(--white);
  padding: 28px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: var(--transition);
}

.featured-grid .card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}

.featured-grid .card h3 {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.featured-grid .card p {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 16px;
}

.card-meta {
  font-size: 0.85rem;
  color: var(--accent-color);
  font-weight: 500;
}

/* MEDIA OBJECT */
.media-object {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.media-copy {
  max-width: 520px;
}

.media-copy h3 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  margin-bottom: 16px;
}

.media-copy > p {
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 20px;
}

.media-copy ul {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
}

.media-copy ul li {
  position: relative;
  padding-left: 24px;
  margin-bottom: 12px;
  line-height: 1.6;
}

.media-copy ul li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 6px;
  height: 6px;
  background: var(--accent-color);
  border-radius: 50%;
}

.cta-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

/* MEDIA VISUAL - PREVENT IMAGE OVERLAP */
.media-visual {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  z-index: 1;
  isolation: isolate;
}

.media-visual img {
  position: relative !important;
  display: block;
  width: 100%;
  max-width: 760px;
  height: auto;
  max-height: 560px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  z-index: 1;
}

/* Prevent any absolute positioned elements inside media-visual */
.media-visual::before,
.media-visual::after {
  display: none !important;
}

.media-visual * {
  position: relative !important;
}

/* TIMELINE */
.timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 32px;
}

.timeline-step {
  position: relative;
  padding: 24px;
  background: var(--white);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.timeline-step h3 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--heading-color);
}

.timeline-step p {
  color: var(--text-muted);
  line-height: 1.6;
}

/* FORM CARD */
.form-card {
  background: var(--white);
  padding: 40px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-width: 700px;
  margin: 0 auto;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* RESPONSIVE */
@media (max-width: 992px) {
  .hero-inner, .media-object, .stats-highlight {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  
  .form-grid.two-columns {
    grid-template-columns: 1fr;
  }
}

/* CARDS & GRIDS */
.cards-grid, .grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

.card {
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: visible;
  box-shadow: var(--shadow-md);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}

.card-body {
  padding: 24px;
  overflow: visible;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--heading-color);
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.card-text {
  color: var(--text-muted);
  line-height: 1.6;
  font-size: 0.95rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* FORMS */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--heading-color);
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.form-control:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

textarea.form-control {
  min-height: 150px;
  resize: vertical;
}

/* FOOTER */
.footer {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0;
  padding: 60px 0 30px;
  margin-top: 80px;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-brand {
  max-width: 280px;
}

.footer-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 16px;
  display: block;
}

.footer-description {
  font-size: 0.9rem;
  line-height: 1.6;
  color: #a0a0a0;
  margin-bottom: 20px;
}

.footer-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--white);
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.footer-links {
  list-style: none;
}

.footer-links li {
  margin-bottom: 12px;
}

.footer-links a {
  color: #a0a0a0;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.footer-links a:hover {
  color: var(--white);
}

.footer-contact-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 0.9rem;
  color: #a0a0a0;
}

.footer-contact-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--accent-color);
}

.footer-social {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.footer-social a {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  transition: var(--transition);
}

.footer-social a:hover {
  background: var(--accent-color);
  transform: translateY(-3px);
}

.footer-divider {
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 30px 0;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.footer-copyright {
  font-size: 0.85rem;
  color: #707070;
}

.footer-legal-links {
  display: flex;
  gap: 24px;
}

.footer-legal-links a {
  font-size: 0.85rem;
  color: #707070;
  text-decoration: none;
}

.footer-legal-links a:hover {
  color: var(--white);
}

.disclaimer-section {
  color: #707070;
  font-size: 0.8rem;
  line-height: 1.5;
  padding-top: 20px;
}

/* LEGAL PAGES */
.legal-content {
  background: var(--white);
  padding: 40px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.legal-content h2 {
  font-size: 1.6rem;
  margin-top: 2rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.legal-content p, .legal-content ul {
  font-size: 1rem;
  line-height: 1.7;
  margin-bottom: 1rem;
}

/* ANIMATIONS */
.fade-in {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.fade-in.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* RESPONSIVE */
@media (max-width: 992px) {
  .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  .nav-toggle, .hamburger-menu { display: block; }
  .nav-links {
    position: fixed;
    top: 70px;
    left: -100%;
    width: 100%;
    height: calc(100vh - 70px);
    background-color: var(--white);
    flex-direction: column;
    align-items: center;
    padding-top: 2rem;
    transition: left 0.3s ease;
    gap: 1rem;
  }
  .nav-links.active { left: 0; }
  .hamburger-menu.active .bar:nth-child(2) { opacity: 0; }
  .hamburger-menu.active .bar:nth-child(1) { transform: translateY(8px) rotate(45deg); }
  .hamburger-menu.active .bar:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }
}

@media (max-width: 576px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; text-align: center; }
  .footer-brand { max-width: 100%; }
  .footer-bottom { flex-direction: column; text-align: center; }
  .footer-social { justify-content: center; }
}

/* COOKIE BANNER */
#cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0,0,0,0.95);
  color: var(--white);
  padding: 1.5rem;
  z-index: 10000;
  display: none;
}

/* TWO COLUMN LAYOUTS */
.two-col-section, .two-column-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.two-col-section.reverse .two-col-image,
.two-column-layout.reverse .column-image {
  order: -1;
}

.two-col-image img, .column-image img {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  height: auto;
}

.about-image {
  max-width: 500px;
  width: 100%;
  height: 350px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* ARTICLE STYLES */
.article-content {
  max-width: 800px;
  margin: 0 auto;
}

.article-header {
  text-align: center;
  margin-bottom: 3rem;
}

.article-title {
  font-size: clamp(2rem, 6vw, 3.5rem);
  font-weight: 800;
  margin-bottom: 1rem;
}

.article-subtitle {
  font-size: 1.3rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.article-hero-image {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  margin: 2rem 0 3rem;
  box-shadow: var(--shadow-lg);
}

.article-body {
  font-size: 1.1rem;
  line-height: 1.8;
}

.article-body h2 {
  font-size: 1.8rem;
  margin: 2.5rem 0 1rem;
}

.article-body h3 {
  font-size: 1.4rem;
  margin: 2rem 0 1rem;
}

.article-body p, .article-body ul, .article-body ol {
  margin-bottom: 1.5rem;
}

.article-body blockquote {
  border-left: 4px solid var(--accent-color);
  padding-left: 1.5rem;
  margin: 2rem 0;
  font-style: italic;
  font-size: 1.2rem;
  color: var(--heading-color);
}

.article-meta {
  margin-top: auto;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* PAGE HEADER */
.page-header {
  background: var(--primary-color);
  color: var(--white);
  padding: 5rem 0;
  text-align: center;
}

.page-title {
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  font-weight: 800;
  color: var(--white);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  font-size: 1.1rem;
  color: rgba(255,255,255,0.8);
  max-width: 600px;
  margin: 0 auto;
}

/* TABLES */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 30px 0;
  font-size: 0.95rem;
  background-color: var(--white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

thead {
  background: var(--light-gray);
}

th, td {
  padding: 15px 20px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: var(--light-gray);
}

/* THANK YOU PAGE */
.thank-you-section {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 20px;
}

.thank-you-icon {
  width: 80px;
  height: 80px;
  background: var(--accent-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30px;
  color: var(--white);
  font-size: 2.5rem;
}

/* CONTACT GRID */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 3rem;
  background-color: var(--white);
  padding: 3rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.contact-info h2 { margin-bottom: 1.5rem; }
.contact-info p { color: var(--text-muted); margin-bottom: 2rem; }

.contact-details li {
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.contact-details .icon {
  color: var(--accent-color);
  font-size: 1.5rem;
}

/* MAP CONTAINER */
.map-container {
  width: 100%;
  height: 450px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  margin-top: 4rem;
}

.map-container iframe { 
  width: 100%; 
  height: 100%; 
  border: none; 
}

/* DISCLAIMER SECTION */
.disclaimer-section {
  background-color: var(--light-gray);
  color: var(--text-muted);
  padding: 20px 30px;
  margin: 3rem auto;
  border-radius: var(--radius-md);
  text-align: center;
  font-size: 0.85rem;
  line-height: 1.6;
  max-width: 900px;
}

.disclaimer-section strong {
  display: block;
  margin-bottom: 8px;
  color: var(--heading-color);
}

/* ADDITIONAL RESPONSIVE */
@media (max-width: 992px) {
  .two-col-section, .two-column-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .two-col-section.reverse .two-col-image,
  .two-column-layout.reverse .column-image {
    order: 0;
  }
  .contact-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .map-container { height: 350px; }
  .contact-grid { padding: 2rem; }
}

/* CATEGORY LIST - STYLED CARDS */
.category-list, .services-list, .features-list, .sector-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-item, .service-item, .feature-item, .sector-item {
  background: var(--white);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border-left: 4px solid var(--accent-color);
  transition: all 0.3s ease;
}

.category-item:hover, .service-item:hover, .feature-item:hover, .sector-item:hover {
  transform: translateX(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.category-item h3, .service-item h3, .feature-item h3, .sector-item h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--heading-color);
}

.category-item p, .service-item p, .feature-item p, .sector-item p {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.category-item a, .service-item a, .feature-item a, .sector-item a {
  color: var(--accent-color);
  text-decoration: none;
}

.category-item a:hover, .service-item a:hover {
  text-decoration: underline;
}

/* NEWSLETTER/CTA SECTIONS - PROPERLY STYLED */
.newsletter-section, .cta-section, .subscribe-section {
  background: linear-gradient(135deg, var(--light-gray) 0%, #e8f4f8 100%);
  padding: 60px 20px;
  text-align: center;
  border-radius: 0;
}

.newsletter-section h2, .cta-section h2, .subscribe-section h2 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  margin-bottom: 12px;
}

.newsletter-section p, .cta-section p, .subscribe-section p {
  color: var(--text-muted);
  margin-bottom: 24px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.newsletter-form, .subscribe-form {
  display: flex;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto;
  flex-wrap: wrap;
  justify-content: center;
}

.newsletter-form input, .subscribe-form input {
  flex: 1;
  min-width: 250px;
  padding: 14px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  background: var(--white);
}

.newsletter-form input:focus, .subscribe-form input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.newsletter-form button, .subscribe-form button {
  padding: 14px 28px;
  background: var(--accent-color);
  color: var(--white);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.newsletter-form button:hover, .subscribe-form button:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
}

/* PREVENT OVERSIZED IMAGES */
section img:not(.avatar):not(.partner-logo):not(.client-logo):not(.testimonial-img):not(.team-photo) {
  max-height: 400px;
}

/* CONSISTENT SECTION BACKGROUNDS */
.bg-light, .section-light {
  background: var(--light-gray);
}

.bg-dark, .section-dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0;
}

.bg-dark h2, .bg-dark h3, .section-dark h2, .section-dark h3 {
  color: var(--white);
}

@media (max-width: 576px) {
  .newsletter-form, .subscribe-form {
    flex-direction: column;
  }
  .newsletter-form input, .subscribe-form input {
    min-width: 100%;
  }
  .category-list, .services-list, .features-list {
    grid-template-columns: 1fr;
  }
}`;

    // Check if styles.css exists
    const hasStylesCSS = generatedFiles.some(f => f.path === 'styles.css');
    
    // If no styles.css exists at all, CREATE it with baseline CSS
    if (!hasStylesCSS) {
      console.log(`🚨 CRITICAL: styles.css NOT FOUND! Creating with full baseline CSS.`);
      generatedFiles.push({
        path: 'styles.css',
        content: BASELINE_CSS
      });
      
      // Also ensure all HTML files link to styles.css
      generatedFiles = generatedFiles.map(file => {
        if (!file.path.endsWith('.html')) return file;
        
        let content = file.content;
        // Check if already has stylesheet link
        if (!content.includes('styles.css') && !content.includes('<link rel="stylesheet"')) {
          // Add stylesheet link in <head>
          if (content.includes('</head>')) {
            content = content.replace('</head>', '  <link rel="stylesheet" href="styles.css">\n</head>');
            console.log(`📎 Added styles.css link to ${file.path}`);
          }
        }
        return { ...file, content };
      });
      
      return generatedFiles;
    }
    
    // If styles.css exists, check and enhance quality
    return generatedFiles.map(file => {
      if (file.path !== 'styles.css') return file;
      
      const existingCSS = file.content;
      const lineCount = existingCSS.split('\n').length;
      const charCount = existingCSS.length;
      
      // Expanded quality indicators (10 total) for comprehensive check
      const qualityIndicators = {
        hasRootVars: existingCSS.includes(':root'),
        hasContainer: existingCSS.includes('.container'),
        hasFooter: existingCSS.includes('.footer') || existingCSS.includes('footer'),
        hasCard: existingCSS.includes('.card'),
        hasResponsive: existingCSS.includes('@media'),
        hasHeader: existingCSS.includes('.header') || existingCSS.includes('header'),
        hasHero: existingCSS.includes('.hero'),
        hasButton: existingCSS.includes('.btn'),
        hasForm: existingCSS.includes('.form') || existingCSS.includes('input'),
        hasNav: existingCSS.includes('.nav') || existingCSS.includes('nav-links'),
      };
      
      const qualityScore = Object.values(qualityIndicators).filter(Boolean).length;
      const hasMinimumLength = lineCount >= MINIMUM_CSS_LINES || charCount >= 15000;
      
      console.log(`📊 CSS Quality Check: ${lineCount} lines, ${charCount} chars, quality score: ${qualityScore}/10`);
      console.log(`📋 Quality indicators:`, JSON.stringify(qualityIndicators));
      
      // Enhanced logic: Apply baseline if CSS is too short OR missing critical patterns
      // Using stricter thresholds to ensure professional quality
      const needsEnhancement = !hasMinimumLength || qualityScore < MINIMUM_QUALITY_SCORE;
      
      if (needsEnhancement) {
        console.log(`⚠️ CSS quality insufficient (${lineCount} lines, score ${qualityScore}/${MINIMUM_QUALITY_SCORE} min). ENHANCING with baseline CSS.`);
        
        // Merge: baseline first, then generated CSS (generated can override)
        const enhancedCSS = BASELINE_CSS + '\n\n/* ===== SITE-SPECIFIC STYLES ===== */\n\n' + existingCSS;
        
        console.log(`✅ Enhanced CSS: ${enhancedCSS.split('\n').length} lines, ${enhancedCSS.length} chars`);
        
        return { ...file, content: enhancedCSS };
      }
      
      console.log(`✅ CSS quality sufficient - no enhancement needed`);
      return file;
    });
  };

  // NEW: Fix placeholder images, ensure proper hero backgrounds, and fix styling issues
  const fixPlaceholderImages = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    let imageCounter = 1;
    
    // Pre-defined reliable Unsplash photo IDs for fallbacks
    const UNSPLASH_PHOTOS = [
      "1497366216548-37526070297c", // office
      "1560179707-f14e90ef3623", // business
      "1454165804606-c3d57bc86b40", // meeting
      "1497366811353-6870744d04b2", // workspace
      "1522202176988-66273c2fd55f", // teamwork
      "1552664730-d307ca884978", // presentation
      "1600880292203-757bb62b4baf", // collaboration
      "1507003211169-0a1dd7228f2d", // portrait male
      "1438761681033-6461ffad8d80", // portrait female
      "1472099645785-5658abf4ff4e", // portrait professional
    ];
    
    const getUnsplashUrl = (width: number, height: number) => {
      const photoId = UNSPLASH_PHOTOS[imageCounter % UNSPLASH_PHOTOS.length];
      imageCounter++;
      return `https://images.unsplash.com/photo-${photoId}?w=${width}&h=${height}&fit=crop`;
    };
    
    return generatedFiles.map(file => {
      if (!file.path.endsWith('.html')) return file;
      
      let content = file.content;
      let fixedCount = 0;
      
      // Fix 0: Replace ALL picsum.photos URLs with Unsplash (picsum is unreliable)
      content = content.replace(
        /https?:\/\/picsum\.photos(?:\/seed\/[^\/]+)?\/(\d+)\/(\d+)(?:\?[^"'\s)]*)?/gi,
        (match, w, h) => {
          fixedCount++;
          return getUnsplashUrl(parseInt(w) || 800, parseInt(h) || 600);
        }
      );
      
      // Fix 1: Replace SVG/placeholder src in img tags
      const badImagePatterns = [
        /src=["'](?:placeholder\.svg|icon\.svg|logo\.svg|image\.svg)["']/gi,
        /src=["'](?:data:image\/svg\+xml[^"']*)["']/gi,
        /src=["'](?:#|javascript:|about:blank)["']/gi,
        /src=["'][\s]*["']/g, // empty src
      ];
      
      for (const pattern of badImagePatterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, () => {
            fixedCount++;
            return `src="${getUnsplashUrl(600, 400)}"`;
          });
        }
      }
      
      // Fix 2: Replace large inline SVGs that are used as hero/main images (not small icons)
      const largeSvgPattern = /<svg[^>]*(?:width=["'](?:[2-9]\d{2}|[1-9]\d{3,})["']|height=["'](?:[2-9]\d{2}|[1-9]\d{3,})["']|class=["'][^"']*(?:hero|banner|main|feature)[^"']*["'])[^>]*>[\s\S]*?<\/svg>/gi;
      if (largeSvgPattern.test(content)) {
        content = content.replace(largeSvgPattern, () => {
          fixedCount++;
          return `<img src="${getUnsplashUrl(600, 400)}" alt="Feature image" loading="lazy" class="feature-image">`;
        });
      }
      
      // Fix 3: REMOVE background-image from hero sections that have <img> inside hero-visual
      // This prevents image overlap issues
      const heroSectionPattern = /<section([^>]*class=["'][^"']*(?:page-hero|homepage-hero)[^"']*["'])([^>]*)>/gi;
      content = content.replace(heroSectionPattern, (match, classAttr, restAttrs) => {
        // Remove style attribute with background-image
        if (restAttrs.includes('background-image')) {
          console.log(`🧹 Removing background-image from hero section in ${file.path} (conflicts with hero-visual img)`);
          restAttrs = restAttrs.replace(/\s*style=["'][^"']*background-image[^"']*["']/gi, '');
          fixedCount++;
        }
        return `<section${classAttr}${restAttrs}>`;
      });
      
      // Fix 4: Fix duplicate class="" attributes (CRITICAL - invalid HTML)
      // Pattern: class="something" followed by another class="something"
      content = content.replace(
        /<([a-z][a-z0-9]*)\s+([^>]*class=["'][^"']*["'])([^>]*)(class=["'][^"']*["'])([^>]*)>/gi,
        (match, tag, firstClass, middle, duplicateClass, rest) => {
          // Merge the classes
          const class1Match = firstClass.match(/class=["']([^"']*)["']/);
          const class2Match = duplicateClass.match(/class=["']([^"']*)["']/);
          
          if (class1Match && class2Match) {
            const mergedClasses = `${class1Match[1]} ${class2Match[1]}`.trim();
            console.log(`🔧 Fixed duplicate class attributes in ${file.path}: merging "${class1Match[1]}" + "${class2Match[1]}"`);
            fixedCount++;
            return `<${tag} class="${mergedClasses}"${middle}${rest}>`;
          }
          return match;
        }
      );
      
      // Fix 5: Remove background-image from style if section contains hero-visual with img
      // More aggressive cleanup for hero sections
      const heroWithBgAndImg = /<section([^>]*class=["'][^"']*hero[^"']*["'][^>]*style=["'][^"']*background-image[^"']*["'][^>]*)>([\s\S]*?<div[^>]*class=["'][^"']*hero-visual[^"']*["'][^>]*>[\s\S]*?<img[\s\S]*?<\/div>)/gi;
      content = content.replace(heroWithBgAndImg, (match, sectionAttrs, innerContent) => {
        // Remove background-image from section style
        const cleanedAttrs = sectionAttrs.replace(/style=["'][^"']*["']/gi, '');
        console.log(`🧹 Removed conflicting background-image from hero with img in ${file.path}`);
        fixedCount++;
        return `<section${cleanedAttrs}>${innerContent}`;
      });
      
      // Fix 5: Constrain image sizes - add max-height to any images missing it
      // Replace full-width images with constrained versions
      content = content.replace(
        /<img([^>]*)(style=["'][^"']*)(width:\s*100vw|width:\s*100%[^;]*;[^"']*height:\s*100vh)([^"']*["'])/gi,
        '<img$1$2max-height: 400px; object-fit: cover$4'
      );
      
      // Fix 6: Add proper class to unstyled sections with lists (category-like sections)
      // Convert plain dt/dd lists to styled format
      content = content.replace(
        /<dl([^>]*)>\s*(<dt>)/gi,
        '<dl$1 class="category-list"><$2'
      );
      
      // Fix 7: Wrap unstyled h3+p combinations in cards
      // This targets patterns like: <h3>Energy</h3><p>Oil, gas...</p>
      const unstyledListPattern = /<section[^>]*>[\s\S]*?(<h3>[^<]+<\/h3>\s*<p>[^<]+<\/p>\s*){3,}/gi;
      if (unstyledListPattern.test(content)) {
        console.log("🎨 Detected unstyled list section in " + file.path + " - adding style classes");
        
        // Add container class to sections without it
        content = content.replace(
          /<section([^>]*)>\s*<h2([^>]*)>([^<]+)<\/h2>/gi,
          '<section$1 class="section"><div class="container"><div class="section-header"><h2$2 class="section-title">$3</h2></div>'
        );
      }
      
      // Fix 8: Ensure newsletter sections have proper styling
      const newsletterPattern = /<section[^>]*class=["'][^"']*(?:newsletter|subscribe|cta)[^"']*["'][^>]*>/gi;
      if (!newsletterPattern.test(content)) {
        // Find newsletter-like sections by content and add class
        content = content.replace(
          /<section([^>]*)>([\s\S]*?(?:newsletter|subscribe|email address|inbox)[\s\S]*?)<\/section>/gi,
          '<section$1 class="newsletter-section">$2</section>'
        );
      }
      
      if (fixedCount > 0) {
        console.log("🔧 Fixed " + fixedCount + " issues in " + file.path);
      }
      
      return { ...file, content };
    });
  };

  // NEW: Validate HTML content is not empty/broken
  const validateHtmlContent = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    return generatedFiles.map(file => {
      if (!file.path.endsWith('.html')) return file;
      
      let content = file.content;
      
      // Check for common signs of broken HTML
      const hasBody = content.includes('<body') && content.includes('</body>');
      const hasHtml = content.includes('<html') && content.includes('</html>');
      const hasHead = content.includes('<head') && content.includes('</head>');
      const contentLength = content.length;
      
      // If HTML structure is fundamentally broken, log warning
      if (!hasBody || !hasHtml || !hasHead) {
        console.log(`⚠️ WARNING: ${file.path} has broken HTML structure (body: ${hasBody}, html: ${hasHtml}, head: ${hasHead})`);
      }
      
      // If page is too short (likely empty/broken), log warning
      if (contentLength < 500 && file.path === 'index.html') {
        console.log(`⚠️ WARNING: ${file.path} is suspiciously short (${contentLength} chars)`);
      }
      
      // Check for content inside body (not just structure)
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        const bodyContent = bodyMatch[1].trim();
        // Remove scripts and whitespace to check actual content
        const cleanBody = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\s+/g, ' ').trim();
        
        if (cleanBody.length < 200 && file.path === 'index.html') {
          console.log(`⚠️ WARNING: ${file.path} has very little content in body (${cleanBody.length} chars after cleanup)`);
        }
      }
      
      // Ensure proper encoding for Cyrillic if detected
      if (/[а-яА-ЯїЇєЄіІґҐёЁ]/.test(content) && !content.includes('charset=')) {
        content = content.replace('<head>', '<head>\n    <meta charset="UTF-8">');
        console.log(`📝 Added charset UTF-8 to ${file.path} for Cyrillic support`);
      }
      
      return { ...file, content };
    });
  };

  // NEW: Repair empty/near-empty HTML pages (sometimes model returns blank secondary pages)
  const ensureNonEmptyHtmlPages = (
    generatedFiles: GeneratedFile[],
    lang: string,
    siteName?: string
  ): GeneratedFile[] => {
    const normalizeLangLocal = (l: string) => (l || "en").toLowerCase().trim().slice(0, 2);
    const L = normalizeLangLocal(lang);
    const name = (siteName || "Website").trim() || "Website";

    const hasStyles = generatedFiles.some((f) => f.path.toLowerCase() === "styles.css");

    const pages = generatedFiles
      .filter((f) => f.path.toLowerCase().endsWith(".html"))
      .map((f) => f.path)
      .sort();

    const navLinks = (() => {
      const preferred = [
        "index.html",
        "services.html",
        "about.html",
        "contact.html",
        "pricing.html",
        "portfolio.html",
        "blog.html",
      ];
      const set = new Set(pages.map((p) => p.toLowerCase()));
      const final: string[] = [];
      for (const p of preferred) if (set.has(p)) final.push(p);
      // Add up to 3 extra pages if present
      for (const p of pages) {
        const lower = p.toLowerCase();
        if (final.length >= 7) break;
        if (!final.includes(lower) && lower !== "200.html" && lower !== "404.html") {
          final.push(p);
        }
      }
      if (!final.includes("index.html")) final.unshift("index.html");
      return final;
    })();

    const t = {
      title:
        L === "ru"
          ? "Страница временно недоступна"
          : L === "uk"
            ? "Сторінка тимчасово недоступна"
            : L === "de"
              ? "Seite vorübergehend nicht verfügbar"
              : "Page temporarily unavailable",
      desc:
        L === "ru"
          ? "Эта страница сгенерировалась неполной. Мы восстановили её безопасной версией, чтобы сайт не содержал пустых страниц."
          : L === "uk"
            ? "Ця сторінка згенерувалася неповною. Ми відновили її безпечною версією, щоб сайт не містив порожніх сторінок."
            : L === "de"
              ? "Diese Seite wurde unvollständig generiert. Wir haben eine sichere Version wiederhergestellt, damit die Website keine leeren Seiten enthält."
              : "This page was generated incompletely. We restored a safe version so the site has no empty pages.",
      back:
        L === "ru"
          ? "На главную"
          : L === "uk"
            ? "На головну"
            : L === "de"
              ? "Zur Startseite"
              : "Back to home",
    } as const;

    const makeFallbackHtml = (filePath: string) => {
      const nav = navLinks
        .filter((p) => p)
        .map((p) => {
          const label = p
            .replace(/\.html$/i, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (m) => m.toUpperCase());
          const active = p.toLowerCase() === filePath.toLowerCase();
          return `<a class="nav-link${active ? " is-active" : ""}" href="${p}">${label}</a>`;
        })
        .join("\n");

      return `<!doctype html>
<html lang="${L}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name} — ${t.title}</title>
    ${hasStyles ? '<link rel="stylesheet" href="styles.css" />' : ""}
    <style>
      /* Fallback page styles (only used when a page was empty) */
      :root { --fallback-bg: #0b1220; --fallback-fg: #e7e9ee; --fallback-muted: rgba(231,233,238,.7); --fallback-card: rgba(255,255,255,.06); --fallback-border: rgba(255,255,255,.14); }
      body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: var(--fallback-bg); color: var(--fallback-fg); }
      .wrap { min-height: 100vh; display: flex; flex-direction: column; }
      header { border-bottom: 1px solid var(--fallback-border); background: rgba(255,255,255,.02); }
      .bar { max-width: 1120px; margin: 0 auto; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .brand { font-weight: 700; letter-spacing: .2px; }
      nav { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
      .nav-link { color: var(--fallback-muted); text-decoration: none; font-size: 14px; padding: 6px 10px; border-radius: 999px; border: 1px solid transparent; }
      .nav-link:hover { color: var(--fallback-fg); border-color: var(--fallback-border); }
      .nav-link.is-active { color: var(--fallback-fg); border-color: var(--fallback-border); background: var(--fallback-card); }
      main { flex: 1; }
      .content { max-width: 1120px; margin: 0 auto; padding: 64px 20px; }
      .card { background: var(--fallback-card); border: 1px solid var(--fallback-border); border-radius: 18px; padding: 28px; }
      h1 { margin: 0 0 10px; font-size: clamp(24px, 3vw, 34px); }
      p { margin: 0 0 18px; color: var(--fallback-muted); line-height: 1.6; }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
      .btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--fallback-border); text-decoration: none; color: var(--fallback-fg); background: rgba(255,255,255,.04); }
      .btn:hover { background: rgba(255,255,255,.08); }
      footer { border-top: 1px solid var(--fallback-border); background: rgba(255,255,255,.02); }
      .foot { max-width: 1120px; margin: 0 auto; padding: 16px 20px; color: var(--fallback-muted); font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div class="bar">
          <div class="brand">${name}</div>
          <nav aria-label="Primary">
            ${nav}
          </nav>
        </div>
      </header>
      <main>
        <div class="content">
          <div class="card">
            <h1>${t.title}</h1>
            <p>${t.desc}</p>
            <div class="actions">
              <a class="btn" href="index.html">${t.back}</a>
            </div>
          </div>
        </div>
      </main>
      <footer>
        <div class="foot">© ${new Date().getFullYear()} ${name}</div>
      </footer>
    </div>
  </body>
</html>`;
    };

    const countMatches = (s: string, re: RegExp) => (s.match(re) || []).length;

    const isProbablyEmptyOrThin = (html: string, filePath: string) => {
      const trimmed = (html || "").trim();
      if (!trimmed) return true;
      // Very small HTML is almost always a broken/truncated page.
      if (trimmed.length < 220) return true;

      // Catch "thin" pages (not empty, but clearly incomplete):
      // - secondary pages: under ~900 chars are usually just header/footer
      // - index: allow slightly smaller, but still needs substance
      const lower = (filePath || "").toLowerCase();
      const isIndex = lower === "index.html";
      const minHtmlChars = isIndex ? 1200 : 900;
      if (trimmed.length < minHtmlChars) return true;

      const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const rawBody = bodyMatch?.[1] || trimmed;
      const bodyText = rawBody
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<!--([\s\S]*?)-->/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // If almost no readable text, treat as empty.
      if (bodyText.length < 80) return true;

      // For "thin" pages, require more than a couple of sentences.
      // This prevents "header + hero title" pages slipping through.
      const minBodyText = isIndex ? 260 : 180;
      if (bodyText.length < minBodyText) return true;

      // Heuristic: page should have some structure (sections/headings/lists).
      // If structure is missing and text is still low, it's likely incomplete.
      const sectionCount = countMatches(rawBody, /<section\b[^>]*>/gi);
      const headingCount = countMatches(rawBody, /<h[12]\b[^>]*>/gi);
      const pCount = countMatches(rawBody, /<p\b[^>]*>/gi);
      const liCount = countMatches(rawBody, /<li\b[^>]*>/gi);
      const structuralScore = sectionCount + headingCount + Math.min(pCount, 6) + Math.min(liCount, 6);
      if (structuralScore < 4 && bodyText.length < 420) return true;

      // Catch common "empty" placeholders
      if (/\b(?:null|undefined|lorem ipsum)\b/i.test(bodyText) && bodyText.length < 250) return true;
      return false;
    };

    return generatedFiles.map((file) => {
      if (!file.path.toLowerCase().endsWith(".html")) return file;

      // Don't replace helper pages here; they are handled by ensureMandatoryPages already.
      const lower = file.path.toLowerCase();
      if (lower === "404.html" || lower === "200.html") return file;

      if (!isProbablyEmptyOrThin(file.content, file.path)) return file;

      console.log(`🧱 Repaired empty/thin page: ${file.path} (${file.content?.length || 0} chars)`);
      return { ...file, content: makeFallbackHtml(file.path) };
    });
  };

  // NEW: Remove emojis and instruction symbols from generated content
  // This fixes AI hallucination where it copies emojis from the prompt into HTML
  const removeEmojisFromContent = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    // Comprehensive emoji pattern that covers:
    // - Emoticons (1F600–1F64F)
    // - Miscellaneous Symbols and Pictographs (1F300–1F5FF)
    // - Transport and Map Symbols (1F680–1F6FF)
    // - Flags (1F1E0–1F1FF)
    // - Supplemental Symbols (1F900–1F9FF)
    // - Chess, Playing Cards, etc (2600–26FF, 2700–27BF)
    // - CJK symbols, arrows, misc (2300–23FF, 25A0–25FF)
    // - Regional indicators, variation selectors
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{25A0}-\u{25FF}]|[\u{2B50}]|[\u{2934}-\u{2935}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;
    
    return generatedFiles.map(file => {
      // Only process HTML, CSS, JS files - skip binary/assets
      if (!/\.(html?|css|js|jsx|tsx?)$/i.test(file.path)) return file;
      
      let content = file.content;
      let removedCount = 0;
      
      // Count emojis before removal
      const emojiMatches = content.match(emojiPattern);
      if (emojiMatches) {
        removedCount = emojiMatches.length;
      }
      
      // Remove emojis from content
      content = content.replace(emojiPattern, '');
      
      // Also remove common instruction markers that might leak through
      // These are patterns from the prompt that should never appear in output
      const instructionPatterns = [
        /⛔+/g,
        /🚨+/g,
        /⚠️+/g,
        /❌+/g,
        /✅+/g,
        /👤+/g,
        /👥+/g,
        /📞+/g,
        /📧+/g,
        /💡+/g,
        /🔥+/g,
        /🎯+/g,
        /📁+/g,
        /🌍+/g,
        /🍪+/g,
        /🙏+/g,
        /🗺️+/g,
        /📸+/g,
        /🏢+/g,
      ];
      
      for (const pattern of instructionPatterns) {
        content = content.replace(pattern, '');
      }
      
      // Clean up any resulting double spaces or empty lines
      content = content.replace(/  +/g, ' ');
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      if (removedCount > 0) {
        console.log(`🧹 Removed ${removedCount} emoji(s)/symbol(s) from ${file.path}`);
      }
      
      return { ...file, content };
    });
  };

  // Apply all mandatory file checks
  let finalFiles = ensureCookieBannerFile(files);
  finalFiles = ensureQualityCSS(finalFiles);
  finalFiles = fixPlaceholderImages(finalFiles); // Fix placeholder images
  finalFiles = removeEmojisFromContent(finalFiles); // Remove emojis and instruction symbols
  finalFiles = validateHtmlContent(finalFiles); // Validate HTML content
  finalFiles = ensureMandatoryPages(finalFiles, language || "en");
  finalFiles = ensureNonEmptyHtmlPages(finalFiles, language || "en", siteName);
  finalFiles = ensureBilingualI18nInFiles(finalFiles, bilingualLanguages, siteName);
  console.log(`📁 Final files count (with all mandatory files): ${finalFiles.length}`);

  return {
    success: true,
    files: finalFiles,
    refinedPrompt,
    totalFiles: finalFiles.length,
    fileList: finalFiles.map((f) => f.path),
    totalCost,
    specificModel: modelUsed,
  };
}

async function runBackgroundGeneration(
  historyId: string,
  userId: string,
  prompt: string,
  language: string | undefined,
  aiModel: "junior" | "senior",
  layoutStyle?: string,
  imageSource: "basic" | "ai" = "basic",
  teamId: string | null = null,
  salePrice: number = 0,
  siteName?: string,
  geo?: string,
  bilingualLanguages?: string[] | null
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[BG] Starting background generation for history ID: ${historyId}, team: ${teamId}, salePrice: $${salePrice}`);

  try {
    // Balance was already deducted in main handler - just update status to generating
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    const result = await runGeneration({ prompt, language, aiModel, layoutStyle, imageSource, siteName, bilingualLanguages });

    if (result.success && result.files) {
      // Prefer explicit geo passed from client, fallback to extracting from prompt
      const geoMatch = prompt.match(/(?:geo|country|страна|країна|гео)[:\s]*([^\n,;]+)/i);
      const geoFromPrompt = geoMatch ? geoMatch[1].trim() : undefined;
      const geoToUse = geo || geoFromPrompt;

      const explicit = extractExplicitBrandingFromPrompt(prompt);
      const desiredSiteName = explicit.siteName || siteName;
      const desiredPhone = explicit.phone;

      console.log(`[BG] Extracted branding - siteName: "${desiredSiteName}", phone: "${desiredPhone}"`);

      // CRITICAL behavior:
      // - If phone is explicitly provided in prompt -> enforce EXACTLY that phone and DO NOT "fix" it.
      // - If phone is NOT provided -> generate a realistic phone based on geo and enforce it (so every site has a phone).
      let enforcedFiles = result.files;

      // ALWAYS fix broken image URLs first (AI hallucination issue where phone numbers appear in image URLs)
      // This must happen BEFORE any phone enforcement to avoid double-processing
      const fixedImageFiles = enforcedFiles.map(f => {
        if (!/\.(html?|php|jsx?|tsx?)$/i.test(f.path)) return f;
        const { content, fixed } = fixBrokenImageUrls(f.content);
        if (fixed > 0) {
          console.log(`[BG] Fixed ${fixed} broken image URL(s) in ${f.path}`);
        }
        return { ...f, content };
      });
      enforcedFiles = fixedImageFiles;

      if (desiredPhone) {
        // User provided phone in prompt - enforce it directly without "fixing" first
        console.log(`[BG] Using explicit phone from prompt: "${desiredPhone}" - skipping phone number fixing`);
        enforcedFiles = enforcePhoneInFiles(enforcedFiles, desiredPhone);
        console.log(`[BG] Enforced phone "${desiredPhone}" across all files`);
      } else {
        // No explicit phone - fix invalid placeholders, then enforce an auto-generated regional phone
        const { files: fixedFiles, totalFixed } = fixPhoneNumbersInFiles(enforcedFiles, geoToUse);
        if (totalFixed > 0) {
          console.log(`[BG] Fixed ${totalFixed} invalid phone number(s) in generated files`);
        }
        const autoPhone = generateRealisticPhone(geoToUse);
        console.log(`[BG] No phone in prompt. Auto-generated regional phone: "${autoPhone}" (geo: "${geoToUse || 'default'}")`);
        enforcedFiles = enforcePhoneInFiles(fixedFiles, autoPhone);
        console.log(`[BG] Enforced auto-generated phone "${autoPhone}" across all files`);
      }
       enforcedFiles = enforceSiteNameInFiles(enforcedFiles, desiredSiteName);
       enforcedFiles = enforceEmailInFiles(enforcedFiles, desiredSiteName);
       enforcedFiles = enforceResponsiveImagesInFiles(enforcedFiles);
       enforcedFiles = enforceUiUxBaselineInFiles(enforcedFiles);

       // CRITICAL: HTML generations MUST always include 200.html + 404.html.
       // Do this in background flow too (otherwise DB gets saved without these files).
       enforcedFiles = ensureMandatoryPages(enforcedFiles, language || "en");
       enforcedFiles = ensureBilingualI18nInFiles(enforcedFiles, bilingualLanguages, desiredSiteName);

       // Ensure branding assets exist AND are linked in ALL html pages (including 200/404 added above)
       enforcedFiles = ensureFaviconAndLogoInFiles(enforcedFiles, desiredSiteName);
      
      // CRITICAL: Enforce business hours in footer
      enforcedFiles = enforceBusinessHoursInFiles(enforcedFiles, language);
      console.log(`[BG] Enforced business hours in footers (language: ${language || 'en'})`);
      
      // Run contact page validation (phone/email in contact.html, contact links in footers)
      // CRITICAL: Pass the phone to ensure it's on ALL pages and clickable
      const phoneForValidation = desiredPhone || generateRealisticPhone(geoToUse);
      const { files: contactValidatedFiles, warnings: contactWarnings } = runContactValidation(enforcedFiles, geoToUse, language, phoneForValidation);
      enforcedFiles = contactValidatedFiles;
      if (contactWarnings.length > 0) {
        console.log(`[BG] Contact validation applied ${contactWarnings.length} fixes (phone: ${phoneForValidation})`);
      }

      // Create zip base64 with fixed files
      const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
      const zip = new JSZip();

      // Bundle external images (Picsum/Pexels) into ZIP as real files under assets/
      // and rewrite HTML/CSS references to those local files.
      const bundled = await bundleExternalImagesForZip(enforcedFiles);
      if (bundled.downloadedCount > 0) {
        console.log(`[ZIP] Bundled ${bundled.downloadedCount} image(s) into ZIP`);
      }
      const zipTextFiles = bundled.textFiles;
      const zipBinaryFiles = bundled.binaryFiles;

      zipTextFiles.forEach((file) => {
        if (/\.ico$/i.test(file.path)) {
          zip.file(file.path, file.content, { base64: true });
        } else {
          zip.file(file.path, file.content);
        }
      });

      for (const bf of zipBinaryFiles) {
        zip.file(bf.path, bf.base64, { base64: true });
      }
      const zipBase64 = await zip.generateAsync({ type: "base64" });

      // Update with success including generation cost and completion time
      const generationCost = result.totalCost || 0;
        await supabase
          .from("generation_history")
          .update({
            status: "completed",
            files_data: enforcedFiles,
            zip_data: zipBase64,
            generation_cost: generationCost,
            specific_ai_model: result.specificModel || null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", historyId);

      // Create notification for user
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_complete",
        title: "Сайт згенеровано",
        message: `HTML сайт успішно створено (${enforcedFiles.length} файлів)`,
        data: { historyId, filesCount: enforcedFiles.length }
      });

      console.log(`[BG] Generation completed for ${historyId}: ${enforcedFiles.length} files, sale: $${salePrice}, cost: $${generationCost.toFixed(4)}`);
    } else {
      // REFUND balance on failure
      if (teamId && salePrice > 0) {
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", teamId)
          .single();

        if (team) {
          await supabase
            .from("teams")
            .update({ balance: (team.balance || 0) + salePrice })
            .eq("id", teamId);
          console.log(`[BG] REFUNDED $${salePrice} to team ${teamId} due to failure`);
        }
      }

      // Update with error - CRITICAL: Also record specific_ai_model for debugging
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "Generation failed",
          sale_price: 0, // Reset sale_price since refunded
          specific_ai_model: result.specificModel || "unknown",
        })
        .eq("id", historyId);

      // Create notification for user about failure
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_failed",
        title: "Помилка генерації",
        message: result.error || "Не вдалося згенерувати сайт",
        data: { historyId, error: result.error }
      });

      console.error(`[BG] Generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] Background generation error for ${historyId}:`, error);

    // REFUND balance on error
    if (teamId && salePrice > 0) {
      try {
        const { data: team } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", teamId)
          .single();

        if (team) {
          await supabase
            .from("teams")
            .update({ balance: (team.balance || 0) + salePrice })
            .eq("id", teamId);
          console.log(`[BG] REFUNDED $${salePrice} to team ${teamId} due to error`);
        }
      } catch (refundError) {
        console.error(`[BG] Failed to refund:`, refundError);
      }
    }

    await supabase
      .from("generation_history")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        sale_price: 0, // Reset sale_price since refunded
        specific_ai_model: "error_before_model_selection",
      })
      .eq("id", historyId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("Request rejected: No authorization header");
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT (server-side) using auth.getUser(token). This is more reliable than local verification.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!authHeader.startsWith("Bearer ")) {
      console.warn("Request rejected: invalid authorization header format");
      return new Response(JSON.stringify({ code: 401, message: "Invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Create client with user's token for validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("JWT validation failed (getUser):", userError);
      return new Response(JSON.stringify({ code: 401, message: "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Authenticated request from user:", userId);

    const { prompt, originalPrompt, improvedPrompt, language, aiModel = "senior", layoutStyle, siteName, imageSource = "basic", teamId: overrideTeamId, geo, bilingualLanguages, retryHistoryId } = await req.json();

    // Build prompt with language and geo context if provided
    let promptForGeneration = prompt;
    
    // Check if this is a bilingual site request
    const isBilingual = bilingualLanguages && Array.isArray(bilingualLanguages) && bilingualLanguages.length === 2;
    
    if (isBilingual) {
      // Bilingual site generation - create a site with language switcher
      const languageNames: Record<string, string> = {
        en: "English", uk: "Ukrainian", ru: "Russian", de: "German", fr: "French",
        es: "Spanish", it: "Italian", pt: "Portuguese", pl: "Polish", nl: "Dutch",
        cs: "Czech", bg: "Bulgarian", ro: "Romanian", hu: "Hungarian", tr: "Turkish",
        ja: "Japanese", vi: "Vietnamese", th: "Thai", id: "Indonesian", hi: "Hindi",
        ar: "Arabic", el: "Greek", fi: "Finnish", sv: "Swedish", da: "Danish",
        hr: "Croatian", sk: "Slovak", sl: "Slovenian", et: "Estonian", lv: "Latvian", lt: "Lithuanian"
      };
      const lang1 = languageNames[bilingualLanguages[0]] || bilingualLanguages[0];
      const lang2 = languageNames[bilingualLanguages[1]] || bilingualLanguages[1];
      
       promptForGeneration = `[BILINGUAL WEBSITE: ${lang1} + ${lang2}]
 CRITICAL BILINGUAL SITE REQUIREMENTS (ONE HTML SET + JS):

 This website MUST support TWO languages: ${lang1} and ${lang2}.

 1) FILE STRUCTURE (IMPORTANT):
    - Generate ONE set of pages ONLY (NO duplicated pages per language):
      index.html, about.html, services.html, contact.html, etc.

 2) I18N IMPLEMENTATION (REQUIRED):
    - Create: i18n/translations.js
      - Must set: window.__SITE_TRANSLATIONS__ = { "${bilingualLanguages[0]}": {...}, "${bilingualLanguages[1]}": {...} }
    - Create: i18n/i18n.js
      - Chooses language priority:
        (a) URL param ?lang=xx
        (b) localStorage.siteLang
        (c) browser language (navigator.languages)
        (d) fallback to first language (${bilingualLanguages[0]})
      - Replaces texts at runtime by reading HTML attributes:
        * data-i18n="some.key" (textContent)
        * data-i18n-placeholder="some.key" (placeholder)
        * data-i18n-title="some.key" (title)
        * data-i18n-aria="some.key" (aria-label)

 3) LANGUAGE SWITCHER (EXTREMELY IMPORTANT):
    - MUST be visible in the header on EVERY page.
    - Labels must be: "${bilingualLanguages[0].toUpperCase()} | ${bilingualLanguages[1].toUpperCase()}".
    - Clicking language switches without needing separate HTML files.
    - Active language highlighted with .lang-active.

 4) STRICT TRANSLATION:
    - The whole site must be fully translated in both languages via the i18n system.
    - DO NOT mix languages in the same string.

 ${promptForGeneration}`;
      
      console.log(`🌐 Bilingual site generation: ${lang1} + ${lang2}`);
    } else if (language && language !== "auto") {
      // Single language site (existing logic)
      const languageNames: Record<string, string> = {
        en: "English", uk: "Ukrainian", ru: "Russian", de: "German", fr: "French",
        es: "Spanish", it: "Italian", pt: "Portuguese", pl: "Polish", nl: "Dutch",
        cs: "Czech", bg: "Bulgarian", ro: "Romanian", hu: "Hungarian", tr: "Turkish",
        ja: "Japanese", vi: "Vietnamese", th: "Thai", id: "Indonesian", hi: "Hindi",
        ar: "Arabic", el: "Greek", fi: "Finnish", sv: "Swedish", da: "Danish",
        hr: "Croatian", sk: "Slovak", sl: "Slovenian", et: "Estonian", lv: "Latvian", lt: "Lithuanian"
      };
      const langName = languageNames[language] || language;
      promptForGeneration = `[TARGET LANGUAGE: ${langName}]
CRITICAL LANGUAGE REQUIREMENT - ALL CONTENT MUST BE IN ${langName.toUpperCase()}:
- ALL text on ALL pages must be written in ${langName}
- Navigation menu items in ${langName}
- All headings, paragraphs, buttons, form labels in ${langName}
- Footer text, copyright notice in ${langName}
- Privacy Policy, Terms of Service, Cookie Policy - ALL in ${langName}
- Meta titles and descriptions in ${langName}
- Error messages and form validation in ${langName}
- DO NOT use any other language unless specifically requested

${promptForGeneration}`;
    }
    
    if (geo && geo !== "none") {
      const geoNames: Record<string, string> = {
        uk: "United Kingdom", bg: "Bulgaria", cz: "Czech Republic", de: "Germany",
        es: "Spain", fr: "France", hu: "Hungary", it: "Italy", pl: "Poland",
        pt: "Portugal", ro: "Romania", tr: "Turkey", nl: "Netherlands", ru: "Russia",
        jp: "Japan", ua: "Ukraine", hr: "Croatia", dk: "Denmark", ee: "Estonia",
        fi: "Finland", gr: "Greece", lv: "Latvia", lt: "Lithuania", sk: "Slovakia",
        si: "Slovenia", se: "Sweden", vn: "Vietnam", th: "Thailand", id: "Indonesia",
        in: "India", ae: "United Arab Emirates", us: "United States"
      };
      const countryName = geoNames[geo];
      if (countryName) {
        promptForGeneration = `${prompt}\n\n[TARGET COUNTRY: ${countryName}]
CRITICAL GEO REQUIREMENTS - ALL CONTENT MUST BE LOCALIZED FOR ${countryName.toUpperCase()}:

1. **PHYSICAL ADDRESS**: Generate a REALISTIC address from ${countryName}:
   - Use REAL street names that exist in ${countryName}
   - Use correct postal/ZIP code format for ${countryName}
   - Use a major city from ${countryName}
   - Example addresses by country:
     * Germany: Friedrichstraße 147, 10117 Berlin
     * Poland: ul. Nowy Świat 47, 00-042 Warszawa
     * Spain: Calle Serrano 47, 28001 Madrid
     * France: 47 Rue du Faubourg Saint-Honoré, 75008 Paris
     * Italy: Via del Corso 147, 00186 Roma
     * UK: 47 King's Road, London SW3 4ND
     * USA: 847 Madison Avenue, New York, NY 10065
     * Netherlands: Herengracht 147, 1015 BH Amsterdam
     * Czech Republic: Václavské náměstí 47, 110 00 Praha 1
     * Portugal: Avenida da Liberdade 147, 1250-096 Lisboa

2. **PHONE NUMBER**: Use the EXACT phone format for ${countryName} - ONLY ONE COUNTRY CODE:
   - NEVER duplicate the country code (e.g., WRONG: "+49 +49", CORRECT: "+49")
   - Germany: +49 30 2897 6543 or +49 89 4521 7892
   - Poland: +48 22 593 27 41 or +48 12 784 63 18
   - Spain: +34 912 643 781 or +34 932 815 694
   - France: +33 1 42 68 53 21 or +33 4 93 78 62 14
   - Italy: +39 06 8745 6329 or +39 02 7698 3214
   - UK: +44 20 7946 0958 or +44 161 496 0753
   - USA: +1 (212) 647-3812 or +1 (415) 781-2946
   - Netherlands: +31 20 794 5682 or +31 10 593 2741
   - Czech Republic: +420 221 643 781 or +420 257 891 643
   - Ukraine: +380 44 239 4187 or +380 67 381 2946
   - Russia: +7 495 239 4187 or +7 812 381 2946
   - Portugal: +351 21 938 4672 or +351 22 847 6391

3. **EMAIL**: Create email based on business name/domain:
   - Format: info@<businessname>.com (lowercase, no spaces)
   - Example: "Green Garden" → info@greengarden.com

4. **BUSINESS CONTEXT**: All content should feel native to ${countryName} market
5. **DO NOT** use addresses or phone numbers from other countries
6. The address MUST appear in the contact section and footer`;
      }
    }
    
    // Add siteName to the prompt if provided
    if (siteName && siteName.trim()) {
      promptForGeneration = `[SITE NAME: ${siteName}]
CRITICAL SITE NAME REQUIREMENT:
- The website/business/brand name MUST be "${siteName}"
- Use this EXACT name "${siteName}" in:
  * The logo in header
  * The page titles (e.g., "Home - ${siteName}")
  * The footer copyright (e.g., "© 2024 ${siteName}. All rights reserved.")
  * The meta title tags
  * Any references to the company/brand/business
- DO NOT invent a different name
- DO NOT use generic names like "Company" or "Business"

${promptForGeneration}`;
    }
    
    // Store the original prompt (what user submitted) and improved prompt separately
    const promptToSave = originalPrompt || prompt;
    const improvedPromptToSave = improvedPrompt || null;

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IMMEDIATELY determine team and deduct balance BEFORE starting generation
    let teamId: string | null = overrideTeamId || null;
    let salePrice = 0;

    // If no override teamId, get user's team membership
    if (!teamId) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      if (membership) {
        teamId = membership.team_id;
      }
    }

    // Get pricing and DEDUCT balance IMMEDIATELY
    if (teamId) {
      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("html_price")
        .eq("team_id", teamId)
        .maybeSingle();

      salePrice = pricing?.html_price || 0;
      
      // Add $2 for AI photo search
      if (imageSource === "ai") {
        salePrice += 2;
        console.log(`Added $2 for AI photo search. Total salePrice: $${salePrice}`);
      }
      
      // Add $3 for bilingual site
      if (bilingualLanguages && Array.isArray(bilingualLanguages) && bilingualLanguages.length === 2) {
        salePrice += 3;
        console.log(`Added $3 for bilingual site (${bilingualLanguages.join(", ")}). Total salePrice: $${salePrice}`);
      }

      if (salePrice > 0) {
        const { data: team } = await supabase
          .from("teams")
          .select("balance, credit_limit")
          .eq("id", teamId)
          .single();

        if (team) {
          const currentBalance = team.balance || 0;
          const creditLimit = team.credit_limit || 0;
          const newBalance = currentBalance - salePrice;
          
          // Check if new balance would exceed credit limit
          // credit_limit is the maximum allowed debt (stored as positive number)
          if (newBalance < -creditLimit) {
            console.log(`🚫 BLOCKED: Team ${teamId} would exceed credit limit. Balance: $${currentBalance}, Cost: $${salePrice}, Credit limit: $${creditLimit}`);
            return new Response(JSON.stringify({ 
              success: false, 
              error: `Перевищено кредитний ліміт. Поточний баланс: $${currentBalance.toFixed(2)}, вартість: $${salePrice}, ліміт: $${creditLimit}. Поповніть баланс для продовження.` 
            }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          await supabase
            .from("teams")
            .update({ balance: newBalance })
            .eq("id", teamId);
          console.log(`💰 IMMEDIATELY deducted $${salePrice} from team ${teamId} BEFORE starting generation. New balance: $${newBalance}`);
        }
      }
    }

    // Handle retry: update existing record OR create new one
    let historyEntry: { id: string } | null = null;
    
    if (retryHistoryId) {
      // RETRY MODE: Update existing failed record instead of creating new one
      console.log(`🔄 RETRY MODE: Updating existing record ${retryHistoryId}`);
      
      const { data: existingRecord, error: fetchError } = await supabase
        .from("generation_history")
        .select("id, status, user_id")
        .eq("id", retryHistoryId)
        .single();
      
      if (fetchError || !existingRecord) {
        console.error("Failed to find retry record:", fetchError);
        // Refund if already deducted
        if (teamId && salePrice > 0) {
          const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
          if (team) {
            await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
          }
        }
        return new Response(JSON.stringify({ success: false, error: "Retry record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Verify ownership
      if (existingRecord.user_id !== userId) {
        if (teamId && salePrice > 0) {
          const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
          if (team) {
            await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
          }
        }
        return new Response(JSON.stringify({ success: false, error: "Unauthorized retry" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Update existing record to pending status
      const { error: updateError } = await supabase
        .from("generation_history")
        .update({
          status: "pending",
          error_message: null,
          files_data: null,
          zip_data: null,
          completed_at: null,
          sale_price: salePrice,
        })
        .eq("id", retryHistoryId);
      
      if (updateError) {
        console.error("Failed to update retry record:", updateError);
        if (teamId && salePrice > 0) {
          const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
          if (team) {
            await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
          }
        }
        return new Response(JSON.stringify({ success: false, error: "Failed to start retry" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      historyEntry = { id: retryHistoryId };
      console.log(`🔄 Updated existing record for retry: ${retryHistoryId}`);
    } else {
      // Create NEW history entry
      const { data: newEntry, error: insertError } = await supabase
        .from("generation_history")
        .insert({
          prompt: promptToSave,
          improved_prompt: improvedPromptToSave,
          language: language || "auto",
          user_id: userId,
          team_id: teamId || null,
          status: "pending",
          ai_model: aiModel,
          website_type: "html",
          site_name: siteName || null,
          image_source: imageSource || "basic",
          sale_price: salePrice,
          geo: geo || null,
        })
        .select()
        .single();

      if (insertError || !newEntry) {
        console.error("Failed to create history entry:", insertError);
        if (teamId && salePrice > 0) {
          const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
          if (team) {
            await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
          }
        }
        return new Response(JSON.stringify({ success: false, error: "Failed to start generation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      historyEntry = newEntry;
    }
    
    // historyEntry is guaranteed to be non-null at this point
    const historyId = historyEntry!.id;
    console.log("Using history entry:", historyId);

    // Start background generation using EdgeRuntime.waitUntil
    // Pass salePrice and teamId for potential refund on error
    // IMPORTANT: Use promptForGeneration which includes language and geo instructions
    EdgeRuntime.waitUntil(
      runBackgroundGeneration(
        historyId,
        userId,
        promptForGeneration,
        language,
        aiModel,
        layoutStyle,
        imageSource,
        teamId,
        salePrice,
        siteName,
        geo,
        bilingualLanguages || null
      )
    );

    // Return immediately with the history entry ID
    return new Response(
      JSON.stringify({
        success: true,
        historyId: historyId,
        message: "Generation started in background",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
