import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ PHONE NUMBER VALIDATION & FIXING ============
const INVALID_PHONE_PATTERNS = [
  /\b\d{3}[-.\s]?\d{4}\b(?!\d)/g,
  /\b\(?555\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
  /\b123[-.\s]?456[-.\s]?7890\b/g,
  /\b0{6,}\b/g,
  /\b9{6,}\b/g,
  /\b1{6,}\b/g,
  /\bXXX[-.\s]?XXX[-.\s]?XXXX\b/gi,
];

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) return false;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 10) return false;
  
  // Check for DUPLICATE country codes (e.g., +353+353, +49+49, etc.)
  if (/\+\d+.*\+\d+/.test(phone)) return false; // Multiple + signs = duplicate codes
  
  // Check for repeated country code at start of digits
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  for (let codeLen = 1; codeLen <= 3; codeLen++) {
    const potentialCode = digitsOnly.substring(0, codeLen);
    const afterCode = digitsOnly.substring(codeLen);
    if (afterCode.startsWith(potentialCode) && potentialCode.length >= 1) {
      const doubleCode = potentialCode + potentialCode;
      if (digitsOnly.startsWith(doubleCode)) {
        return false; // Likely duplicate country code
      }
    }
  }
  
  if (/^(\d)\1{6,}$/.test(digits)) return false;
  if (/123456|654321|4567890|7654321/.test(digits)) return false;
  if (/555\d{7}/.test(digits)) return false;
  return true;
}

function generateRealisticPhone(geo?: string): string {
  const geoLower = (geo || '').toLowerCase();
  const geoToken = geoLower.trim();

  const randomDigits = (count: number) => {
    let result = '';
    for (let i = 0; i < count; i++) result += Math.floor(Math.random() * 10).toString();
    if (/^(\d)\1+$/.test(result)) return randomDigits(count);
    return result;
  };

  const hasGeoCode = (code: string) => geoToken === code || new RegExp(`\\b${code}\\b`, 'i').test(geoLower);

  // Portugal +351
  if (geoLower.includes('portugal') || geoLower.includes('portugu') || geoLower.includes('португал') || hasGeoCode('pt')) {
    return `+351 21${Math.floor(Math.random() * 10)} ${randomDigits(3)} ${randomDigits(3)}`;
  }
  // Germany +49
  if (geoLower.includes('germany') || geoLower.includes('deutschland') || geoLower.includes('німеч') || hasGeoCode('de')) {
    const areaCodes = ['30', '40', '69', '89', '221'];
    return `+49 ${areaCodes[Math.floor(Math.random() * areaCodes.length)]} ${randomDigits(3)} ${randomDigits(4)}`;
  }
  // Austria +43
  if (geoLower.includes('austria') || geoLower.includes('österreich') || geoLower.includes('австрі') || hasGeoCode('at')) return `+43 1 ${randomDigits(3)} ${randomDigits(4)}`;
  // Switzerland +41
  if (geoLower.includes('switzerland') || geoLower.includes('schweiz') || geoLower.includes('швейцар') || hasGeoCode('ch')) return `+41 44 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  // UK +44
  if (geoLower.includes('united kingdom') || geoLower.includes('britain') || geoLower.includes('великобритан') || hasGeoCode('uk') || hasGeoCode('gb')) return `+44 20 ${randomDigits(4)} ${randomDigits(4)}`;
  // France +33
  if (geoLower.includes('france') || geoLower.includes('франц') || hasGeoCode('fr')) return `+33 1 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Spain +34
  if (geoLower.includes('spain') || geoLower.includes('españa') || geoLower.includes('іспан') || hasGeoCode('es')) return `+34 91 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Italy +39
  if (geoLower.includes('italy') || geoLower.includes('italia') || geoLower.includes('італ') || hasGeoCode('it')) return `+39 06 ${randomDigits(4)} ${randomDigits(4)}`;
  // Netherlands +31
  if (geoLower.includes('netherlands') || geoLower.includes('nederland') || geoLower.includes('нідерланд') || hasGeoCode('nl')) return `+31 20 ${randomDigits(3)} ${randomDigits(4)}`;
  // Poland +48
  if (geoLower.includes('poland') || geoLower.includes('polska') || geoLower.includes('польщ') || hasGeoCode('pl')) return `+48 22 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  // USA +1
  if (geoLower.includes('united states') || geoLower.includes('america') || geoLower.includes('сша') || hasGeoCode('us')) {
    const areaCodes = ['212', '310', '415', '312', '617'];
    return `+1 (${areaCodes[Math.floor(Math.random() * areaCodes.length)]}) ${randomDigits(3)}-${randomDigits(4)}`;
  }
  // Canada +1
  if (geoLower.includes('canada') || geoLower.includes('канад') || hasGeoCode('ca')) {
    return `+1 (416) ${randomDigits(3)}-${randomDigits(4)}`;
  }
  // Ukraine +380
  if (geoLower.includes('ukrain') || geoLower.includes('україн') || hasGeoCode('ua')) return `+380 44 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Ireland +353
  if (geoLower.includes('ireland') || geoLower.includes('ірланд') || hasGeoCode('ie')) return `+353 1 ${randomDigits(3)} ${randomDigits(4)}`;
  // Czech +420
  if (geoLower.includes('czech') || geoLower.includes('чехі') || hasGeoCode('cz')) return `+420 2 ${randomDigits(4)} ${randomDigits(4)}`;
  // Bulgaria +359
  if (geoLower.includes('bulgaria') || geoLower.includes('болгар') || hasGeoCode('bg')) return `+359 2 ${randomDigits(3)} ${randomDigits(4)}`;
  // Belgium +32
  if (geoLower.includes('belgium') || geoLower.includes('бельгі') || hasGeoCode('be')) return `+32 2 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Vietnam +84
  if (geoLower.includes('vietnam') || geoLower.includes("в'єтнам") || hasGeoCode('vn')) return `+84 24 ${randomDigits(4)} ${randomDigits(4)}`;
  // Greece +30
  if (geoLower.includes('greece') || geoLower.includes('греці') || hasGeoCode('gr')) return `+30 21 ${randomDigits(4)} ${randomDigits(4)}`;
  // Denmark +45
  if (geoLower.includes('denmark') || geoLower.includes('данія') || hasGeoCode('dk')) return `+45 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Estonia +372
  if (geoLower.includes('estonia') || geoLower.includes('естоні') || hasGeoCode('ee')) return `+372 ${randomDigits(4)} ${randomDigits(4)}`;
  // Indonesia +62
  if (geoLower.includes('indonesia') || geoLower.includes('індонез') || hasGeoCode('id')) return `+62 21 ${randomDigits(4)} ${randomDigits(4)}`;
  // India +91
  if (geoLower.includes('india') || geoLower.includes('індія') || hasGeoCode('in')) return `+91 ${randomDigits(5)} ${randomDigits(5)}`;
  // Latvia +371
  if (geoLower.includes('latvia') || geoLower.includes('латві') || hasGeoCode('lv')) return `+371 ${randomDigits(4)} ${randomDigits(4)}`;
  // Lithuania +370
  if (geoLower.includes('lithuania') || geoLower.includes('литв') || hasGeoCode('lt')) return `+370 5 ${randomDigits(3)} ${randomDigits(4)}`;
  // UAE +971
  if (geoLower.includes('emirates') || geoLower.includes('оае') || hasGeoCode('ae')) return `+971 4 ${randomDigits(3)} ${randomDigits(4)}`;
  // Russia +7
  if (geoLower.includes('russia') || geoLower.includes('росі') || hasGeoCode('ru')) return `+7 495 ${randomDigits(3)}-${randomDigits(2)}-${randomDigits(2)}`;
  // Romania +40
  if (geoLower.includes('romania') || geoLower.includes('румуні') || hasGeoCode('ro')) return `+40 21 ${randomDigits(3)} ${randomDigits(4)}`;
  // Slovakia +421
  if (geoLower.includes('slovakia') || geoLower.includes('словаччин') || hasGeoCode('sk')) return `+421 2 ${randomDigits(4)} ${randomDigits(4)}`;
  // Slovenia +386
  if (geoLower.includes('slovenia') || geoLower.includes('словені') || hasGeoCode('si')) return `+386 1 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Thailand +66
  if (geoLower.includes('thailand') || geoLower.includes('таїланд') || hasGeoCode('th')) return `+66 2 ${randomDigits(3)} ${randomDigits(4)}`;
  // Turkey +90
  if (geoLower.includes('turkey') || geoLower.includes('туреч') || hasGeoCode('tr')) return `+90 212 ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Hungary +36
  if (geoLower.includes('hungary') || geoLower.includes('угорщ') || hasGeoCode('hu')) return `+36 1 ${randomDigits(3)} ${randomDigits(4)}`;
  // Finland +358
  if (geoLower.includes('finland') || geoLower.includes('фінлянд') || hasGeoCode('fi')) return `+358 9 ${randomDigits(4)} ${randomDigits(4)}`;
  // Croatia +385
  if (geoLower.includes('croatia') || geoLower.includes('хорват') || hasGeoCode('hr')) return `+385 1 ${randomDigits(4)} ${randomDigits(3)}`;
  // Sweden +46
  if (geoLower.includes('sweden') || geoLower.includes('швеці') || hasGeoCode('se')) return `+46 8 ${randomDigits(3)} ${randomDigits(3)} ${randomDigits(2)}`;
  // Norway +47
  if (geoLower.includes('norway') || geoLower.includes('норвег') || hasGeoCode('no')) return `+47 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
  // Japan +81
  if (geoLower.includes('japan') || geoLower.includes('японі') || hasGeoCode('jp')) return `+81 3 ${randomDigits(4)} ${randomDigits(4)}`;

  return `+49 30 ${randomDigits(3)} ${randomDigits(4)}`;
}

// Fix broken image URLs that contain phone numbers (AI hallucination issue)
function fixBrokenImageUrls(content: string): { content: string; fixed: number } {
  let fixed = 0;
  let result = content;
  
  // Pattern: image URLs containing phone-like patterns (+XX, spaces in URL, etc.)
  const BROKEN_IMG_URL_REGEX = /src=["'](https?:\/\/[^"']*\+\d+[^"']*|https?:\/\/images\.pexels\.com\/photos\/[^"']*\s+[^"']*)["']/gi;
  
  result = result.replace(BROKEN_IMG_URL_REGEX, () => {
    fixed++;
    const randomId = Math.floor(Math.random() * 5000000) + 1000000;
    return `src="https://images.pexels.com/photos/${randomId}/pexels-photo-${randomId}.jpeg?auto=compress&cs=tinysrgb&w=800"`;
  });
  
  const BROKEN_PICSUM_REGEX = /src=["'](https?:\/\/picsum\.photos\/[^"']*\+[^"']*)["']/gi;
  result = result.replace(BROKEN_PICSUM_REGEX, () => {
    fixed++;
    const seed = Math.random().toString(36).substring(7);
    return `src="https://picsum.photos/seed/${seed}/800/600"`;
  });
  
  return { content: result, fixed };
}

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

  // 2) Fix tel: links
  result = result.replace(/href=["']tel:([^"']+)["']/gi, (match, phone) => {
    if (!isValidPhone(String(phone))) {
      const newPhone = generateRealisticPhone(geo);
      fixed++;
      const tel = newPhone.replace(/[^\d+]/g, "");
      return `href="tel:${tel}"`;
    }
    return match;
  });

  // 3) Fix any visible phone-like strings with leading + (skip if in src="")
  const PLUS_PHONE_REGEX = /\+\d[\d\s().-]{7,}\d/g;
  result = result.replace(PLUS_PHONE_REGEX, (match, offset) => {
    const before = result.substring(Math.max(0, offset - 50), offset);
    if (/src=["'][^"']*$/i.test(before)) return match;
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

// Keep picsum.photos as-is - just fix broken phone numbers
// Images will be handled by the prompts instructing the AI to use reliable sources

function fixPhoneNumbersInFiles(files: Array<{ path: string; content: string }>, geo?: string): { files: Array<{ path: string; content: string }>; totalFixed: number } {
  let totalFixed = 0;
  const fixedFiles = files.map(file => {
    if (!/\.(html?|php|jsx?|tsx?|css)$/i.test(file.path)) return file;
    
    // Fix phones only
    const { content, fixed } = fixPhoneNumbersInContent(file.content, geo);
    totalFixed += fixed;
    
    return { ...file, content };
  });
  return { files: fixedFiles, totalFixed };
}

// Extract explicit SITE NAME / PHONE from VIP prompt (or other structured prompts)
function extractExplicitBrandingFromPrompt(prompt: string): { siteName?: string; phone?: string } {
  const out: { siteName?: string; phone?: string } = {};
  const nameMatch = prompt.match(/^(?:Name|SITE_NAME)\s*:\s*(.+)$/mi);
  if (nameMatch?.[1]) out.siteName = nameMatch[1].trim();

  const phoneMatch = prompt.match(/^(?:Phone|PHONE)\s*:\s*(.+)$/mi);
  if (phoneMatch?.[1]) out.phone = phoneMatch[1].trim();

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

  return files.map((f) => {
    if (!/\.(html?|php|jsx?|tsx?)$/i.test(f.path)) return f;

    let content = f.content;

    // Check for existing phone presence BEFORE modifications - NO global flag!
    const hadTelLink = /href=["']tel:/i.test(content);
    const hadPlusPhone = /\+\d[\d\s().-]{7,}\d/.test(content);
    const hadPhoneLabel = /(Phone|Tel|Telephone|Контакт|Телефон)\s*:/i.test(content);

    content = content.replace(/href=["']tel:([^"']+)["']/gi, () => `href="tel:${desiredTel}"`);

    // Use fresh regex with global flag for replace
    content = content.replace(/\+\d[\d\s().-]{7,}\d/g, (match, offset) => {
      const before = content.substring(Math.max(0, offset - 80), offset);
      if (/src=["'][^"']*$/i.test(before)) return match;
      if (/https?:\/\/[\w\W]*$/i.test(before) && /href=["'][^"']*$/i.test(before)) return match;
      return desiredPhone;
    });

    content = content.replace(
      /(Phone|Tel|Telephone|Контакт|Телефон)\s*:\s*[^<\n\r]{6,}/gi,
      (m) => {
        const label = m.split(":")[0];
        return `${label}: ${desiredPhone}`;
      }
    );

    if (!hadTelLink && !hadPlusPhone && !hadPhoneLabel && /\.(html?|php)$/i.test(f.path)) {
      const phoneLink = `<a href="tel:${desiredTel}" class="contact-phone-link">${desiredPhone}</a>`;
      const phoneBlock = `\n<div class="contact-phone" style="margin-top:12px">${phoneLink}</div>\n`;

      if (/<section[^>]*id=["']contact["'][^>]*>/i.test(content)) {
        content = content.replace(/(<section[^>]*id=["']contact["'][^>]*>)/i, `$1${phoneBlock}`);
      }

      if (/<footer\b[\s\S]*?<\/footer>/i.test(content)) {
        content = content.replace(/<\/footer>/i, `${phoneBlock}</footer>`);
      } else if (/<\/body>/i.test(content)) {
        content = content.replace(/<\/body>/i, `\n<footer style="padding:24px 16px">${phoneBlock}</footer>\n</body>`);
      } else {
        content += phoneBlock;
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

    if (/<title>[^<]*<\/title>/i.test(content)) {
      content = content.replace(/<title>[\s\S]*?<\/title>/i, `<title>${desiredSiteName}</title>`);
    }

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
    
    for (const pattern of emailPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        replacedCount += matches.length;
        content = content.replace(pattern, desiredEmail);
      }
    }
    
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

function ensureReactFaviconAndLogoInFiles(
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

  const toBase64 = (bytes: Uint8Array) => {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary);
  };

  // Minimal 5x7 font for initial(s)
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
    const pickChars = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
    const chars = pickChars.length ? pickChars.split("") : ["W"];

    const pixels = new Uint8Array(w * h * 4);
    const c1 = { r: 16, g: 185, b: 129 };
    const c2 = { r: 4, g: 120, b: 87 };
    const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      const r = lerp(c1.r, c2.r, t);
      const g = lerp(c1.g, c2.g, t);
      const b = lerp(c1.b, c2.b, t);
      for (let x = 0; x < w; x++) {
        const i = ((h - 1 - y) * w + x) * 4;
        pixels[i + 0] = b;
        pixels[i + 1] = g;
        pixels[i + 2] = r;
        pixels[i + 3] = 255;
      }
    }

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

    const scale = 3;
    const glyphW = 5 * scale;
    const glyphH = 7 * scale;
    const gap = scale;
    const totalW = chars.length * glyphW + (chars.length - 1) * gap;
    const startX = Math.floor((w - totalW) / 2);
    const startY = Math.floor((h - glyphH) / 2) + 1;

    const setPx = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = ((h - 1 - y) * w + x) * 4;
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
            for (let sx = 0; sx < scale; sx++) setPx(ox + gx * scale + sx, startY + gy * scale + sy);
          }
        }
      }
    });

    const maskRowBytes = Math.ceil(w / 32) * 4;
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

    const headerSize = 40;
    const dib = new Uint8Array(headerSize);
    const dv = new DataView(dib.buffer);
    dv.setUint32(0, headerSize, true);
    dv.setInt32(4, w, true);
    dv.setInt32(8, h * 2, true);
    dv.setUint16(12, 1, true);
    dv.setUint16(14, 32, true);
    dv.setUint32(16, 0, true);
    dv.setUint32(20, pixels.length + mask.length, true);

    const imageData = new Uint8Array(dib.length + pixels.length + mask.length);
    imageData.set(dib, 0);
    imageData.set(pixels, dib.length);
    imageData.set(mask, dib.length + pixels.length);

    const icoHeader = new Uint8Array(6 + 16);
    const iv = new DataView(icoHeader.buffer);
    iv.setUint16(0, 0, true);
    iv.setUint16(2, 1, true);
    iv.setUint16(4, 1, true);
    icoHeader[6] = w;
    icoHeader[7] = h;
    icoHeader[8] = 0;
    icoHeader[9] = 0;
    iv.setUint16(10, 1, true);
    iv.setUint16(12, 32, true);
    iv.setUint32(14, imageData.length, true);
    iv.setUint32(18, icoHeader.length, true);

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

  // CDN-based React: files are in root, not public/
  const hasLogo = files.some((f) => f.path.toLowerCase() === "logo.svg" || f.path.toLowerCase() === "public/logo.svg");
  const hasFavicon = files.some((f) => {
    const p = f.path.toLowerCase();
    return p === "favicon.svg" || p === "favicon.ico" || p === "public/favicon.svg" || p === "public/favicon.ico";
  });

  const hasFaviconIco = files.some((f) => {
    const p = f.path.toLowerCase();
    return p === "favicon.ico" || p === "public/favicon.ico";
  });

  let next = [...files];
  // Add to root (not public/ - CDN-based React uses root)
  if (!hasLogo) next.push({ path: "logo.svg", content: logoSvg });
  if (!hasFavicon) next.push({ path: "favicon.svg", content: faviconSvg });
  if (!hasFaviconIco) next.push({ path: "favicon.ico", content: createIcoBase64(initials) });

  // Ensure all HTML files reference favicon (CDN-based: relative paths)
  next = next.map((f) => {
    if (!f.path.toLowerCase().endsWith('.html')) return f;
    let content = f.content;
    if (!/rel=["']icon["']/i.test(content)) {
      const link = `\n<link rel="icon" href="favicon.ico" type="image/x-icon">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n`;
      content = /<\/head>/i.test(content) ? content.replace(/<\/head>/i, `${link}</head>`) : `${link}${content}`;
    } else if (!/href=["']\.?\/?(favicon\.ico|favicon\.svg)["']/i.test(content)) {
      const link = `\n<link rel="icon" href="favicon.ico" type="image/x-icon">\n`;
      content = /<\/head>/i.test(content) ? content.replace(/<\/head>/i, `${link}</head>`) : `${link}${content}`;
    }
    return { ...f, content };
  });

  return next;
}
// ============ END PHONE NUMBER VALIDATION ============

const SYSTEM_PROMPT = `You are a prompt refiner for professional, multi-page React websites.

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
- phone: <required format + must be clickable tel:>
- email: <if present>
- address: <if present>
`.trim();

// ~30 unique layout variations for randomization or manual selection
// Each style has UNIQUE structure for: Header/Nav, Hero, Sections, Features, Testimonials, CTA, Footer
const LAYOUT_VARIATIONS = [
  // Classic & Corporate
  {
    id: "classic",
    name: "Classic Corporate",
    description: `LAYOUT STYLE: Classic Corporate

HEADER/NAVIGATION:
- Sticky top navigation with logo LEFT, horizontal menu CENTER, CTA button RIGHT
- Background: white/light with subtle bottom border
- Menu items: About, Services, Portfolio, Team, Contact

HERO SECTION:
- Full-width hero with large background image + dark gradient overlay
- Centered white text: H1 headline (48-64px), subheadline (18-24px)
- Two buttons side by side: primary solid + secondary outlined

SECTION STRUCTURE (order matters):
1. "Why Choose Us" - 3 columns with icons, titles, short descriptions
2. "Our Services" - alternating left-right blocks (image + text pattern)
3. "About Us" - full-width with company story and large team photo
4. "Testimonials" - carousel slider with large quotes and client photos
5. "Call to Action" - gradient banner with centered text
6. "Contact" - 2-column: form LEFT, contact info + map RIGHT

FEATURES DISPLAY: 3-column grid with rounded icon containers on top

TESTIMONIALS STYLE: Horizontal carousel/slider with navigation arrows

FOOTER STRUCTURE:
- 4-column layout: About + logo | Quick Links | Services | Contact Info
- Newsletter subscription bar above columns
- Bottom bar: copyright LEFT, social icons RIGHT
- Colors: dark navy/charcoal background with white text`
  },
  {
    id: "asymmetric",
    name: "Modern Asymmetric",
    description: `LAYOUT STYLE: Modern Asymmetric

HEADER/NAVIGATION:
- Off-center logo placement (20% from left)
- Navigation RIGHT with varied font weights
- One menu item highlighted with color background

HERO SECTION:
- Split-screen 60/40 layout with offset grid
- Large image overlapping into text area by 10%
- Typography with mixed sizes and weights

SECTION STRUCTURE (order matters):
1. "Our Approach" - asymmetric 2:1 grid with overlapping elements
2. "Featured Work" - masonry-style portfolio grid
3. "Services" - staggered cards with alternating sizes
4. "About" - large portrait offset with flowing text
5. "Testimonial" - single large testimonial with artistic layout
6. "Let's Create" - diagonal CTA section

FEATURES DISPLAY: Staggered cards with alternating sizes, some overlapping

TESTIMONIALS STYLE: Large single testimonial with portrait offset to corner

FOOTER STRUCTURE:
- Minimalist 2-column asymmetric layout
- Large logo one side, stacked links other side
- Bold accent color strip at bottom`
  },
  {
    id: "editorial",
    name: "Editorial Magazine",
    description: `LAYOUT STYLE: Editorial Magazine

HEADER/NAVIGATION:
- Magazine masthead style with publication name centered large
- Thin top bar with date and category links
- Navigation below masthead in horizontal list

HERO SECTION:
- Minimal text-only hero with huge typography (72-120px headline)
- Small accent image in corner (stamp-size)
- Large decorative drop cap on first paragraph

SECTION STRUCTURE (order matters):
1. "Featured Story" - newspaper-style multi-column layout
2. "Editor's Picks" - masonry grid with varied heights
3. "In Depth" - long-form content with pull quotes
4. "The Archive" - thumbnail grid with issue references
5. "Contributors" - byline-style team listing
6. "Subscribe" - newsletter signup styled as subscription offer

FEATURES DISPLAY: Masonry grid with varying heights and widths

TESTIMONIALS STYLE: Inline editorial callouts with decorative quotation marks

FOOTER STRUCTURE:
- Single-line minimalist footer
- Horizontal link list with decorative separators`
  },
  {
    id: "bold",
    name: "Bold Blocks",
    description: `LAYOUT STYLE: Bold Blocks

HEADER/NAVIGATION:
- Heavy bold navigation with thick font weights
- Logo as large text block, no icon
- Menu items in UPPERCASE with bold colors

HERO SECTION:
- Full-viewport hero with video or animated gradient background
- Massive headline text (100px+) with text shadow
- Text positioned at bottom of screen

SECTION STRUCTURE (order matters):
1. "What We Do" - large full-width color blocks alternating
2. "Our Work" - horizontal scroll gallery
3. "Services" - each service is a full-width color section
4. "The Numbers" - statistics with huge typography
5. "Testimonials" - full-width color block with centered text
6. "Contact" - bold form with oversized inputs

FEATURES DISPLAY: Bold color grid on desktop, horizontal scroll on mobile

TESTIMONIALS STYLE: Full-width color section with centered large quote

FOOTER STRUCTURE:
- Compact dark footer
- Social icons large and prominent in row
- Strong color accent border at top`
  },
  {
    id: "minimalist",
    name: "Minimalist Zen",
    description: `LAYOUT STYLE: Minimalist Zen

HEADER/NAVIGATION:
- Ultra-thin header with maximum whitespace
- Logo as simple wordmark or single letter
- Only 3-4 navigation items, widely spaced

HERO SECTION:
- Vast whitespace with small centered text block
- Maximum 2 lines of text
- Subtle animated line or cursor as accent
- No images, pure typography

SECTION STRUCTURE (order matters):
1. "Philosophy" - single centered paragraph
2. "Services" - vertical stack list with numbers
3. "Work" - minimal thumbnails with lots of space
4. "About" - brief bio with small portrait
5. "Contact" - email and phone only, centered

FEATURES DISPLAY: Vertical stack with large icons and minimal text

TESTIMONIALS STYLE: Simple italic text with em-dash attribution

FOOTER STRUCTURE:
- Ultra-minimal single line
- Copyright, 2-3 essential links only
- No background color change`
  },
  {
    id: "showcase",
    name: "Dynamic Showcase",
    description: `LAYOUT STYLE: Dynamic Showcase

HEADER/NAVIGATION:
- Animated header with micro-interactions
- Logo with subtle animation on hover
- Navigation with sliding background indicators

HERO SECTION:
- Image gallery/slideshow with auto-advance
- Thumbnails below for navigation
- Dynamic text that changes with slides

SECTION STRUCTURE (order matters):
1. "Featured" - spotlight cards with reveal on hover
2. "Showcase" - hexagonal or unique grid layout
3. "In Action" - video showcase with custom player
4. "Reviews" - grid of cards with hover flip effects
5. "Connect" - animated form with success states

FEATURES DISPLAY: Hexagonal or circular grid with connecting lines

TESTIMONIALS STYLE: Grid of small cards with star ratings

FOOTER STRUCTURE:
- Multi-level footer with expandable sections
- Animated social icons`
  },
  {
    id: "gradient",
    name: "Gradient Flow",
    description: `LAYOUT STYLE: Gradient Flow

HEADER/NAVIGATION:
- Transparent header over gradient hero
- Navigation with subtle glass effect
- Logo with gradient or glass styling

HERO SECTION:
- Animated gradient background (purple-blue-pink flow)
- Floating geometric shapes with blur
- White or light text with shadow
- Glassmorphism CTA button

SECTION STRUCTURE (order matters):
1. "Intro" - glassmorphism card on gradient background
2. "Features" - glass cards with blur effects
3. "How We Flow" - wave dividers between sections
4. "Showcase" - images with gradient overlays
5. "Testimonials" - floating quote bubbles
6. "Connect" - form with glass styling

FEATURES DISPLAY: Glassmorphism cards with blur effects

TESTIMONIALS STYLE: Floating quote bubbles with gradient borders

FOOTER STRUCTURE:
- Dark footer with gradient accent line at top
- Glass-effect social icons`
  },
  {
    id: "brutalist",
    name: "Brutalist Raw",
    description: `LAYOUT STYLE: Brutalist Raw

HEADER/NAVIGATION:
- Bold oversized navigation text
- No background - just text and borders
- Thick underlines on hover

HERO SECTION:
- Massive typography (120px+ headline)
- Harsh black/white contrast with one accent color
- Visible grid structure, raw edges
- No rounded corners anywhere

SECTION STRUCTURE (order matters):
1. "001" - numbered sections with raw text
2. "002" - simple text blocks with harsh borders
3. "003" - grid with visible structure lines
4. "004" - minimal image with thick border frame
5. "005" - plain text testimonial
6. "006" - form with thick borders, monospace font

FEATURES DISPLAY: Monospace font, numbered lists, stark contrast

TESTIMONIALS STYLE: Plain text with large quotation marks, no styling

FOOTER STRUCTURE:
- Minimal with just copyright and essential links
- Thick top border as separator
- Monospace or bold sans-serif text`
  },
  {
    id: "saas",
    name: "SaaS Product",
    description: `LAYOUT STYLE: SaaS Product

HEADER/NAVIGATION:
- Clean SaaS header with product name + icon logo
- Navigation: Features, Pricing, Docs, Blog, Login, Sign Up
- Sign Up button highlighted with color/contrast

HERO SECTION:
- Product screenshot in browser/device mockup
- Floating UI elements around mockup
- Clear value proposition headline
- Two CTAs: "Start Free Trial" + "Watch Demo"

SECTION STRUCTURE (order matters):
1. "Trusted By" - logo carousel of customer companies
2. "Features" - icon + title + description in 2x3 grid
3. "How It Works" - 3-step numbered process
4. "Pricing" - 3-tier pricing cards side by side
5. "Integrations" - app/tool logos grid
6. "Testimonials" - case study card + company logos
7. "FAQ" - accordion questions
8. "Get Started" - final CTA section

FEATURES DISPLAY: 2x3 icon grid with hover animations

TESTIMONIALS STYLE: Featured case study card + customer logo carousel

FOOTER STRUCTURE:
- Multi-column SaaS footer
- Columns: Product | Company | Resources | Legal
- Platform status link`
  },
  {
    id: "portfolio",
    name: "Creative Portfolio",
    description: `LAYOUT STYLE: Creative Portfolio

HEADER/NAVIGATION:
- Personal name as large logo/wordmark
- Minimal navigation: Work, About, Contact
- Social links in header (Dribbble, Behance, LinkedIn)

HERO SECTION:
- Full-screen image/video of best work
- Name overlay with title/specialty
- Scroll indicator prominent

SECTION STRUCTURE (order matters):
1. "Selected Work" - large project thumbnails
2. "About Me" - personal story with portrait
3. "Skills" - animated progress bars or tag clouds
4. "Clients" - logo carousel
5. "Testimonials" - client reviews with expandable details
6. "Let's Work Together" - personal contact CTA

FEATURES DISPLAY: Skills as animated progress bars or tag clouds

TESTIMONIALS STYLE: Client logos with expandable review details

FOOTER STRUCTURE:
- Social links prominent
- Simple copyright with name
- "Available for freelance" status indicator
- Personal email prominent`
  },
  // Additional styles for full coverage
  {
    id: "corporate",
    name: "Business Serious",
    description: `LAYOUT STYLE: Business Serious

HEADER/NAVIGATION:
- Two-row header: top bar (phone + email), main bar (logo + nav)
- Navigation: RIGHT aligned with dropdowns
- Colors: navy blue header with white text

HERO SECTION:
- Conservative hero with subtle geometric pattern
- Company logo prominent above headline
- Strong headline with mission statement

SECTION STRUCTURE (order matters):
1. "Our Mission" - centered text with decorative underline
2. "Services Overview" - 4-column grid with formal icons
3. "Our Process" - numbered timeline horizontal layout
4. "Case Studies" - 3 featured case cards
5. "Leadership Team" - professional headshots in grid
6. "Contact Us" - professional form

FEATURES DISPLAY: 4-column formal grid with square icons

TESTIMONIALS STYLE: Professional quotes with titles and companies

FOOTER STRUCTURE:
- Comprehensive 5-column footer
- Certifications and awards row above copyright`
  },
  {
    id: "executive",
    name: "Elite Executive",
    description: `LAYOUT STYLE: Elite Executive

HEADER/NAVIGATION:
- Minimalist thin navigation with premium typography
- Logo CENTER, menu items split on both sides
- Gold/silver accent for hover states

HERO SECTION:
- Luxury full-screen hero with high-end photography
- Elegant serif headline with generous letter-spacing
- Minimal copy - one powerful statement

SECTION STRUCTURE (order matters):
1. "Our Philosophy" - large quote with decorative typography
2. "Exclusive Services" - minimal grid with luxury imagery
3. "The Experience" - full-width image with overlay text
4. "Distinguished Clients" - premium logo gallery
5. "Testimonials" - single featured testimonial with large portrait
6. "Private Consultation" - elegant invitation-style CTA

FEATURES DISPLAY: Minimal presentation with large imagery

TESTIMONIALS STYLE: Single testimonial with CEO/executive titles

FOOTER STRUCTURE:
- Ultra-minimal luxury footer
- Gold/silver decorative line divider
- Premium typography throughout`
  }
];

const REACT_GENERATION_PROMPT = `
🚨🚨🚨 CDN-BASED REACT - NO BUILD STEP - READ THIS FIRST! 🚨🚨🚨

**ARCHITECTURE: STANDALONE HTML FILES WITH INLINE REACT VIA CDN**

You are generating a static website that uses React components loaded via CDN.
Each HTML file is completely self-contained and works WITHOUT any build process.

**FILE STRUCTURE (generate these exact files):**
- index.html (homepage)
- about.html (about page) 
- services.html (services page)
- contact.html (contact page with form)
- privacy.html (privacy policy)
- terms.html (terms of service)
- thank-you.html (form submission success)
- 404.html (error page)
- styles.css (all styles in one file)
- favicon.svg (simple SVG favicon)
- netlify.toml (static deploy config)
- vercel.json (static deploy config)
- robots.txt
- _redirects

**CRITICAL: EACH HTML FILE MUST HAVE THIS EXACT STRUCTURE:**
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title - Site Name</title>
  <meta name="description" content="Page description for SEO">
  <link rel="stylesheet" href="styles.css">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <!-- React via CDN -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    
    // Define ALL components inline in this file
    function Header() {
      return (
        <header className="header">
          <nav className="nav">
            <a href="index.html" className="logo">Site Name</a>
            <ul className="nav-links">
              <li><a href="index.html">Home</a></li>
              <li><a href="about.html">About</a></li>
              <li><a href="services.html">Services</a></li>
              <li><a href="contact.html">Contact</a></li>
            </ul>
          </nav>
        </header>
      );
    }
    
    function Footer() {
      return (
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-contact">
              <h5>Contact Us</h5>
              <p><a href="tel:+491234567890">+49 123 456 7890</a></p>
              <p><a href="mailto:info@sitename.com">info@sitename.com</a></p>
            </div>
            <div className="footer-hours">
              <h5>Working Hours</h5>
              <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
              <p>Saturday - Sunday: Closed</p>
            </div>
            <div className="footer-links">
              <a href="privacy.html">Privacy Policy</a>
              <a href="terms.html">Terms of Service</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Site Name. All rights reserved.</p>
          </div>
        </footer>
      );
    }
    
    function CookieBanner() {
      const [visible, setVisible] = useState(false);
      
      useEffect(() => {
        if (!localStorage.getItem('cookieConsent')) {
          setVisible(true);
        }
      }, []);
      
      const accept = () => {
        localStorage.setItem('cookieConsent', 'accepted');
        setVisible(false);
      };
      
      const decline = () => {
        localStorage.setItem('cookieConsent', 'declined');
        setVisible(false);
      };
      
      if (!visible) return null;
      
      return (
        <div className="cookie-banner">
          <p>We use cookies to enhance your experience. By continuing, you agree to our cookie policy.</p>
          <div className="cookie-buttons">
            <button onClick={decline} className="btn-decline">Decline</button>
            <button onClick={accept} className="btn-accept">Accept All</button>
          </div>
        </div>
      );
    }
    
    // PAGE-SPECIFIC CONTENT COMPONENT
    function PageContent() {
      return (
        <main>
          {/* Page-specific sections here */}
          <section className="hero">
            <h1>Welcome to Our Website</h1>
            <p>Professional services you can trust</p>
            <a href="contact.html" className="btn-primary">Get Started</a>
          </section>
          {/* More sections... */}
        </main>
      );
    }
    
    // Main App combining all components
    function App() {
      return (
        <div className="app">
          <Header />
          <PageContent />
          <Footer />
          <CookieBanner />
        </div>
      );
    }
    
    // Render the App
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
\`\`\`

**MANDATORY REQUIREMENTS:**
1. Each HTML file contains ALL React components inline (Header, Footer, CookieBanner, page content)
2. Components are DUPLICATED across files (each file is self-contained)
3. Navigation uses regular <a href="page.html"> links (NOT React Router)
4. Forms redirect using window.location.href = 'thank-you.html'
5. Cookie consent uses localStorage (same logic in each file)
6. All styles in single styles.css file (linked from each HTML)

**NAVIGATION BETWEEN PAGES:**
- Use standard HTML links: <a href="about.html">About</a>
- Current page can be highlighted with a class check or inline style
- DO NOT use React Router or any routing library

**FORM HANDLING:**
\`\`\`jsx
function ContactForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
    // Redirect to thank you page
    window.location.href = 'thank-you.html';
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" placeholder="Your Name" required />
      <input type="email" name="email" placeholder="Your Email" required />
      <textarea name="message" placeholder="Your Message" required></textarea>
      <button type="submit" className="btn-primary">Send Message</button>
    </form>
  );
}
\`\`\`

**DEPLOYMENT FILES:**
netlify.toml:
\`\`\`toml
[build]
  publish = "."
\`\`\`

vercel.json:
\`\`\`json
{
  "cleanUrls": true
}
\`\`\`

🌐🌐🌐 LANGUAGE - FIRST PRIORITY! 🌐🌐🌐
**THE WEBSITE LANGUAGE IS SPECIFIED IN THE "TARGET WEBSITE LANGUAGE" SECTION BELOW!**
YOU MUST GENERATE ALL CONTENT IN THAT EXACT LANGUAGE - THIS IS THE #1 PRIORITY!

⏰ BUSINESS HOURS - MANDATORY IN EVERY FOOTER!
Monday - Friday: 9:00 AM - 6:00 PM
Saturday - Sunday: Closed

⛔ LANGUAGE VIOLATIONS - THESE BREAK THE WEBSITE:
- Generating in Ukrainian when English was requested = BROKEN!
- Generating in English when German was requested = BROKEN!
- Mixing languages = BROKEN!

✅ CORRECT BEHAVIOR:
- If language = "en" → ALL text in English
- If language = "de" → ALL text in German
- If language = "uk" → ALL text in Ukrainian
- If language = "pl" → ALL text in Polish

⛔ TEXT CONTRAST - ABSOLUTELY CRITICAL!
- Light backgrounds: Use DARK text (#333, #222)
- Dark backgrounds: Use WHITE text (#fff, #f5f5f5)
- Hero with images: ALWAYS add dark overlay before white text

👤 TEAM/STAFF PORTRAITS - USE REAL PHOTOS FROM PEXELS:
MALE:
- https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop

FEMALE:
- https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop

📞 PHONE & EMAIL - MANDATORY IN FOOTER:
- Phone: Realistic for country with +country code, clickable: <a href="tel:+491234567890">+49 123 456 7890</a>
- Email: Use site domain: <a href="mailto:info@sitename.com">info@sitename.com</a>
- NEVER use fake numbers like 555-1234 or duplicate country codes like +49+49

🚫 NUMBERS PROHIBITION:
NEVER include prices, statistics, percentages, years of experience, client counts.
Use descriptive text instead: "Contact us for pricing", "Years of experience", "Many satisfied clients"

ALLOWED numbers: Phone numbers, postal codes, copyright year

📋 CONTENT REQUIREMENTS:
- Each main page (index, about, services): AT LEAST 5 full-screen sections
- Privacy policy: 10+ legal sections with detailed text
- Terms of service: 14 sections with legal text  
- Contact page: Form + Google Maps iframe + office info

🍪 COOKIE BANNER - MANDATORY:
Every page must include the CookieBanner component that:
1. Checks localStorage on mount
2. Shows banner if no consent saved
3. Accept: saves 'accepted' to localStorage
4. Decline: saves 'declined' to localStorage
5. Never shows again after any choice

📜 DISCLAIMER - MANDATORY IN FOOTER:
Add a disclaimer adapted to the website's theme/industry above copyright.
Example: "The content of this website is for general information only and does not constitute professional advice."

**CSS REQUIREMENTS (styles.css must be 400+ lines):**
- CSS reset and variables
- Header with sticky navigation
- Hero section with background image and overlay
- Multiple section styles with alternating backgrounds
- Card grids for services/features
- Testimonial cards
- Contact form styling
- Footer multi-column layout
- Cookie banner (fixed bottom, z-index: 9999)
- Responsive breakpoints (768px, 480px)
- Hover states and transitions

**FILE OUTPUT FORMAT - USE EXACTLY THIS:**
<!-- FILE: index.html -->
[full HTML content]

<!-- FILE: about.html -->
[full HTML content]

<!-- FILE: styles.css -->
[full CSS content]

<!-- FILE: netlify.toml -->
[config content]

etc.

🚨 CRITICAL: DO NOT GENERATE:
- package.json (not needed)
- src/ folder (not needed)
- .js or .jsx files (all code goes in HTML <script type="text/babel">)
- React Router imports (use regular <a href> links)
- Any npm dependencies

THIS IS A STATIC SITE THAT WORKS BY DROPPING FILES ON NETLIFY/VERCEL - NO BUILD!`.trim();


// Image strategy - Basic (reliable random photos)
const IMAGE_STRATEGY_BASIC = `
**IMAGE STRATEGY - RELIABLE RANDOM PHOTOS:**
Use picsum.photos for ALL images - it's reliable and always loads:

**Hero background:** 
style={{backgroundImage: 'url(https://picsum.photos/1920/1080?random=1)'}}

**Content images:**
<img src="https://picsum.photos/800/600?random=2" alt="[Descriptive alt text in site language]" loading="lazy" />

**Card images:**
<img src="https://picsum.photos/600/400?random=3" alt="[Description]" loading="lazy" />

**🎯 IMAGE THEME MATCHING - ALL IMAGES MUST FIT THE WEBSITE TOPIC:**
- EVERY image MUST be relevant to the website's industry/theme/topic!
- Examples by industry:
  * Medical/Clinic: doctors, medical equipment, patients, hospital rooms
  * Restaurant/Food: dishes, kitchen, dining area, chefs
  * Auto/Car services: cars, mechanics, garage, car parts
  * Legal/Law: office, courthouse, lawyers, documents
  * Real Estate: houses, apartments, interiors, architecture
- NEVER use random unrelated images!

**👥 TEAM/STAFF/EMPLOYEE PORTRAITS - MANDATORY FACE PHOTOS:**
🚨 When creating Team, Staff, About Us, or Employee sections, you MUST use portrait photos of people!
- Use Pexels portrait URLs with VERIFIED working photo IDs:
  * Man portrait 1: https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 1: https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Man portrait 2: https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 2: https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Man portrait 3: https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 3: https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Man portrait 4: https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
  * Woman portrait 4: https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- NEVER use random picsum images for team members - they need actual human face photos!
- Alternate between male and female portraits for realistic teams
- Each team member card MUST have: photo, name, job title/role

**Portrait images (non-team):**
<img src="https://picsum.photos/400/400?random=4" alt="[Name or role]" loading="lazy" />

**IMPORTANT:** Use DIFFERENT random= numbers for each image (random=1, random=2, random=3, etc.) so images are unique!
**Alt text MUST be in the same language as the website content!**

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

**Usage in React:**
<img src="https://logo.clearbit.com/stripe.com" alt="Stripe" className="partner-logo" loading="lazy" />
<img src="https://logo.clearbit.com/visa.com" alt="Visa" className="payment-logo" loading="lazy" />

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
  
  for (const [ukr, eng] of Object.entries(translations)) {
    if (lowerPrompt.includes(ukr)) {
      console.log(`🔍 Fallback keywords (matched "${ukr}"): "${eng}"`);
      return eng;
    }
  }

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
**IMAGE STRATEGY - RELIABLE RANDOM PHOTOS:**
Use picsum.photos for ALL images:

**Hero background:** style={{backgroundImage: 'url(https://picsum.photos/1920/1080?random=1)'}}
**Content images:** <img src="https://picsum.photos/800/600?random=2" alt="[Description]" loading="lazy" />
**Card images:** <img src="https://picsum.photos/600/400?random=3" alt="[Description]" loading="lazy" />
**Portrait images:** <img src="https://picsum.photos/400/400?random=4" alt="[Description]" loading="lazy" />

Use DIFFERENT random= numbers for each image!
`.trim();
  }

  const heroUrl = pexelsUrls[0] || "https://picsum.photos/1920/1080?random=1";
  const contentUrls = pexelsUrls.slice(1, 6);
  const cardUrls = pexelsUrls.slice(6, 12);
  const portraitUrls = pexelsUrls.slice(12, 15);

  return `
**IMAGE STRATEGY - HIGH QUALITY STOCK PHOTOS FROM PEXELS:**
Use these PRE-SELECTED high-quality Pexels photos. Each URL is unique and themed.

**HERO BACKGROUND (use this exact URL):**
style={{backgroundImage: 'url(${heroUrl})'}}

**CONTENT IMAGES:**
${contentUrls.map((url, i) => `Image ${i + 1}: ${url}`).join("\n")}

**CARD/FEATURE IMAGES:**
${cardUrls.map((url, i) => `Card ${i + 1}: ${url}`).join("\n")}

**PORTRAIT/TEAM IMAGES:**
${portraitUrls.length > 0 ? portraitUrls.map((url, i) => `Portrait ${i + 1}: ${url}`).join("\n") : "Use https://picsum.photos/400/400?random=X with different numbers"}

**FALLBACK:** For additional images use: https://picsum.photos/{width}/{height}?random={unique_number}

**IMPORTANT:**
- Use EACH Pexels URL only ONCE
- Alt text MUST be in the same language as the website content
- Add loading="lazy" to all images
`.trim();
}

// CSS for images - common to both strategies
const IMAGE_CSS = `
**REQUIRED CSS FOR IMAGES:**
.hero {
  position: relative;
  min-height: 100vh;
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
.section { padding: 80px 0; min-height: 50vh; }
img { max-width: 100%; height: auto; display: block; }
.card img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; }

**MOBILE-FIRST BREAKPOINTS:**
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1280px) { /* Large */ }

=== CDN-BASED REACT ARCHITECTURE (DEPLOY-READY, NO BUILD REQUIRED) ===

**CRITICAL: This website MUST work immediately on static hosting WITHOUT npm/node/build!**

**FILE STRUCTURE - STATIC HTML WITH REACT VIA CDN:**
All files go in the root directory. No src/, no public/, no node_modules.

<!-- FILE: index.html -->
<!DOCTYPE html>
<html lang="[language-code]">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Site Name] - Home</title>
  <meta name="description" content="[SEO description]">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css">
  <!-- React via CDN -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    // React components and app code here
    const { useState, useEffect } = React;
    
    // Header Component
    const Header = () => (
      <header className="header">
        <nav className="nav-container">
          <a href="index.html" className="logo">[Site Name]</a>
          <ul className="nav-menu">
            <li><a href="index.html" className="active">Home</a></li>
            <li><a href="about.html">About</a></li>
            <li><a href="services.html">Services</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </nav>
      </header>
    );
    
    // Footer Component
    const Footer = () => (
      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 [Site Name]. All rights reserved.</p>
          <div className="footer-links">
            <a href="privacy.html">Privacy Policy</a>
            <a href="terms.html">Terms of Service</a>
          </div>
        </div>
      </footer>
    );
    
    // Cookie Banner Component
    const CookieBanner = () => {
      const [visible, setVisible] = useState(false);
      
      useEffect(() => {
        if (!localStorage.getItem('cookieConsent')) setVisible(true);
      }, []);
      
      const accept = () => { localStorage.setItem('cookieConsent', 'accepted'); setVisible(false); };
      const decline = () => { localStorage.setItem('cookieConsent', 'declined'); setVisible(false); };
      
      if (!visible) return null;
      
      return (
        <div className="cookie-banner">
          <p>We use cookies to enhance your experience.</p>
          <div className="cookie-buttons">
            <button onClick={accept} className="btn-accept">Accept</button>
            <button onClick={decline} className="btn-decline">Decline</button>
          </div>
        </div>
      );
    };
    
    // Home Page Component (example - adapt for each page)
    const HomePage = () => (
      <>
        <Header />
        <main>
          <section className="hero" style={{backgroundImage: 'url(https://picsum.photos/1920/1080?random=1)'}}>
            <div className="hero-overlay"></div>
            <div className="hero-content">
              <h1>[Main Headline]</h1>
              <p>[Subheadline]</p>
              <a href="contact.html" className="btn-primary">Get Started</a>
            </div>
          </section>
          {/* More sections... */}
        </main>
        <Footer />
        <CookieBanner />
      </>
    );
    
    // Render
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<HomePage />);
  </script>
</body>
</html>

**REQUIRED FILES (each is a complete standalone HTML with React):**
1. index.html - Home page
2. about.html - About page
3. services.html - Services page  
4. contact.html - Contact page with form
5. thank-you.html - Thank you page (after form submission)
6. privacy.html - Privacy Policy (10+ sections)
7. terms.html - Terms of Service (14 sections)
8. 404.html - Not Found page
9. styles.css - Complete CSS (500+ lines)
10. favicon.svg - SVG favicon with initials

<!-- FILE: netlify.toml -->
[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404

<!-- FILE: vercel.json -->
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ],
  "cleanUrls": true
}

<!-- FILE: _redirects -->
/* /404.html 404

<!-- FILE: robots.txt -->
User-agent: *
Allow: /

**CRITICAL RULES FOR CDN-BASED REACT:**
1. EACH HTML file is STANDALONE with its own <script type="text/babel"> block
2. NO imports, NO modules, NO require() - everything is inline or via CDN
3. Use standard <a href="page.html"> for navigation (NOT React Router)
4. NO package.json, NO node_modules, NO build step
5. CSS is in a single styles.css file, linked from all HTML files
6. React components are defined INSIDE each page's script block
7. Share common components (Header, Footer, CookieBanner) by copying into each page
8. Form submission on Contact page should use: window.location.href = 'thank-you.html'
9. All static assets (images, favicon) use relative paths
10. Works IMMEDIATELY on Netlify/Vercel/GitHub Pages without ANY configuration

**FORM HANDLING (Contact page):**
\`\`\`javascript
const handleSubmit = (e) => {
  e.preventDefault();
  // Form handling logic here
  window.location.href = 'thank-you.html';
};
\`\`\`

Generate EXCEPTIONAL static React website with 10X better UI. All pages are standalone HTML with React via CDN. NO build step required. Deploy-ready immediately.`;

type GeneratedFile = { path: string; content: string };

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

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

// Retry helper with exponential backoff for AI API calls
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  baseDelay = 1500,
  timeoutMs = 90000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt + 1}/${maxRetries} (timeout: ${timeoutMs/1000}s)...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response) {
        console.log(`✅ Fetch successful on attempt ${attempt + 1}, status: ${response.status}`);
        return response;
      }
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError?.message || String(error);
      console.error(`❌ Fetch attempt ${attempt + 1} failed: ${errorMessage}`);
      
      const isRetryable = 
        errorMessage.includes('error reading a body from connection') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network') ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT');
      
      if (!isRetryable) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All fetch retries exhausted');
}

const cleanFileContent = (content: string) => {
  let c = content.trim();
  c = c.replace(/^```[a-z0-9_-]*\s*\n/i, "");
  c = c.replace(/\n```\s*$/i, "");
  return c.trim();
};

const parseFilesFromModelText = (rawText: string) => {
  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const filesMap = new Map<string, string>();

  const upsertFile = (path: string, content: string, source: string) => {
    const cleanPath = path.trim();
    const cleanContent = cleanFileContent(content);
    if (!cleanPath || cleanContent.length <= 10) return;
    filesMap.set(cleanPath, cleanContent);
    console.log(`✅ Found (${source}): ${cleanPath} (${cleanContent.length} chars)`);
  };

  const filePattern1 = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;
  let match;
  while ((match = filePattern1.exec(normalizedText)) !== null) {
    upsertFile(match[1], match[2], "format1");
  }

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
      upsertFile(headers[i].path, chunk, "format2");
    }
  }

  return Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
};

async function runGeneration({
  prompt,
  language,
  aiModel,
  layoutStyle,
  imageSource = "basic",
}: {
  prompt: string;
  language?: string;
  aiModel: "junior" | "senior";
  layoutStyle?: string;
  imageSource?: "basic" | "ai";
}): Promise<GenerationResult> {
  const isJunior = aiModel === "junior";
  console.log(`Using ${isJunior ? "Junior AI (OpenAI GPT-4o)" : "Senior AI (Lovable AI)"} for React generation`);

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

  console.log("Generating React website for prompt:", prompt.substring(0, 100));

  const apiUrl = isJunior
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const apiKey = isJunior ? OPENAI_API_KEY : LOVABLE_API_KEY;
  const refineModel = isJunior ? "gpt-4o-mini" : "google/gemini-2.5-flash";
  const generateModel = isJunior ? "gpt-4o" : "google/gemini-2.5-pro";

  // Step 1: refined prompt with retry
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
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Create a detailed prompt for React website generation based on this request:\n\n"${prompt}"\n\nTARGET CONTENT LANGUAGE: ${language === "uk" ? "Ukrainian" : language === "en" ? "English" : language === "de" ? "German" : language === "pl" ? "Polish" : language === "ru" ? "Russian" : language || "auto-detect from user's request, default to English"}`,
          },
        ],
      }),
    }, 2, 1000, 30000);
  } catch (fetchError) {
    const errorMsg = (fetchError as Error)?.message || String(fetchError);
    console.error("Agent AI fetch failed:", errorMsg);
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
  
  console.log("Refined prompt generated, now generating React website...");

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

  // Step 2: React website generation
  const websiteRequestBody: Record<string, unknown> = {
    model: generateModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert React generator specializing in CDN-based static websites. Return ONLY file blocks using exact markers like: <!-- FILE: index.html -->. Generate standalone HTML files with React via CDN - NO build step required, NO package.json, NO src/ folder. Each HTML page is self-contained with inline React components. No explanations. No markdown.",
      },
      {
        role: "user",
        content: `${REACT_GENERATION_PROMPT}\n\n${imageStrategy}\n\n${IMAGE_CSS}\n\n=== MANDATORY LAYOUT STRUCTURE (FOLLOW EXACTLY) ===\n${selectedLayout.description}\n\n=== USER'S ORIGINAL REQUEST (MUST FOLLOW EXACTLY) ===\n${prompt}\n\n=== TARGET WEBSITE LANGUAGE (CRITICAL - MUST FOLLOW EXACTLY) ===\nALL website content MUST be in: ${language === "uk" ? "UKRAINIAN language" : language === "en" ? "ENGLISH language" : language === "de" ? "GERMAN language" : language === "pl" ? "POLISH language" : language === "ru" ? "RUSSIAN language" : language === "fr" ? "FRENCH language" : language === "es" ? "SPANISH language" : language ? language.toUpperCase() + " language" : "ENGLISH language (default)"}\n\nThis includes: navigation, buttons, headings, paragraphs, footer, cookie banner, ALL text content. DO NOT MIX LANGUAGES.\n\n=== ENHANCED DETAILS (KEEP FIDELITY TO ORIGINAL) ===\n${refinedPrompt}`,
      },
    ],
  };

  // Set max_tokens for both models to ensure complete generation
  // Junior: 16000 tokens, Senior: 32000 tokens for comprehensive multi-page websites
  websiteRequestBody.max_tokens = isJunior ? 16000 : 32000;

  let websiteResponse: Response;
  try {
    websiteResponse = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(websiteRequestBody),
    }, 2, 2000, 180000);
  } catch (fetchError) {
    const errorMsg = (fetchError as Error)?.message || String(fetchError);
    console.error("Website generation fetch failed:", errorMsg);
    return { success: false, error: errorMsg, totalCost };
  }

  if (!websiteResponse.ok) {
    const errorText = await websiteResponse.text();
    console.error("Website generation error:", websiteResponse.status, errorText);

    if (websiteResponse.status === 429) return { success: false, error: "Rate limit exceeded. Please try again later.", totalCost };
    if (websiteResponse.status === 402) return { success: false, error: "AI credits exhausted. Please add funds.", totalCost };

    return { success: false, error: "Website generation failed", totalCost };
  }

  const websiteData = await websiteResponse.json();
  const rawText = websiteData.choices?.[0]?.message?.content || "";

  // Track token usage for generation step
  const websiteUsage = websiteData.usage as TokenUsage | undefined;
  if (websiteUsage) {
    totalCost += calculateCost(websiteUsage, generateModel);
  }
  
  console.log(`💰 Total generation cost: $${totalCost.toFixed(6)}`);

  console.log("React website generated, parsing files...");
  console.log("Raw response length:", rawText.length);

  let files = parseFilesFromModelText(rawText);
  console.log(`📁 Total files parsed: ${files.length}`);

  if (files.length === 0) {
    console.error("No files parsed from response");
    return {
      success: false,
      error: "Failed to parse generated files",
      rawResponse: rawText.substring(0, 500),
      totalCost,
    };
  }

  // MANDATORY: Ensure deployment configuration files for CDN-based React
  const ensureMandatoryFiles = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const fileMap = new Map(generatedFiles.map(f => [f.path, f]));
    
    // CDN-based React: No src/ folder needed, files are in root
    // Remove any CRA-style files that AI might have generated
    generatedFiles = generatedFiles.filter(f => {
      // Remove package.json - CDN React doesn't need it
      if (f.path === 'package.json') {
        console.log("🗑️ Removing package.json (not needed for CDN React)");
        return false;
      }
      // Remove src/index.js - CDN React uses inline scripts
      if (f.path.startsWith('src/index.') || f.path.startsWith('src/App.')) {
        console.log(`🗑️ Removing ${f.path} (using CDN-based inline React instead)`);
        return false;
      }
      // Keep files in public/ but move them to root
      return true;
    });
    
    // Move public/ files to root (CDN-based React doesn't need public/)
    generatedFiles = generatedFiles.map(f => {
      if (f.path.startsWith('public/') && !f.path.includes('_redirects')) {
        const newPath = f.path.replace('public/', '');
        console.log(`📁 Moving ${f.path} -> ${newPath}`);
        return { ...f, path: newPath };
      }
      return f;
    });
    
    // Rebuild fileMap after cleanup
    const cleanFileMap = new Map(generatedFiles.map(f => [f.path, f]));
    
    // netlify.toml - static hosting (no build step!)
    if (!cleanFileMap.has("netlify.toml")) {
      console.log("⚠️ Adding netlify.toml (static, no build)");
      generatedFiles.push({
        path: "netlify.toml",
        content: `[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404`
      });
    } else {
      // Fix existing netlify.toml to not require build
      generatedFiles = generatedFiles.map(f => {
        if (f.path === 'netlify.toml') {
          const hasNpmBuild = f.content.includes('npm run build');
          if (hasNpmBuild) {
            console.log("⚠️ Fixing netlify.toml to remove build step");
            return {
              ...f,
              content: `[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404`
            };
          }
        }
        return f;
      });
    }
    
    // vercel.json - static hosting
    if (!cleanFileMap.has("vercel.json")) {
      console.log("⚠️ Adding vercel.json (static)");
      generatedFiles.push({
        path: "vercel.json",
        content: `{
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ],
  "cleanUrls": true
}`
      });
    } else {
      // Fix existing vercel.json
      generatedFiles = generatedFiles.map(f => {
        if (f.path === 'vercel.json') {
          const hasBuildCommand = f.content.includes('buildCommand');
          if (hasBuildCommand) {
            console.log("⚠️ Fixing vercel.json to remove build step");
            return {
              ...f,
              content: `{
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ],
  "cleanUrls": true
}`
            };
          }
        }
        return f;
      });
    }
    
    // _redirects (Netlify fallback)
    if (!cleanFileMap.has("_redirects")) {
      console.log("⚠️ Adding _redirects");
      generatedFiles.push({
        path: "_redirects",
        content: "/* /404.html 404"
      });
    }
    
    // robots.txt
    if (!cleanFileMap.has("robots.txt")) {
      console.log("⚠️ Adding robots.txt");
      generatedFiles.push({
        path: "robots.txt",
        content: `User-agent: *
Allow: /`
      });
    }
    
    // Ensure index.html exists
    if (!cleanFileMap.has("index.html")) {
      console.log("⚠️ WARNING: index.html not found in generated files!");
    }
    
    return generatedFiles;
  };

  // Fix broken JSX/HTML syntax - common AI generation issues
  const fixBrokenJsxSyntax = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    return generatedFiles.map(file => {
      if (!/\.(jsx?|tsx?|html?)$/i.test(file.path)) return file;
      
      let content = file.content;
      let fixedCount = 0;
      
      // Fix 1A: Broken anchor tags like <a href="tel: +40 21 200 9648</a> (href with content, no closing quote)
      // The href value bleeds into the text content without a closing quote
      // Pattern: href="... followed by </a> without intermediate quote
      const brokenAnchorNoQuotePattern = /<a\s+href=["']([^"'<>]*?)<\/a>/gi;
      content = content.replace(brokenAnchorNoQuotePattern, (match, hrefContent) => {
        // Extract the actual href value (before any text)
        const parts = hrefContent.split(/\s+/).filter(Boolean);
        let href = parts[0] || hrefContent;
        let text = hrefContent.trim();
        
        // If it's a tel: link, clean it up
        if (href.startsWith('tel:')) {
          // Get phone number part after tel:
          const phoneText = hrefContent.replace(/^tel:\s*/i, '').trim();
          text = phoneText || href.replace('tel:', '');
          href = 'tel:' + phoneText.replace(/[^\d+]/g, '');
        } else if (href.startsWith('mailto:')) {
          text = hrefContent.replace(/^mailto:\s*/i, '').trim();
        }
        
        fixedCount++;
        console.log(`🔧 Fixed broken anchor (no closing quote): "${match.substring(0, 60)}..."`);
        return `<a href="${href}">${text}</a>`;
      });
      
      // Fix 1B: Anchor with unclosed href attribute, text after unclosed href, then </a>
      // Pattern: <a href="tel: +40... text content</a> - where quote is never closed
      const hrefUnclosedBeforeClosePattern = /<a\s+href=["']([^"']*?)(\s*)(<\/a>)/gi;
      content = content.replace(hrefUnclosedBeforeClosePattern, (match, hrefContent, space, closeTag) => {
        // This pattern catches <a href="content</a> where quote wasn't closed
        if (hrefContent && !match.includes('">') && !match.includes("'>")) {
          let href = hrefContent;
          let text = hrefContent;
          
          if (href.includes('tel:') || hrefContent.startsWith('tel:')) {
            const phoneText = hrefContent.replace(/^tel:\s*/i, '').trim();
            text = phoneText;
            href = 'tel:' + phoneText.replace(/[^\d+]/g, '');
          } else if (href.includes('mailto:') || hrefContent.startsWith('mailto:')) {
            text = hrefContent.replace(/^mailto:\s*/i, '').trim();
          }
          
          fixedCount++;
          console.log(`🔧 Fixed unclosed href before </a>: "${match.substring(0, 60)}..."`);
          return `<a href="${href}">${text}</a>`;
        }
        return match;
      });
      
      // Fix 2: Unclosed href attributes: href="value without closing quote
      // Look for href=" followed by text without closing " before next attribute or >
      const unclosedHrefPattern = /href=["']([^"']*?)(\s+[a-zA-Z]+[=>\s])/gi;
      content = content.replace(unclosedHrefPattern, (match, value, nextPart) => {
        fixedCount++;
        console.log(`🔧 Fixed unclosed href: href="${value.substring(0, 30)}..."`);
        return `href="${value}"${nextPart}`;
      });
      
      // Fix 3: href with content bleeding into it: href="tel: +40 21 200 9648 should be href="tel:+40212009648"
      const telBleedPattern = /href=["']tel:\s*([^"']+?)["']/gi;
      content = content.replace(telBleedPattern, (match, phone) => {
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        if (cleanPhone !== phone.replace(/[\s]/g, '')) {
          fixedCount++;
          console.log(`🔧 Fixed tel: href format`);
        }
        return `href="tel:${cleanPhone}"`;
      });
      
      // Fix 4: Anchor tags that end with text inside href: <a href="text content</a>
      // More aggressive pattern for malformed anchors
      const malformedAnchorPattern = /<a\s+([^>]*?)href=["']([^"']*?)<\/a>/gi;
      content = content.replace(malformedAnchorPattern, (match, before, content) => {
        if (!content.includes('"') && !content.includes("'")) {
          fixedCount++;
          console.log(`🔧 Fixed malformed anchor with content in href`);
          return `<a ${before}href="#">${content}</a>`;
        }
        return match;
      });
      
      // Fix 5: Self-closing anchor tags (invalid): <a href="..."/> -> <a href="..."></a>
      content = content.replace(/<a\s+([^>]*?)\s*\/>/gi, (match, attrs) => {
        fixedCount++;
        console.log(`🔧 Fixed self-closing anchor`);
        return `<a ${attrs}></a>`;
      });
      
      // Fix 6: Missing closing angle bracket: <a href="..."  (end of line or space before next element)
      const missingCloseBracketPattern = /<a\s+href=["'][^"']*["']\s*(?=<[a-zA-Z])/gi;
      content = content.replace(missingCloseBracketPattern, (match) => {
        if (!match.endsWith('>')) {
          fixedCount++;
          console.log(`🔧 Added missing > to anchor tag`);
          return match.trim() + '>';
        }
        return match;
      });
      
      // Fix 7: Double closing tags: </a></a> -> </a>
      content = content.replace(/<\/a>\s*<\/a>/gi, '</a>');
      
      // Fix 8: Empty anchor text - add placeholder
      content = content.replace(/<a\s+([^>]*?)>\s*<\/a>/gi, (match, attrs) => {
        if (attrs.includes('href="tel:')) {
          const phoneMatch = attrs.match(/href="tel:([^"]+)"/);
          if (phoneMatch) {
            fixedCount++;
            return `<a ${attrs}>${phoneMatch[1]}</a>`;
          }
        }
        return match;
      });
      
      if (fixedCount > 0) {
        console.log(`🔧 Fixed ${fixedCount} JSX/HTML syntax issue(s) in ${file.path}`);
      }
      
      return { ...file, content };
    });
  };

  // Remove emojis and instruction symbols from generated content
  const removeEmojisFromContent = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{25A0}-\u{25FF}]|[\u{2B50}]|[\u{2934}-\u{2935}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;
    
    return generatedFiles.map(file => {
      if (!/\.(tsx?|jsx?|css|html?)$/i.test(file.path)) return file;
      
      let content = file.content;
      const emojiMatches = content.match(emojiPattern);
      let removedCount = emojiMatches ? emojiMatches.length : 0;
      
      content = content.replace(emojiPattern, '');
      content = content.replace(/  +/g, ' ');
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      if (removedCount > 0) {
        console.log(`🧹 Removed ${removedCount} emoji(s) from ${file.path}`);
      }
      
      return { ...file, content };
    });
  };

  // Apply all fixes in order
  const withFixedJsx = fixBrokenJsxSyntax(files);
  const withoutEmojis = removeEmojisFromContent(withFixedJsx);
  const finalFiles = ensureMandatoryFiles(withoutEmojis);
  console.log(`📁 Final files count (with mandatory files): ${finalFiles.length}`);

  return {
    success: true,
    files: finalFiles,
    refinedPrompt,
    totalFiles: finalFiles.length,
    fileList: finalFiles.map((f) => f.path),
    totalCost,
    specificModel: generateModel,
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
  geo?: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[BG] Starting background React generation for history ID: ${historyId}, team: ${teamId}, salePrice: $${salePrice}`);

  try {
    // Balance was already deducted in main handler - just update status to generating
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    const result = await runGeneration({ prompt, language, aiModel, layoutStyle, imageSource });

    if (result.success && result.files) {
      // Extract geo from prompt for phone number generation
      const geoMatch = prompt.match(/(?:geo|country|страна|країна|гео)[:\s]*([^\n,;]+)/i);
      const geoFromPrompt = geoMatch ? geoMatch[1].trim() : undefined;
      const geoToUse = geo || geoFromPrompt;

      const explicit = extractExplicitBrandingFromPrompt(prompt);
      const desiredSiteName = explicit.siteName || siteName;
      const desiredPhone = explicit.phone;
      
      console.log(`[BG] React - Extracted branding - siteName: "${desiredSiteName}", phone: "${desiredPhone}"`);
      
      // CRITICAL behavior:
      // - If phone is explicitly provided in prompt -> enforce EXACTLY that phone and DO NOT "fix" it.
      // - If phone is NOT provided -> generate a realistic phone based on geo and enforce it.
      let enforcedFiles = result.files;

      if (desiredPhone) {
        console.log(`[BG] React - Using explicit phone from prompt: "${desiredPhone}" - skipping phone number fixing`);
        enforcedFiles = enforcePhoneInFiles(enforcedFiles, desiredPhone);
        console.log(`[BG] React - Enforced phone "${desiredPhone}" across all files`);
      } else {
        const { files: fixedFiles, totalFixed } = fixPhoneNumbersInFiles(result.files, geoToUse);
        if (totalFixed > 0) {
          console.log(`[BG] Fixed ${totalFixed} invalid phone number(s) in React files`);
        }
        const autoPhone = generateRealisticPhone(geoToUse);
        console.log(`[BG] React - No phone in prompt. Auto-generated regional phone: "${autoPhone}" (geo: "${geoToUse || 'default'}")`);
        enforcedFiles = enforcePhoneInFiles(fixedFiles, autoPhone);
        console.log(`[BG] React - Enforced auto-generated phone "${autoPhone}" across all files`);
      }

      enforcedFiles = enforceSiteNameInFiles(enforcedFiles, desiredSiteName);
      enforcedFiles = enforceEmailInFiles(enforcedFiles, desiredSiteName);
      enforcedFiles = enforceResponsiveImagesInFiles(enforcedFiles);
      enforcedFiles = ensureReactFaviconAndLogoInFiles(enforcedFiles, desiredSiteName);
      
      // Create zip base64 with fixed files
      const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
      const zip = new JSZip();
      enforcedFiles.forEach((file) => {
        if (/\.ico$/i.test(file.path)) {
          zip.file(file.path, file.content, { base64: true });
        } else {
          zip.file(file.path, file.content);
        }
      });
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
        title: "React сайт згенеровано",
        message: `React сайт успішно створено (${enforcedFiles.length} файлів)`,
        data: { historyId, filesCount: enforcedFiles.length }
      });

      console.log(`[BG] React generation completed for ${historyId}: ${enforcedFiles.length} files, sale: $${salePrice}, cost: $${generationCost.toFixed(4)}`);
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

      // Update with error
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "Generation failed",
          sale_price: 0, // Reset sale_price since refunded
        })
        .eq("id", historyId);

      // Create notification for user about failure
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_failed",
        title: "Помилка генерації",
        message: result.error || "Не вдалося згенерувати React сайт",
        data: { historyId, error: result.error }
      });

      console.error(`[BG] React generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] Background React generation error for ${historyId}:`, error);

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    
    // Read body first to check for retryHistoryId (needed for service key auth bypass)
    const body = await req.json();
    const { prompt, originalPrompt, improvedPrompt, vipPrompt, language, aiModel = "senior", layoutStyle, siteName, imageSource = "basic", teamId: overrideTeamId, geo, retryHistoryId, colorScheme } = body;

    // Determine userId - either from JWT or from DB for retry requests
    let userId: string;
    
    // Check if this is a retry request from cleanup-stale-generations using SERVICE_ROLE_KEY
    if (retryHistoryId && token === supabaseKey) {
      // SERVICE KEY AUTH: Get userId from existing generation_history record
      console.log("🔄 Retry mode detected with service key for:", retryHistoryId);
      
      const { data: existingRecord, error: fetchError } = await supabase
        .from("generation_history")
        .select("user_id")
        .eq("id", retryHistoryId)
        .single();
      
      if (fetchError || !existingRecord?.user_id) {
        console.error("Failed to find retry record:", fetchError);
        return new Response(JSON.stringify({ success: false, error: "Retry record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      userId = existingRecord.user_id;
      console.log("🔄 Retry mode: userId from DB:", userId);
    } else {
      // NORMAL JWT AUTH: Validate using getClaims
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      
      if (claimsError || !claimsData?.claims) {
        console.error("JWT validation failed:", claimsError);
        return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = claimsData.claims.sub as string;
    }
    
    console.log("Authenticated React generation request from user:", userId);

    // Build prompt with language and geo context if provided
    let promptForGeneration = prompt;
    
    // Add language instruction FIRST (critical for content generation)
    if (language && language !== "auto") {
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
- Privacy Policy (10+ sections), Terms of Service (14 sections), Cookie Policy (with cookies table) - ALL in ${langName}
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
        .select("react_price")
        .eq("team_id", teamId)
        .maybeSingle();

      salePrice = pricing?.react_price || 0;
      
      // AI photo search is now free (removed +$2 charge)

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
    let historyId: string;
    
    // Effective params to use for generation (may differ from body params on retry)
    let effectiveColorScheme = colorScheme || null;
    let effectiveLayoutStyle = layoutStyle || null;
    
    if (retryHistoryId) {
      // RETRY MODE: Update existing failed record instead of creating new one
      console.log(`🔄 RETRY MODE: Updating existing record ${retryHistoryId}`);
      
      const { data: existingRecord, error: fetchError } = await supabase
        .from("generation_history")
        .select("id, status, user_id, color_scheme, layout_style, improved_prompt, vip_prompt")
        .eq("id", retryHistoryId)
        .single();
      
      if (fetchError || !existingRecord) {
        console.error("Failed to find retry record:", fetchError);
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
      
      // Compute EFFECTIVE values for retry (prefer body param, fallback to existing record)
      effectiveColorScheme = colorScheme || existingRecord.color_scheme || null;
      effectiveLayoutStyle = layoutStyle || existingRecord.layout_style || null;
      const effectiveImprovedPrompt = improvedPrompt || existingRecord.improved_prompt || null;
      const effectiveVipPrompt = vipPrompt || existingRecord.vip_prompt || null;
      
      console.log(`🎨 RETRY effective params: colorScheme=${effectiveColorScheme}, layoutStyle=${effectiveLayoutStyle}, hasImprovedPrompt=${!!effectiveImprovedPrompt}, hasVipPrompt=${!!effectiveVipPrompt}`);
      
      const { error: updateError } = await supabase
        .from("generation_history")
        .update({
          status: "pending",
          error_message: null,
          files_data: null,
          zip_data: null,
          completed_at: null,
          sale_price: salePrice,
          color_scheme: effectiveColorScheme,
          layout_style: effectiveLayoutStyle,
          improved_prompt: effectiveImprovedPrompt,
          vip_prompt: effectiveVipPrompt,
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
      
      historyId = retryHistoryId;
      console.log(`🔄 Updated existing record for retry: ${retryHistoryId} with colorScheme=${effectiveColorScheme}, layoutStyle=${effectiveLayoutStyle}`);
    } else {
      const { data: historyEntry, error: insertError } = await supabase
        .from("generation_history")
        .insert({
          prompt: promptToSave,
          improved_prompt: improvedPromptToSave,
          vip_prompt: vipPrompt || null,
          language: language || "auto",
          user_id: userId,
          team_id: teamId || null,
          status: "pending",
          ai_model: aiModel,
          website_type: "react",
          site_name: siteName || null,
          image_source: imageSource || "basic",
          sale_price: salePrice,
          geo: geo || null,
          color_scheme: effectiveColorScheme,
          layout_style: effectiveLayoutStyle,
        })
        .select()
        .single();

      if (insertError || !historyEntry) {
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
      
      historyId = historyEntry.id;
    }
    
    console.log("Using history entry:", historyId);

    // Start background generation using EdgeRuntime.waitUntil
    // Pass salePrice and teamId for potential refund on error
    // Use effectiveLayoutStyle to ensure retry gets correct params
    EdgeRuntime.waitUntil(
      runBackgroundGeneration(historyId, userId, prompt, language, aiModel, effectiveLayoutStyle, imageSource, teamId, salePrice, siteName, geo)
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
