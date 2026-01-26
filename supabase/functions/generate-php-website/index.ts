import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ COLOR SCHEME LOOKUP (for branding) ============
const BRAND_COLOR_MAP: Record<string, { primary: string; accent: string }> = {
  ocean: { primary: '#0d4f8b', accent: '#3182ce' },
  midnight: { primary: '#1a1a2e', accent: '#2563eb' },
  teal: { primary: '#234e52', accent: '#319795' },
  arctic: { primary: '#0c4a6e', accent: '#38bdf8' },
  navy: { primary: '#1e3a5f', accent: '#4a90d9' },
  sky: { primary: '#0284c7', accent: '#7dd3fc' },
  forest: { primary: '#276749', accent: '#38a169' },
  emerald: { primary: '#047857', accent: '#10b981' },
  sage: { primary: '#3f6212', accent: '#84cc16' },
  mint: { primary: '#059669', accent: '#34d399' },
  olive: { primary: '#4d5527', accent: '#708238' },
  sunset: { primary: '#c53030', accent: '#e53e3e' },
  coral: { primary: '#c05621', accent: '#dd6b20' },
  crimson: { primary: '#991b1b', accent: '#dc2626' },
  amber: { primary: '#b45309', accent: '#f59e0b' },
  flame: { primary: '#ea580c', accent: '#fb923c' },
  royal: { primary: '#553c9a', accent: '#805ad5' },
  rose: { primary: '#97266d', accent: '#d53f8c' },
  lavender: { primary: '#7c3aed', accent: '#a78bfa' },
  fuchsia: { primary: '#a21caf', accent: '#e879f9' },
  plum: { primary: '#6b21a8', accent: '#c084fc' },
  mauve: { primary: '#9d4edd', accent: '#c77dff' },
  slate: { primary: '#2d3748', accent: '#4a5568' },
  charcoal: { primary: '#1f2937', accent: '#374151' },
  bronze: { primary: '#92400e', accent: '#d97706' },
  coffee: { primary: '#78350f', accent: '#a16207' },
  sand: { primary: '#a8a29e', accent: '#d6d3d1' },
  terracotta: { primary: '#9a3412', accent: '#ea580c' },
  gold: { primary: '#b7791f', accent: '#ecc94b' },
  silver: { primary: '#64748b', accent: '#94a3b8' },
  wine: { primary: '#7f1d1d', accent: '#b91c1c' },
  ocean_deep: { primary: '#0c4a6e', accent: '#0369a1' },
};

function getBrandColors(schemeName?: string): { primary: string; accent: string } {
  if (!schemeName) return { primary: '#10b981', accent: '#047857' }; // Default emerald
  return BRAND_COLOR_MAP[schemeName] || { primary: '#10b981', accent: '#047857' };
}

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
  
  const generateValidPexelsUrl = () => {
    const randomId = Math.floor(Math.random() * 5000000) + 1000000;
    return `https://images.pexels.com/photos/${randomId}/pexels-photo-${randomId}.jpeg?auto=compress&cs=tinysrgb&w=800`;
  };
  
  const generateValidPicsumUrl = () => {
    const seed = Math.random().toString(36).substring(7);
    return `https://picsum.photos/seed/${seed}/800/600`;
  };
  
  // AGGRESSIVE: Pattern 1 - Any image URL containing + sign (phone number injection)
  const BROKEN_PLUS_REGEX = /src=["'](https?:\/\/[^"']*\+[^"']*)["']/gi;
  result = result.replace(BROKEN_PLUS_REGEX, () => {
    fixed++;
    return `src="${generateValidPexelsUrl()}"`;
  });
  
  // AGGRESSIVE: Pattern 2 - Pexels URLs with parentheses (phone format like (416))
  const BROKEN_PARENS_REGEX = /src=["'](https?:\/\/images\.pexels\.com\/photos\/[^"']*\([^"']*\)[^"']*)["']/gi;
  result = result.replace(BROKEN_PARENS_REGEX, () => {
    fixed++;
    return `src="${generateValidPexelsUrl()}"`;
  });
  
  // AGGRESSIVE: Pattern 3 - Any Pexels URL with spaces in path (invalid)
  const BROKEN_SPACE_REGEX = /src=["'](https?:\/\/images\.pexels\.com\/photos\/[^"']*\s+[^"']*)["']/gi;
  result = result.replace(BROKEN_SPACE_REGEX, () => {
    fixed++;
    return `src="${generateValidPexelsUrl()}"`;
  });
  
  // AGGRESSIVE: Pattern 4 - Pexels URLs where photo ID is NOT a valid number
  // Valid: /photos/12345/pexels-photo-12345.jpeg
  // Invalid: /photos/+1 (416) 123/pexels-photo-xxx.jpeg
  const PEXELS_ID_CHECK = /src=["'](https?:\/\/images\.pexels\.com\/photos\/([^/"']+)\/[^"']*)["']/gi;
  result = result.replace(PEXELS_ID_CHECK, (match, _url, photoId) => {
    // Valid photo IDs are pure numbers
    if (/^\d+$/.test(photoId)) return match;
    fixed++;
    return `src="${generateValidPexelsUrl()}"`;
  });
  
  // Pattern 5 - Picsum with broken URLs (containing +, spaces, or parentheses)
  const BROKEN_PICSUM_REGEX = /src=["'](https?:\/\/picsum\.photos\/[^"']*[\s+()][^"']*)["']/gi;
  result = result.replace(BROKEN_PICSUM_REGEX, () => {
    fixed++;
    return `src="${generateValidPicsumUrl()}"`;
  });
  
  // Pattern 6 - Any image URL containing phone-like patterns (e.g., 416-555 or (416))
  const PHONE_IN_URL_REGEX = /src=["'](https?:\/\/[^"']*(?:\(\d{3}\)|\d{3}-\d{3,4})[^"']*)["']/gi;
  result = result.replace(PHONE_IN_URL_REGEX, () => {
    fixed++;
    return `src="${generateValidPexelsUrl()}"`;
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

  // Helper: strip attributes for phone scan (defined here for self-contained function)
  const stripAttrsForScan = (html: string): string => html
    .replace(/\bsrc=["'][^"']*["']/gi, 'src=""')
    .replace(/\bhref=["'](?!tel:)[^"']*["']/gi, 'href=""')
    .replace(/\bcontent=["'][^"']*["']/gi, 'content=""')
    .replace(/\bdata-[\w-]+=["'][^"']*["']/gi, 'data-x=""');

  return files.map((f) => {
    if (!/\.(html?|php|jsx?|tsx?)$/i.test(f.path)) return f;

    let content = f.content;
    
    // CRITICAL: Skip config.php entirely - it contains PHP constants that should NOT have HTML injected
    if (/config\.php$/i.test(f.path) || /includes?\//i.test(f.path)) {
      // Only fix tel: links in config files, don't inject HTML
      content = content.replace(/href=["']tel:([^"']+)["']/gi, () => `href="tel:${desiredTel}"`);
      return { ...f, content };
    }

    // Check for existing phone presence BEFORE modifications - USE STRIPPED CONTENT!
    const hadTelLink = /href=["']tel:/i.test(content);
    const strippedContent = stripAttrsForScan(content);
    const hadPlusPhone = /\+\d[\d\s().-]{7,}\d/.test(strippedContent);
    const hadPhoneLabel = /(Phone|Tel|Telephone|Контакт|Телефон)\s*:/i.test(strippedContent);

    // Always enforce tel: links to match desired phone
    content = content.replace(/href=["']tel:([^"']+)["']/gi, () => `href="tel:${desiredTel}"`);

    // Replace visible international phone patterns with desired phone
    // (Skip if inside src="...", href="...", content="...", data-*="...", or PHP define())
    content = content.replace(/\+\d[\d\s().-]{7,}\d/g, (match, offset) => {
      const before = content.substring(Math.max(0, offset - 100), offset);
      if (/src=["'][^"']*$/i.test(before)) return match;
      if (/href=["'](?!tel:)[^"']*$/i.test(before)) return match;
      if (/content=["'][^"']*$/i.test(before)) return match;
      if (/data-[\w-]+=["'][^"']*$/i.test(before)) return match;
      // Skip PHP define() statements - they should keep raw phone values
      if (/define\s*\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*$/i.test(before)) return match;
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
        content = content.replace(/(<section[^>]*id=["']contact["'][^>]*>)/i, `$1${phoneBlock}`);
      }

      // 2) Insert into footer if present
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

// ============ CONTACT INFO & FOOTER LINK VALIDATION ============
function validateContactPage(
  files: Array<{ path: string; content: string }>,
  geo?: string
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  
  const contactFile = files.find(f => 
    /contact\.(?:html?|php)$/i.test(f.path) || 
    /kontakt\.(?:html?|php)$/i.test(f.path) ||
    /contacts?\.(?:html?|php)$/i.test(f.path)
  );
  
  if (!contactFile) {
    warnings.push("No contact.php/html found - skipping contact page validation");
    return { files, warnings };
  }
  
  let content = contactFile.content;
  let modified = false;
  
  const hasPhone = /href=["']tel:/i.test(content) || /\+\d[\d\s().-]{7,}\d/.test(content);
  const hasEmail = /href=["']mailto:/i.test(content) || /[\w.-]+@[\w.-]+\.\w{2,}/i.test(content);
  
  if (!hasPhone) {
    warnings.push(`${contactFile.path}: No phone found - auto-injecting`);
    const phone = generateRealisticPhone(geo);
    const phoneHtml = `
    <div class="contact-info-phone" style="margin: 16px 0;">
      <strong>Phone:</strong> <a href="tel:${phone.replace(/[^\d+]/g, '')}" style="color: inherit;">${phone}</a>
    </div>`;
    
    if (/<(main|article|section)[^>]*>/i.test(content)) {
      content = content.replace(/(<(?:main|article|section)[^>]*>)/i, `$1${phoneHtml}`);
    } else if (/<body[^>]*>/i.test(content)) {
      content = content.replace(/(<body[^>]*>)/i, `$1${phoneHtml}`);
    } else {
      content = phoneHtml + content;
    }
    modified = true;
  }
  
  if (!hasEmail) {
    warnings.push(`${contactFile.path}: No email found - auto-injecting`);
    const email = "info@example.com";
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

function ensureContactLinkInFooters(
  files: Array<{ path: string; content: string }>
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  
  const contactFile = files.find(f => 
    /contact\.(?:html?|php)$/i.test(f.path) || 
    /kontakt\.(?:html?|php)$/i.test(f.path) ||
    /contacts?\.(?:html?|php)$/i.test(f.path)
  );
  
  if (!contactFile) {
    return { files, warnings };
  }
  
  const contactPath = contactFile.path.replace(/^\.?\//, '');
  
  const updatedFiles = files.map(f => {
    if (!/\.(?:html?|php)$/i.test(f.path)) return f;
    if (f.path === contactFile.path) return f;
    
    let content = f.content;
    
    const hasFooter = /<footer\b/i.test(content);
    if (!hasFooter) return f;
    
    const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
    if (!footerMatch) return f;
    
    const footerContent = footerMatch[0];
    
    const hasContactLink = 
      /href=["'][^"']*contact[^"']*["']/i.test(footerContent) ||
      /href=["'][^"']*kontakt[^"']*["']/i.test(footerContent);
    
    if (hasContactLink) return f;
    
    warnings.push(`${f.path}: Added missing contact link to footer`);
    
    const contactLinkHtml = `<a href="${contactPath}" class="footer-contact-link">Contact</a>`;
    
    if (/<footer[\s\S]*?<(nav|ul)\b[\s\S]*?<\/\1>/i.test(content)) {
      content = content.replace(
        /(<footer[\s\S]*?)(<\/(?:nav|ul)>)/i,
        `$1${contactLinkHtml} $2`
      );
    } else {
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
  
  const privacyFile = files.find(f => 
    /privac[yi][-_]?polic[yi]?\.(?:html?|php)$/i.test(f.path) ||
    /privacy\.(?:html?|php)$/i.test(f.path) ||
    /datenschutz\.(?:html?|php)$/i.test(f.path)
  );
  
  const termsFile = files.find(f => 
    /terms[-_]?(?:of[-_]?(?:service|use))?\.(?:html?|php)$/i.test(f.path) ||
    /agb\.(?:html?|php)$/i.test(f.path) ||
    /regulamin\.(?:html?|php)$/i.test(f.path)
  );
  
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
  
  const privacyPath = privacyFile?.path.replace(/^\.?\//, '') || 'privacy-policy.php';
  const termsPath = termsFile?.path.replace(/^\.?\//, '') || 'terms.php';
  
  const updatedFiles = files.map(f => {
    if (!/\.(?:html?|php)$/i.test(f.path)) return f;
    
    let content = f.content;
    
    const hasFooter = /<footer\b/i.test(content);
    if (!hasFooter) return f;
    
    const footerMatch = content.match(/<footer[\s\S]*?<\/footer>/i);
    if (!footerMatch) return f;
    
    const footerContent = footerMatch[0];
    
    const hasPrivacyLink = 
      /href=["'][^"']*privac[yi]/i.test(footerContent) ||
      /href=["'][^"']*datenschutz/i.test(footerContent);
    
    const hasTermsLink = 
      /href=["'][^"']*terms/i.test(footerContent) ||
      /href=["'][^"']*agb/i.test(footerContent) ||
      /href=["'][^"']*regulamin/i.test(footerContent);
    
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
// ============ ENSURE MISSING LINKED PAGES EXIST ============
// Scans all links and creates missing pages to prevent broken links
function ensureMissingLinkedPagesExist(
  files: Array<{ path: string; content: string }>,
  language?: string,
  geo?: string,
  siteName?: string
): { files: Array<{ path: string; content: string }>; warnings: string[]; createdPages: string[] } {
  const warnings: string[] = [];
  const createdPages: string[] = [];
  
  // Extract all internal links from all files
  const allInternalLinks = new Set<string>();
  const linkRegex = /href=["']([^"'#]+\.php)(?:\?[^"']*)?["']/gi;
  
  for (const file of files) {
    if (!/\.(?:html?|php)$/i.test(file.path)) continue;
    
    let match;
    while ((match = linkRegex.exec(file.content)) !== null) {
      const href = match[1];
      // Skip external links and anchors
      if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      // Normalize path
      const normalizedPath = href.replace(/^\.?\/?/, '').split('?')[0];
      if (normalizedPath) {
        allInternalLinks.add(normalizedPath);
      }
    }
  }
  
  // Check which linked pages exist
  const existingPaths = new Set(files.map(f => f.path.replace(/^\.?\/?/, '')));
  const missingPages: string[] = [];
  
  for (const link of allInternalLinks) {
    if (!existingPaths.has(link)) {
      missingPages.push(link);
    }
  }
  
  if (missingPages.length === 0) {
    return { files, warnings, createdPages };
  }
  
  console.log(`🔗 Found ${missingPages.length} missing linked pages: ${missingPages.join(', ')}`);
  
  // Language-specific text
  const langLower = (language || 'en').toLowerCase();
  const texts = getLanguageTexts(langLower);
  
  // Find template elements from existing pages
  const indexFile = files.find(f => /index\.(?:html?|php)$/i.test(f.path));
  let headerHtml = '';
  let footerHtml = '';
  let navHtml = '';
  
  if (indexFile) {
    // Extract header
    const headerMatch = indexFile.content.match(/<header[\s\S]*?<\/header>/i);
    if (headerMatch) headerHtml = headerMatch[0];
    
    // Extract footer
    const footerMatch = indexFile.content.match(/<footer[\s\S]*?<\/footer>/i);
    if (footerMatch) footerHtml = footerMatch[0];
    
    // Extract nav
    const navMatch = indexFile.content.match(/<nav[\s\S]*?<\/nav>/i);
    if (navMatch) navHtml = navMatch[0];
  }
  
  // Generate missing pages
  for (const pagePath of missingPages) {
    const pageTitle = getPageTitleFromPath(pagePath, langLower, siteName);
    const pageContent = generateMissingPageContent(pagePath, pageTitle, texts, headerHtml, footerHtml, siteName, langLower);
    
    files.push({ path: pagePath, content: pageContent });
    createdPages.push(pagePath);
    warnings.push(`Created missing page: ${pagePath}`);
    console.log(`📄 Created missing page: ${pagePath}`);
  }
  
  return { files, warnings, createdPages };
}

// ============ FORCE ALL IMAGES TO USE EXTERNAL URLS ==========
// AI sometimes generates local image paths (assets/img.jpg). Replace ALL with external URLs.
function forceExternalImages(
  files: Array<{ path: string; content: string }>
): { files: Array<{ path: string; content: string }>; replaced: number } {
  let replaced = 0;

  const generateExternalUrl = (context: string) => {
    // Use deterministic seed from context for consistency
    const seed = Math.abs(context.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 1000000;
    return `https://picsum.photos/seed/${seed}/1200/800`;
  };

  const isExternalUrl = (url: string) =>
    /^(https?:)?\/\//i.test(url) ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:");

  const replaceLocalSrc = (content: string, filePath: string) => {
    let out = content;
    let fileReplaced = 0;

    // Replace <img src="local/path.jpg"> with external URL
    out = out.replace(/\bsrc=["']([^"']+)["']/gi, (match, src) => {
      const s = String(src).trim();
      if (isExternalUrl(s)) return match;
      // Local path detected - replace
      fileReplaced++;
      return `src="${generateExternalUrl(filePath + s)}"`;
    });

    // Replace srcset="local/a.jpg 1x, local/b.jpg 2x"
    out = out.replace(/\bsrcset=["']([^"']+)["']/gi, (match, srcset) => {
      const parts = String(srcset).split(",").map((p) => p.trim());
      const newParts = parts.map((part) => {
        const [url, descriptor] = part.split(/\s+/, 2);
        if (!url || isExternalUrl(url)) return part;
        fileReplaced++;
        return `${generateExternalUrl(filePath + url)}${descriptor ? ` ${descriptor}` : ""}`;
      });
      return `srcset="${newParts.join(", ")}"`;
    });

    replaced += fileReplaced;
    return out;
  };

  const replaceCssUrls = (content: string, filePath: string) => {
    let out = content;
    out = out.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, _q, rawUrl) => {
      const u = String(rawUrl).trim();
      if (!u || isExternalUrl(u)) return match;
      replaced++;
      return `url('${generateExternalUrl(filePath + u)}')`;
    });
    return out;
  };

  const updated = files.map((f) => {
    if (/\.(?:html?|php)$/i.test(f.path)) {
      return { ...f, content: replaceLocalSrc(f.content, f.path) };
    }
    if (/\.css$/i.test(f.path)) {
      return { ...f, content: replaceCssUrls(f.content, f.path) };
    }
    return f;
  });

  return { files: updated, replaced };
}

// ============ ENSURE NON-EMPTY PAGES ==========
// Guarantees every public .php page has meaningful HTML content.
// Uses template-based rebuilding for speed (AI regeneration happens in background job).
function ensureNonEmptyPhpPages(
  files: Array<{ path: string; content: string }>,
  language?: string,
  geo?: string,
  siteName?: string
): { files: Array<{ path: string; content: string }>; warnings: string[]; rebuiltPages: string[] } {
  const warnings: string[] = [];
  const rebuiltPages: string[] = [];

  const langLower = (language || "en").toLowerCase();
  const texts = getLanguageTexts(langLower);

  const indexFile = files.find((f) => /index\.php$/i.test(f.path)) || files.find((f) => /index\.(?:html?)$/i.test(f.path));
  const headerFromIndex = indexFile?.content.match(/<header[\s\S]*?<\/header>/i)?.[0] || "";
  const footerFromIndex = indexFile?.content.match(/<footer[\s\S]*?<\/footer>/i)?.[0] || "";

  const isPublicPage = (path: string) =>
    /\.php$/i.test(path) &&
    !/\/includes\//i.test(path) &&
    !/^includes\//i.test(path) &&
    !/config\.php$/i.test(path) &&
    !/form-handler\.php$/i.test(path);

  const visibleLength = (content: string) => {
    const noPhp = content.replace(/<\?php[\s\S]*?\?>/gi, " ");
    const noTags = noPhp.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    return noTags.replace(/\s+/g, " ").trim().length;
  };

  // Increased threshold - pages need substantial content
  const MIN_VISIBLE_CHARS = 1200;

  const updated = files.map((f) => {
    if (!isPublicPage(f.path)) return f;
    if (visibleLength(f.content) >= MIN_VISIBLE_CHARS) return f;

    const pageTitle = getPageTitleFromPath(f.path, langLower, siteName);
    const rebuilt = generateMissingPageContent(
      f.path,
      pageTitle,
      texts,
      headerFromIndex,
      footerFromIndex,
      siteName,
      langLower
    );

    rebuiltPages.push(f.path);
    warnings.push(`Rebuilt empty page: ${f.path}`);
    return { ...f, content: rebuilt };
  });

  return { files: updated, warnings, rebuiltPages };
}

// ============ FIX BROKEN LOCAL ASSET REFERENCES ==========
// If HTML/CSS references a local image that doesn't exist in the ZIP, replace it with a stable placeholder.
function fixMissingLocalAssets(
  files: Array<{ path: string; content: string }>
): { files: Array<{ path: string; content: string }>; fixed: number } {
  const existing = new Set(files.map((f) => f.path.replace(/^\.?\/?/, "")));
  let fixed = 0;

  const isExternal = (url: string) => /^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("mailto:") || url.startsWith("tel:");
  const normalize = (url: string) => url.replace(/^\.?\/?/, "").split("?")[0].split("#")[0];
  const placeholder = () => `https://picsum.photos/seed/${Math.random().toString(36).slice(2)}/1200/800`;

  const fixHtml = (content: string) => {
    let out = content;
    // <img src>
    out = out.replace(/\bsrc=["']([^"']+)["']/gi, (m, src) => {
      const s = String(src).trim();
      if (isExternal(s)) return m;
      const p = normalize(s);
      if (!p || existing.has(p)) return m;
      fixed++;
      return `src="${placeholder()}"`;
    });
    // srcset="a.jpg 1x, b.jpg 2x"
    out = out.replace(/\bsrcset=["']([^"']+)["']/gi, (m, srcset) => {
      const value = String(srcset);
      const parts = value.split(",").map((part) => part.trim());
      const replaced = parts.map((part) => {
        const [url, descriptor] = part.split(/\s+/, 2);
        if (!url || isExternal(url)) return part;
        const p = normalize(url);
        if (existing.has(p)) return part;
        fixed++;
        return `${placeholder()}${descriptor ? ` ${descriptor}` : ""}`;
      });
      return `srcset="${replaced.join(", ")}"`;
    });
    return out;
  };

  const fixCss = (content: string) => {
    return content.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (m, _q, rawUrl) => {
      const u = String(rawUrl).trim();
      if (!u || isExternal(u)) return m;
      const p = normalize(u);
      if (!p || existing.has(p)) return m;
      fixed++;
      return `url('${placeholder()}')`;
    });
  };

  const updated = files.map((f) => {
    if (/\.(?:html?|php)$/i.test(f.path)) {
      return { ...f, content: fixHtml(f.content) };
    }
    if (/\.css$/i.test(f.path)) {
      return { ...f, content: fixCss(f.content) };
    }
    return f;
  });

  return { files: updated, fixed };
}

function getPageTitleFromPath(path: string, lang: string, siteName?: string): string {
  const baseName = path.replace(/\.php$/i, '').replace(/[-_]/g, ' ');
  const titleCase = baseName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  
  const titles: Record<string, Record<string, string>> = {
    'cookie-policy': { en: 'Cookie Policy', de: 'Cookie-Richtlinie', uk: 'Політика Cookie', pl: 'Polityka Cookies', ru: 'Политика Cookie', es: 'Política de Cookies', fr: 'Politique de Cookies', it: 'Politica dei Cookie', ro: 'Politica Cookie', nl: 'Cookiebeleid', pt: 'Política de Cookies' },
    'privacy-policy': { en: 'Privacy Policy', de: 'Datenschutz', uk: 'Політика конфіденційності', pl: 'Polityka Prywatności', ru: 'Политика конфиденциальности', es: 'Política de Privacidad', fr: 'Politique de confidentialité', it: 'Informativa sulla Privacy', ro: 'Politica de Confidențialitate', nl: 'Privacybeleid', pt: 'Política de Privacidade' },
    'privacy': { en: 'Privacy Policy', de: 'Datenschutz', uk: 'Політика конфіденційності', pl: 'Polityka Prywatności', ru: 'Политика конфиденциальности' },
    'terms': { en: 'Terms of Service', de: 'AGB', uk: 'Умови використання', pl: 'Regulamin', ru: 'Условия использования', es: 'Términos de Servicio', fr: 'Conditions d\'utilisation', it: 'Termini di Servizio', ro: 'Termeni și Condiții', nl: 'Algemene Voorwaarden', pt: 'Termos de Serviço' },
    'thank-you': { en: 'Thank You', de: 'Vielen Dank', uk: 'Дякуємо', pl: 'Dziękujemy', ru: 'Спасибо', es: 'Gracias', fr: 'Merci', it: 'Grazie', ro: 'Mulțumim', nl: 'Bedankt', pt: 'Obrigado' },
    '404': { en: 'Page Not Found', de: 'Seite nicht gefunden', uk: 'Сторінку не знайдено', pl: 'Strona nie znaleziona', ru: 'Страница не найдена' },
  };
  
  const key = baseName.toLowerCase().replace(/\s+/g, '-');
  const langKey = lang.substring(0, 2);
  
  if (titles[key] && titles[key][langKey]) {
    return siteName ? `${titles[key][langKey]} - ${siteName}` : titles[key][langKey];
  }
  
  return siteName ? `${titleCase} - ${siteName}` : titleCase;
}

function getLanguageTexts(lang: string): Record<string, string> {
  const langKey = lang.substring(0, 2);
  const textSets: Record<string, Record<string, string>> = {
    en: { home: 'Home', back: 'Back', cookieIntro: 'This Cookie Policy explains how we use cookies and similar technologies.', privacyIntro: 'Your privacy is important to us.', termsIntro: 'Please read these terms carefully.', thankYou: 'Thank you for contacting us! We will get back to you soon.', notFound: 'The page you are looking for does not exist.', lastUpdated: 'Last updated', effectiveDate: 'Effective Date' },
    de: { home: 'Startseite', back: 'Zurück', cookieIntro: 'Diese Cookie-Richtlinie erklärt, wie wir Cookies verwenden.', privacyIntro: 'Ihre Privatsphäre ist uns wichtig.', termsIntro: 'Bitte lesen Sie diese Bedingungen sorgfältig.', thankYou: 'Vielen Dank für Ihre Nachricht! Wir werden uns in Kürze bei Ihnen melden.', notFound: 'Die gesuchte Seite existiert nicht.', lastUpdated: 'Zuletzt aktualisiert', effectiveDate: 'Gültig ab' },
    uk: { home: 'Головна', back: 'Назад', cookieIntro: 'Ця політика Cookie пояснює, як ми використовуємо файли cookie.', privacyIntro: 'Ваша конфіденційність важлива для нас.', termsIntro: 'Будь ласка, уважно прочитайте ці умови.', thankYou: 'Дякуємо за ваше звернення! Ми зв\'яжемося з вами найближчим часом.', notFound: 'Сторінку не знайдено.', lastUpdated: 'Останнє оновлення', effectiveDate: 'Дата набуття чинності' },
    pl: { home: 'Strona główna', back: 'Wstecz', cookieIntro: 'Ta polityka cookies wyjaśnia, jak używamy plików cookie.', privacyIntro: 'Twoja prywatność jest dla nas ważna.', termsIntro: 'Prosimy o uważne przeczytanie regulaminu.', thankYou: 'Dziękujemy za kontakt! Odpowiemy najszybciej jak to możliwe.', notFound: 'Strona nie istnieje.', lastUpdated: 'Ostatnia aktualizacja', effectiveDate: 'Data wejścia w życie' },
    ru: { home: 'Главная', back: 'Назад', cookieIntro: 'Данная политика cookie объясняет, как мы используем файлы cookie.', privacyIntro: 'Ваша конфиденциальность важна для нас.', termsIntro: 'Пожалуйста, внимательно прочитайте условия.', thankYou: 'Спасибо за обращение! Мы свяжемся с вами в ближайшее время.', notFound: 'Страница не найдена.', lastUpdated: 'Последнее обновление', effectiveDate: 'Дата вступления в силу' },
    es: { home: 'Inicio', back: 'Volver', cookieIntro: 'Esta política de cookies explica cómo utilizamos las cookies.', privacyIntro: 'Su privacidad es importante para nosotros.', termsIntro: 'Por favor lea estos términos cuidadosamente.', thankYou: '¡Gracias por contactarnos! Nos pondremos en contacto pronto.', notFound: 'La página no existe.', lastUpdated: 'Última actualización', effectiveDate: 'Fecha de entrada en vigor' },
    fr: { home: 'Accueil', back: 'Retour', cookieIntro: 'Cette politique de cookies explique comment nous utilisons les cookies.', privacyIntro: 'Votre vie privée est importante pour nous.', termsIntro: 'Veuillez lire attentivement ces conditions.', thankYou: 'Merci de nous avoir contactés! Nous vous répondrons bientôt.', notFound: 'La page n\'existe pas.', lastUpdated: 'Dernière mise à jour', effectiveDate: 'Date d\'entrée en vigueur' },
    it: { home: 'Home', back: 'Indietro', cookieIntro: 'Questa politica sui cookie spiega come utilizziamo i cookie.', privacyIntro: 'La tua privacy è importante per noi.', termsIntro: 'Si prega di leggere attentamente questi termini.', thankYou: 'Grazie per averci contattato! Ti risponderemo presto.', notFound: 'La pagina non esiste.', lastUpdated: 'Ultimo aggiornamento', effectiveDate: 'Data di entrata in vigore' },
    ro: { home: 'Acasă', back: 'Înapoi', cookieIntro: 'Această politică cookie explică modul în care utilizăm cookie-urile.', privacyIntro: 'Confidențialitatea dvs. este importantă pentru noi.', termsIntro: 'Vă rugăm să citiți cu atenție acești termeni.', thankYou: 'Mulțumim că ne-ați contactat! Vă vom răspunde în curând.', notFound: 'Pagina nu există.', lastUpdated: 'Ultima actualizare', effectiveDate: 'Data intrării în vigoare' },
  };
  
  return textSets[langKey] || textSets.en;
}

function generateMissingPageContent(
  pagePath: string,
  pageTitle: string,
  texts: Record<string, string>,
  headerHtml: string,
  footerHtml: string,
  siteName?: string,
  lang?: string
): string {
  const baseName = pagePath.replace(/\.php$/i, '').toLowerCase().replace(/[-_]/g, '-');
  const today = new Date().toISOString().split('T')[0];
  const brandName = siteName || 'Our Company';
  
  let mainContent = '';
  
  if (baseName.includes('cookie')) {
    mainContent = generateCookiePolicyContent(texts, brandName, today);
  } else if (baseName.includes('privacy')) {
    mainContent = generatePrivacyPolicyContent(texts, brandName, today);
  } else if (baseName.includes('terms')) {
    mainContent = generateTermsContent(texts, brandName, today);
  } else if (baseName.includes('thank')) {
    mainContent = `
      <section class="section" style="min-height: 60vh; display: flex; align-items: center;">
        <div class="container" style="text-align: center;">
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #16213e;">✓ ${pageTitle.split(' - ')[0]}</h1>
          <p style="font-size: 1.2rem; color: #666; max-width: 600px; margin: 0 auto 2rem;">${texts.thankYou}</p>
          <a href="index.php" class="btn btn-primary">${texts.home}</a>
        </div>
      </section>`;
  } else if (baseName.includes('404')) {
    mainContent = `
      <section class="section" style="min-height: 60vh; display: flex; align-items: center;">
        <div class="container" style="text-align: center;">
          <h1 style="font-size: 6rem; margin-bottom: 1rem; color: #e74c3c;">404</h1>
          <p style="font-size: 1.2rem; color: #666; max-width: 600px; margin: 0 auto 2rem;">${texts.notFound}</p>
          <a href="index.php" class="btn btn-primary">${texts.home}</a>
        </div>
      </section>`;
  } else if (baseName === 'index' || baseName === 'home') {
    // Homepage template with hero, features, about preview, CTA
    mainContent = generateHomepageContent(texts, brandName);
  } else if (baseName.includes('about')) {
    mainContent = generateAboutContent(texts, brandName);
  } else if (baseName.includes('service')) {
    mainContent = generateServicesContent(texts, brandName);
  } else if (baseName.includes('contact')) {
    mainContent = generateContactContent(texts, brandName);
  } else {
    // Generic page with more content
    mainContent = `
      <section class="section page-hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 80px 0;">
        <div class="container" style="text-align: center;">
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${pageTitle.split(' - ')[0]}</h1>
        </div>
      </section>
      <section class="section" style="padding: 80px 0;">
        <div class="container" style="max-width: 800px; margin: 0 auto;">
          <p style="color: #666; font-size: 1.1rem; line-height: 1.8; margin-bottom: 2rem;">
            Welcome to ${brandName}. We are dedicated to providing you with the best service possible. 
            Our team of experts is here to help you achieve your goals.
          </p>
          <p style="color: #666; font-size: 1.1rem; line-height: 1.8; margin-bottom: 2rem;">
            With years of experience in the industry, we understand what it takes to deliver exceptional results.
            Contact us today to learn more about how we can help you.
          </p>
          <a href="contact.php" class="btn btn-primary" style="margin-top: 1rem;">Contact Us</a>
        </div>
      </section>`;
  }
  
  return `<?php include 'includes/config.php'; ?>
<!DOCTYPE html>
<html lang="${lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  ${headerHtml || '<header class="header"><div class="container"><a href="index.php" class="logo">' + (siteName || 'Site') + '</a></div></header>'}
  
  <main>
    ${mainContent}
  </main>
  
  ${footerHtml || '<footer class="footer"><div class="container"><p>&copy; ' + new Date().getFullYear() + ' ' + (siteName || 'Company') + '</p></div></footer>'}
  
  <script src="js/main.js"></script>
</body>
</html>`;
}

function generateCookiePolicyContent(texts: Record<string, string>, siteName: string, date: string): string {
  return `
    <section class="section legal-page">
      <div class="container">
        <div class="legal-content">
          <h1>Cookie Policy</h1>
          <p><strong>${texts.effectiveDate}:</strong> ${date}</p>
          
          <h2>What Are Cookies</h2>
          <p>${texts.cookieIntro} Cookies are small text files that are stored on your device when you visit our website.</p>
          
          <h2>How We Use Cookies</h2>
          <p>We use cookies to:</p>
          <ul>
            <li>Remember your preferences and settings</li>
            <li>Understand how you use our website</li>
            <li>Improve your browsing experience</li>
            <li>Analyze website traffic and performance</li>
          </ul>
          
          <h2>Types of Cookies We Use</h2>
          <table>
            <thead>
              <tr><th>Cookie Type</th><th>Purpose</th><th>Duration</th></tr>
            </thead>
            <tbody>
              <tr><td>Essential</td><td>Required for basic website functionality</td><td>Session</td></tr>
              <tr><td>Performance</td><td>Help us understand how visitors use our site</td><td>1 year</td></tr>
              <tr><td>Functional</td><td>Remember your preferences</td><td>1 year</td></tr>
            </tbody>
          </table>
          
          <h2>Managing Cookies</h2>
          <p>You can control and manage cookies through your browser settings. Note that disabling cookies may affect your browsing experience.</p>
          
          <h2>Contact Us</h2>
          <p>If you have questions about our Cookie Policy, please contact us.</p>
          
          <p style="margin-top: 2rem;"><a href="index.php" class="btn btn-primary">${texts.home}</a></p>
        </div>
      </div>
    </section>`;
}

function generatePrivacyPolicyContent(texts: Record<string, string>, siteName: string, date: string): string {
  return `
    <section class="section legal-page">
      <div class="container">
        <div class="legal-content">
          <h1>Privacy Policy</h1>
          <p><strong>${texts.lastUpdated}:</strong> ${date}</p>
          
          <h2>Introduction</h2>
          <p>${texts.privacyIntro} This Privacy Policy explains how ${siteName} collects, uses, and protects your personal information.</p>
          
          <h2>Information We Collect</h2>
          <ul>
            <li>Contact information (name, email, phone number)</li>
            <li>Usage data and browsing patterns</li>
            <li>Information you provide through forms</li>
          </ul>
          
          <h2>How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and improve our services</li>
            <li>Respond to your inquiries</li>
            <li>Send important updates</li>
            <li>Analyze website usage</li>
          </ul>
          
          <h2>Data Protection</h2>
          <p>We implement appropriate security measures to protect your personal information from unauthorized access, alteration, or disclosure.</p>
          
          <h2>Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.</p>
          
          <h2>Contact Us</h2>
          <p>For privacy-related questions, please contact our data protection officer.</p>
          
          <p style="margin-top: 2rem;"><a href="index.php" class="btn btn-primary">${texts.home}</a></p>
        </div>
      </div>
    </section>`;
}

function generateHomepageContent(texts: Record<string, string>, siteName: string): string {
  return `
    <section class="hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 120px 0; text-align: center;">
      <div class="container">
        <h1 style="font-size: 3rem; margin-bottom: 1.5rem;">${siteName}</h1>
        <p style="font-size: 1.25rem; max-width: 600px; margin: 0 auto 2rem; opacity: 0.9;">Welcome to ${siteName}. We provide exceptional services tailored to your needs.</p>
        <a href="contact.php" class="btn btn-primary" style="background: #fff; color: #667eea; padding: 14px 32px; border-radius: 6px; font-weight: 600; text-decoration: none;">Get in Touch</a>
      </div>
    </section>
    
    <section class="features" style="padding: 80px 0; background: #f8f9fa;">
      <div class="container">
        <h2 style="text-align: center; font-size: 2rem; margin-bottom: 3rem; color: #333;">Why Choose Us</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px;">
          <div class="feature-card" style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #333; margin-bottom: 1rem;">Professional Excellence</h3>
            <p style="color: #666; line-height: 1.7;">We deliver outstanding results with attention to detail and commitment to quality.</p>
          </div>
          <div class="feature-card" style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #333; margin-bottom: 1rem;">Expert Team</h3>
            <p style="color: #666; line-height: 1.7;">Our experienced professionals bring years of expertise to every project.</p>
          </div>
          <div class="feature-card" style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #333; margin-bottom: 1rem;">Customer Focus</h3>
            <p style="color: #666; line-height: 1.7;">Your satisfaction is our priority. We work closely with you to exceed expectations.</p>
          </div>
        </div>
      </div>
    </section>
    
    <section class="about-preview" style="padding: 80px 0;">
      <div class="container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; align-items: center;">
        <div>
          <img src="https://picsum.photos/seed/about${siteName.length}/600/400" alt="About ${siteName}" style="width: 100%; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
        </div>
        <div>
          <h2 style="font-size: 2rem; margin-bottom: 1.5rem; color: #333;">About ${siteName}</h2>
          <p style="color: #666; line-height: 1.8; margin-bottom: 1.5rem;">With years of experience in our industry, we have built a reputation for excellence and reliability. Our team is dedicated to providing personalized solutions that meet your unique needs.</p>
          <a href="about.php" style="color: #667eea; font-weight: 600; text-decoration: none;">Learn more about us →</a>
        </div>
      </div>
    </section>
    
    <section class="services-preview" style="padding: 80px 0; background: #f8f9fa;">
      <div class="container">
        <h2 style="text-align: center; font-size: 2rem; margin-bottom: 3rem; color: #333;">Our Services</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px;">
          <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #333; margin-bottom: 1rem;">Consulting</h3>
            <p style="color: #666; line-height: 1.7;">Expert advice to help you make informed decisions and achieve your goals.</p>
          </div>
          <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #333; margin-bottom: 1rem;">Implementation</h3>
            <p style="color: #666; line-height: 1.7;">Professional execution of projects with precision and efficiency.</p>
          </div>
          <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #333; margin-bottom: 1rem;">Support</h3>
            <p style="color: #666; line-height: 1.7;">Ongoing assistance to ensure your continued success and satisfaction.</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 2rem;">
          <a href="services.php" class="btn" style="background: #667eea; color: #fff; padding: 14px 32px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block;">View All Services</a>
        </div>
      </div>
    </section>
    
    <section class="cta" style="padding: 80px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-align: center;">
      <div class="container">
        <h2 style="font-size: 2rem; margin-bottom: 1rem;">Ready to Get Started?</h2>
        <p style="max-width: 500px; margin: 0 auto 2rem; opacity: 0.9;">Contact us today to discuss how we can help you achieve your goals.</p>
        <a href="contact.php" class="btn" style="background: #fff; color: #667eea; padding: 14px 32px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block;">Contact Us</a>
      </div>
    </section>`;
}

function generateAboutContent(texts: Record<string, string>, siteName: string): string {
  return `
    <section class="page-hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 80px 0; text-align: center;">
      <div class="container">
        <h1 style="font-size: 2.5rem;">About ${siteName}</h1>
      </div>
    </section>
    
    <section class="about-intro" style="padding: 80px 0;">
      <div class="container" style="max-width: 900px; margin: 0 auto;">
        <h2 style="font-size: 2rem; margin-bottom: 1.5rem; color: #333;">Our Story</h2>
        <p style="color: #666; line-height: 1.8; margin-bottom: 1.5rem;">Founded with a vision to provide exceptional services, ${siteName} has grown to become a trusted name in our industry. Our journey began with a simple goal: to deliver outstanding results while building lasting relationships with our clients.</p>
        <p style="color: #666; line-height: 1.8;">Today, we continue to uphold the same values that have guided us from the start - integrity, excellence, and a genuine commitment to our clients' success.</p>
      </div>
    </section>
    
    <section class="mission-vision" style="padding: 80px 0; background: #f8f9fa;">
      <div class="container">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px;">
          <div style="background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #667eea; margin-bottom: 1rem;">Our Mission</h3>
            <p style="color: #666; line-height: 1.7;">To provide innovative solutions that help our clients achieve their goals while maintaining the highest standards of quality and professionalism.</p>
          </div>
          <div style="background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <h3 style="color: #667eea; margin-bottom: 1rem;">Our Vision</h3>
            <p style="color: #666; line-height: 1.7;">To be the leading provider in our industry, recognized for excellence, innovation, and unwavering commitment to customer satisfaction.</p>
          </div>
        </div>
      </div>
    </section>
    
    <section class="values" style="padding: 80px 0;">
      <div class="container">
        <h2 style="text-align: center; font-size: 2rem; margin-bottom: 3rem; color: #333;">Our Values</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; text-align: center;">
          <div><h4 style="color: #333;">Integrity</h4><p style="color: #666;">We do what's right, always.</p></div>
          <div><h4 style="color: #333;">Excellence</h4><p style="color: #666;">We strive for the best in everything.</p></div>
          <div><h4 style="color: #333;">Innovation</h4><p style="color: #666;">We embrace new ideas and solutions.</p></div>
          <div><h4 style="color: #333;">Teamwork</h4><p style="color: #666;">We achieve more together.</p></div>
        </div>
      </div>
    </section>
    
    <section class="team" style="padding: 80px 0; background: #f8f9fa;">
      <div class="container">
        <h2 style="text-align: center; font-size: 2rem; margin-bottom: 3rem; color: #333;">Our Team</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px;">
          <div style="text-align: center;">
            <img src="https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" alt="Team member" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 1rem;">
            <h4 style="color: #333; margin-bottom: 0.5rem;">John Smith</h4>
            <p style="color: #666;">CEO & Founder</p>
          </div>
          <div style="text-align: center;">
            <img src="https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" alt="Team member" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 1rem;">
            <h4 style="color: #333; margin-bottom: 0.5rem;">Sarah Johnson</h4>
            <p style="color: #666;">Operations Director</p>
          </div>
          <div style="text-align: center;">
            <img src="https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" alt="Team member" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 1rem;">
            <h4 style="color: #333; margin-bottom: 0.5rem;">Michael Chen</h4>
            <p style="color: #666;">Technical Lead</p>
          </div>
          <div style="text-align: center;">
            <img src="https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" alt="Team member" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 1rem;">
            <h4 style="color: #333; margin-bottom: 0.5rem;">Emily Davis</h4>
            <p style="color: #666;">Client Relations</p>
          </div>
        </div>
      </div>
    </section>`;
}

function generateServicesContent(texts: Record<string, string>, siteName: string): string {
  return `
    <section class="page-hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 80px 0; text-align: center;">
      <div class="container">
        <h1 style="font-size: 2.5rem;">Our Services</h1>
        <p style="max-width: 600px; margin: 1rem auto 0; opacity: 0.9;">Discover how ${siteName} can help you achieve your goals with our comprehensive range of services.</p>
      </div>
    </section>
    
    <section class="services-list" style="padding: 80px 0;">
      <div class="container">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 40px;">
          <div class="service-card" style="background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-top: 4px solid #667eea;">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.5rem;">Consulting Services</h3>
            <p style="color: #666; line-height: 1.7; margin-bottom: 1.5rem;">Our expert consultants provide strategic guidance to help you navigate challenges and capitalize on opportunities. We analyze your situation and develop tailored solutions.</p>
            <ul style="color: #666; line-height: 2;">
              <li>Strategic planning</li>
              <li>Market analysis</li>
              <li>Process optimization</li>
            </ul>
          </div>
          
          <div class="service-card" style="background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-top: 4px solid #667eea;">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.5rem;">Implementation</h3>
            <p style="color: #666; line-height: 1.7; margin-bottom: 1.5rem;">From concept to completion, we execute projects with precision and efficiency. Our team ensures seamless implementation while minimizing disruption to your operations.</p>
            <ul style="color: #666; line-height: 2;">
              <li>Project management</li>
              <li>Quality assurance</li>
              <li>Timely delivery</li>
            </ul>
          </div>
          
          <div class="service-card" style="background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-top: 4px solid #667eea;">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.5rem;">Training & Development</h3>
            <p style="color: #666; line-height: 1.7; margin-bottom: 1.5rem;">Empower your team with the knowledge and skills they need to excel. Our training programs are designed to deliver practical, actionable insights.</p>
            <ul style="color: #666; line-height: 2;">
              <li>Customized workshops</li>
              <li>Skill development</li>
              <li>Ongoing support</li>
            </ul>
          </div>
          
          <div class="service-card" style="background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-top: 4px solid #667eea;">
            <h3 style="color: #333; margin-bottom: 1rem; font-size: 1.5rem;">Support & Maintenance</h3>
            <p style="color: #666; line-height: 1.7; margin-bottom: 1.5rem;">Our commitment doesn't end at delivery. We provide ongoing support to ensure your continued success and address any challenges that arise.</p>
            <ul style="color: #666; line-height: 2;">
              <li>24/7 availability</li>
              <li>Regular updates</li>
              <li>Performance monitoring</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
    
    <section class="process" style="padding: 80px 0; background: #f8f9fa;">
      <div class="container">
        <h2 style="text-align: center; font-size: 2rem; margin-bottom: 3rem; color: #333;">Our Process</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; text-align: center;">
          <div>
            <div style="width: 60px; height: 60px; background: #667eea; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem; font-weight: bold;">1</div>
            <h4 style="color: #333;">Consultation</h4>
            <p style="color: #666;">We listen to understand your needs</p>
          </div>
          <div>
            <div style="width: 60px; height: 60px; background: #667eea; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem; font-weight: bold;">2</div>
            <h4 style="color: #333;">Planning</h4>
            <p style="color: #666;">We develop a customized strategy</p>
          </div>
          <div>
            <div style="width: 60px; height: 60px; background: #667eea; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem; font-weight: bold;">3</div>
            <h4 style="color: #333;">Execution</h4>
            <p style="color: #666;">We implement with precision</p>
          </div>
          <div>
            <div style="width: 60px; height: 60px; background: #667eea; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem; font-weight: bold;">4</div>
            <h4 style="color: #333;">Support</h4>
            <p style="color: #666;">We ensure ongoing success</p>
          </div>
        </div>
      </div>
    </section>
    
    <section class="cta" style="padding: 80px 0; text-align: center;">
      <div class="container">
        <h2 style="font-size: 2rem; margin-bottom: 1rem; color: #333;">Ready to Work Together?</h2>
        <p style="color: #666; max-width: 500px; margin: 0 auto 2rem;">Contact us today to discuss your project and discover how we can help.</p>
        <a href="contact.php" class="btn" style="background: #667eea; color: #fff; padding: 14px 32px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block;">Get a Quote</a>
      </div>
    </section>`;
}

function generateContactContent(texts: Record<string, string>, siteName: string): string {
  return `
    <section class="page-hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 80px 0; text-align: center;">
      <div class="container">
        <h1 style="font-size: 2.5rem;">Contact Us</h1>
        <p style="max-width: 600px; margin: 1rem auto 0; opacity: 0.9;">We'd love to hear from you. Get in touch with our team.</p>
      </div>
    </section>
    
    <section class="contact-section" style="padding: 80px 0;">
      <div class="container">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 60px;">
          <div>
            <h2 style="font-size: 1.75rem; margin-bottom: 1.5rem; color: #333;">Get in Touch</h2>
            <p style="color: #666; line-height: 1.8; margin-bottom: 2rem;">Have a question or want to discuss a project? Fill out the form and our team will get back to you within 24 hours.</p>
            
            <div style="margin-bottom: 1.5rem;">
              <h4 style="color: #333; margin-bottom: 0.5rem;">Address</h4>
              <p style="color: #666;"><?php echo defined('SITE_ADDRESS') ? SITE_ADDRESS : '123 Business Street, City, Country'; ?></p>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
              <h4 style="color: #333; margin-bottom: 0.5rem;">Phone</h4>
              <p><a href="tel:<?php echo defined('SITE_PHONE') ? preg_replace('/[^+0-9]/', '', SITE_PHONE) : '+1234567890'; ?>" style="color: #667eea; text-decoration: none;"><?php echo defined('SITE_PHONE') ? SITE_PHONE : '+1 234 567 890'; ?></a></p>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
              <h4 style="color: #333; margin-bottom: 0.5rem;">Email</h4>
              <p><a href="mailto:<?php echo defined('SITE_EMAIL') ? SITE_EMAIL : 'info@example.com'; ?>" style="color: #667eea; text-decoration: none;"><?php echo defined('SITE_EMAIL') ? SITE_EMAIL : 'info@example.com'; ?></a></p>
            </div>
            
            <div>
              <h4 style="color: #333; margin-bottom: 0.5rem;">Working Hours</h4>
              <p style="color: #666;">Monday - Friday: 9:00 AM - 6:00 PM<br>Saturday - Sunday: Closed</p>
            </div>
          </div>
          
          <div>
            <form action="form-handler.php" method="POST" style="background: #f8f9fa; padding: 40px; border-radius: 12px;">
              <div style="margin-bottom: 1.5rem;">
                <label for="name" style="display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500;">Your Name *</label>
                <input type="text" id="name" name="name" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem;">
              </div>
              
              <div style="margin-bottom: 1.5rem;">
                <label for="email" style="display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500;">Email Address *</label>
                <input type="email" id="email" name="email" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem;">
              </div>
              
              <div style="margin-bottom: 1.5rem;">
                <label for="phone" style="display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500;">Phone Number</label>
                <input type="tel" id="phone" name="phone" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem;">
              </div>
              
              <div style="margin-bottom: 1.5rem;">
                <label for="subject" style="display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500;">Subject *</label>
                <input type="text" id="subject" name="subject" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem;">
              </div>
              
              <div style="margin-bottom: 1.5rem;">
                <label for="message" style="display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500;">Message *</label>
                <textarea id="message" name="message" rows="5" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; resize: vertical;"></textarea>
              </div>
              
              <button type="submit" style="background: #667eea; color: #fff; padding: 14px 32px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; font-size: 1rem;">Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </section>`;
}

function generateTermsContent(texts: Record<string, string>, siteName: string, date: string): string {
  return `
    <section class="section legal-page">
      <div class="container">
        <div class="legal-content">
          <h1>Terms of Service</h1>
          <p><strong>${texts.effectiveDate}:</strong> ${date}</p>
          
          <h2>Agreement to Terms</h2>
          <p>${texts.termsIntro} By accessing our website, you agree to be bound by these Terms of Service.</p>
          
          <h2>Use of Our Services</h2>
          <p>You agree to use our services only for lawful purposes and in accordance with these Terms.</p>
          
          <h2>Intellectual Property</h2>
          <p>All content on this website is the property of ${siteName} and is protected by copyright laws.</p>
          
          <h2>Limitation of Liability</h2>
          <p>${siteName} shall not be liable for any indirect, incidental, or consequential damages arising from your use of our services.</p>
          
          <h2>Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of our services constitutes acceptance of updated terms.</p>
          
          <h2>Contact</h2>
          <p>For questions about these terms, please contact us.</p>
          
          <p style="margin-top: 2rem;"><a href="index.php" class="btn btn-primary">${texts.home}</a></p>
        </div>
      </div>
    </section>`;
}
// ============ END ENSURE MISSING LINKED PAGES ============

function ensureCookiePolicyAndBanner(
  files: Array<{ path: string; content: string }>,
  language?: string
): { files: Array<{ path: string; content: string }>; warnings: string[] } {
  const warnings: string[] = [];
  
  // Find cookie policy page
  const cookiePolicyFile = files.find(f => 
    /cookie[-_]?polic[yi]?\.(?:html?|php)$/i.test(f.path) ||
    /cookies?\.(?:html?|php)$/i.test(f.path)
  );
  
  // Determine text based on language (Cookie Settings modal)
  const langLower = (language || 'en').toLowerCase();

  const cookieTexts: Record<string, {
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
  }> = {
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
    uk: {
      cookiePolicyText: 'Політика Cookie',
      cookieBannerText: 'Ми використовуємо файли cookie для покращення вашого досвіду. Ви можете налаштувати свої вподобання.',
      acceptAllText: 'Прийняти всі',
      settingsText: 'Налаштування cookie',
      saveSettingsText: 'Зберегти налаштування',
      declineAllText: 'Відхилити всі',
      learnMoreText: 'Дізнатися більше',
      cookieSettingsTitle: 'Налаштування cookie',
      cookieSettingsDesc: 'Налаштуйте типи cookie-файлів, які ви дозволяєте використовувати на нашому сайті. Обов\'язкові cookie необхідні для функціонування сайту.',
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
    }
  };

  let detectedLang = 'en';
  if (langLower.includes('uk')) detectedLang = 'uk';
  else if (langLower.includes('ru')) detectedLang = 'ru';

  const t = cookieTexts[detectedLang] || cookieTexts.en;
  
  // NOTE: for PHP generator we only guarantee EN/UK/RU cookie settings strings here.
  
  const cookiePolicyPath = cookiePolicyFile?.path.replace(/^\.?\//, '') || 'cookie-policy.php';
  
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
#${COOKIE_MODAL_ID} .always-active{color:#4da6ff;font-size:13px;font-weight:500}
#${COOKIE_MODAL_ID} .modal-footer{padding:16px 24px;border-top:1px solid #e5e5e5;display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap}
#${COOKIE_MODAL_ID} .modal-footer .cookie-btn{padding:12px 24px}
@media(max-width:480px){#${COOKIE_BANNER_ID}{flex-direction:column;text-align:center}#${COOKIE_MODAL_ID} .modal-footer{justify-content:center}}
</style>
<div id="${COOKIE_BANNER_ID}">
  <p>${t.cookieBannerText} <a href="${cookiePolicyPath}">${t.learnMoreText}</a></p>
  <button class="cookie-btn cookie-btn-secondary" onclick="document.getElementById('${COOKIE_MODAL_ID}').classList.add('show')">${t.settingsText}</button>
  <button class="cookie-btn cookie-btn-primary" onclick="acceptAllCookies()">${t.acceptAllText}</button>
</div>
<div id="${COOKIE_MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header"><h3>${t.cookieSettingsTitle}</h3><p>${t.cookieSettingsDesc}</p></div>
    <div class="modal-body">
      <div class="cookie-option"><div class="cookie-option-header"><span class="cookie-option-title">${t.necessaryTitle}</span><span class="always-active">${t.alwaysActive}</span></div><p class="cookie-option-desc">${t.necessaryDesc}</p></div>
      <div class="cookie-option"><div class="cookie-option-header"><span class="cookie-option-title">${t.analyticsTitle}</span><label class="cookie-toggle"><input type="checkbox" id="cookie-analytics"><span class="slider"></span></label></div><p class="cookie-option-desc">${t.analyticsDesc}</p></div>
      <div class="cookie-option"><div class="cookie-option-header"><span class="cookie-option-title">${t.marketingTitle}</span><label class="cookie-toggle"><input type="checkbox" id="cookie-marketing"><span class="slider"></span></label></div><p class="cookie-option-desc">${t.marketingDesc}</p></div>
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
  if(prefs){document.getElementById('${COOKIE_BANNER_ID}').style.display='none';}
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
document.getElementById('${COOKIE_MODAL_ID}').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show');});
</script>
<!-- End Cookie Banner -->
`;
  
  const updatedFiles = files.map(f => {
    if (!/\.(?:html?|php)$/i.test(f.path)) return f;
    
    // CRITICAL: Skip include files - they should NOT contain HTML/cookie banners
    // Only add banners to actual pages, not includes/config.php, includes/header.php, etc.
    if (/includes?\//i.test(f.path) || /config\.php$/i.test(f.path)) {
      return f;
    }
    
    let content = f.content;
    let modified = false;
    
    // If the page has any cookie banner but not OUR settings modal, upgrade it.
    const hasOurCookieSettings =
      content.includes(COOKIE_MODAL_ID) ||
      content.includes(COOKIE_BANNER_ID) ||
      /cookiePreferences/i.test(content);

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
  const PHONE_REGEX = /(?<!href=["']tel:[^"']*?)(?<!["'>])(\+\d[\d\s().-]{7,}\d)(?![^<]*<\/a>)/g;
  
  const updatedFiles = files.map(f => {
    if (!/\.(?:html?|php)$/i.test(f.path)) return f;
    
    let content = f.content;
    let fileFixed = 0;
    
    content = content.replace(PHONE_REGEX, (match, phone, offset) => {
      const before = content.substring(Math.max(0, offset - 100), offset);
      if (/src=["'][^"']*$/i.test(before)) return match;
      if (/href=["'](?!tel:)[^"']*$/i.test(before)) return match;
      if (/content=["'][^"']*$/i.test(before)) return match;
      if (/data-[\w-]+=["'][^"']*$/i.test(before)) return match;
      
      const beforeLastOpenTag = content.substring(0, offset).match(/<a\s[^>]*>[^<]*$/i);
      if (beforeLastOpenTag) return match;
      
      fileFixed++;
      const telNumber = phone.replace(/[^\d+]/g, '');
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
    if (!/\.(?:html?|php)$/i.test(f.path)) return f;
    
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
    
    return { ...f, content };
  });
  
  return { files: updatedFiles, warnings };
}
// ============ END PHONE ON ALL PAGES ============

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
  
  const { files: filesAfterContactValidation, warnings: contactWarnings } = validateContactPage(filesWithClickablePhones, geo);
  allWarnings.push(...contactWarnings);
  
  const { files: filesWithContactLinks, warnings: footerWarnings } = ensureContactLinkInFooters(filesAfterContactValidation);
  allWarnings.push(...footerWarnings);
  
  const { files: filesWithLegalLinks, warnings: legalWarnings } = ensureLegalLinksInFooters(filesWithContactLinks, language);
  allWarnings.push(...legalWarnings);
  
  const { files: finalFiles, warnings: cookieWarnings } = ensureCookiePolicyAndBanner(filesWithLegalLinks, language);
  allWarnings.push(...cookieWarnings);
  
  if (allWarnings.length > 0) {
    console.log(`📋 PHP Contact & Legal validation complete with ${allWarnings.length} fixes:`);
    allWarnings.forEach(w => console.log(`   - ${w}`));
  } else {
    console.log(`✅ PHP Contact & Legal validation passed - no fixes needed`);
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

function ensureFaviconAndLogoInFiles(
  files: Array<{ path: string; content: string }>,
  siteNameRaw?: string,
  brandColors?: { primary: string; accent: string }
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

  // Use color scheme colors if provided, otherwise default to emerald/green
  const primaryColor = brandColors?.primary || "#10b981";
  const accentColor = brandColors?.accent || "#047857";

  const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64" role="img" aria-label="${safeText(siteName)} logo">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primaryColor}"/>
      <stop offset="1" stop-color="${accentColor}"/>
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
      <stop offset="0" stop-color="${primaryColor}"/>
      <stop offset="1" stop-color="${accentColor}"/>
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

    if (!/rel=["']icon["']/i.test(content)) {
      const link = `\n<link rel="icon" href="favicon.ico" type="image/x-icon">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n`;
      content = /<\/head>/i.test(content)
        ? content.replace(/<\/head>/i, `${link}</head>`)
        : `${link}${content}`;
    } else {
      if (!/href=["']favicon\.ico["']/i.test(content)) {
        const link = `\n<link rel="icon" href="favicon.ico" type="image/x-icon">\n`;
        content = /<\/head>/i.test(content)
          ? content.replace(/<\/head>/i, `${link}</head>`)
          : `${link}${content}`;
      }
    }

    content = content.replace(
      /<a([^>]*\bclass=["'][^"']*(?:nav-logo|logo|brand)[^"']*["'][^>]*)>(?!\s*<img\b)[\s\S]*?<\/a>/gi,
      (_m, aAttrs) =>
        `<a${aAttrs}><img src="logo.svg" alt="${safeText(siteName)} logo" style="height:40px;width:auto;display:block" loading="eager"></a>`
    );

    return { ...f, content };
  });
}
// ============ END PHONE NUMBER VALIDATION ============

const SYSTEM_PROMPT = `You are a prompt refiner for professional, multi-page PHP websites.

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

// ~30 unique layout variations for randomization or manual selection
const LAYOUT_VARIATIONS = [
  // Classic & Corporate
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
    id: "corporate",
    name: "Business Serious",
    description: `LAYOUT STYLE: Business Serious
- Hero: Conservative hero with company logo prominent, subtle background pattern
- Sections: Clean professional grid with consistent spacing
- Features: 4-column grid with formal icons and descriptions
- Testimonials: Professional quotes with company names and positions
- CTA: Understated call-to-action with navy/dark color scheme
- Footer: Comprehensive footer with all company information`
  },
  {
    id: "professional",
    name: "Professional",
    description: `LAYOUT STYLE: Professional
- Hero: Balanced hero with professional imagery and clear value proposition
- Sections: Two-column layout with professional photos
- Features: Clean icon grid with hover effects
- Testimonials: Formal testimonial cards with headshots
- CTA: Professional button design with trust indicators
- Footer: Well-organized footer with sitemap`
  },
  {
    id: "executive",
    name: "Elite Executive",
    description: `LAYOUT STYLE: Elite Executive
- Hero: Luxury feel with subtle animations and premium typography
- Sections: Generous whitespace with high-end photography
- Features: Minimal but impactful feature presentation
- Testimonials: High-profile client testimonials with logos
- CTA: Exclusive invitation-style call-to-action
- Footer: Minimal luxury footer with gold/silver accents`
  },
  // Modern & Creative
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
    id: "creative",
    name: "Creative Chaos",
    description: `LAYOUT STYLE: Creative Chaos
- Hero: Unconventional layout with overlapping elements and artistic flair
- Sections: Non-traditional grid with creative element placement
- Features: Scattered cards with rotation and creative positioning
- Testimonials: Handwritten-style quotes with artistic backgrounds
- CTA: Creative button with unique hover animations
- Footer: Artistic footer with decorative elements`
  },
  {
    id: "artistic",
    name: "Art Gallery",
    description: `LAYOUT STYLE: Art Gallery
- Hero: Full-screen artwork with minimal text overlay
- Sections: Museum-like spacing with large visual focus
- Features: Art-inspired cards with frame-like borders
- Testimonials: Curator-style quotes with artistic typography
- CTA: Elegant invitation-style button
- Footer: Minimal gallery-style footer`
  },
  // Minimalist & Clean
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
    id: "zen",
    name: "Zen Calm",
    description: `LAYOUT STYLE: Zen Calm
- Hero: Peaceful imagery with soft colors and mindful typography
- Sections: Breathing room between sections, soft transitions
- Features: Simple icons with calming color palette
- Testimonials: Peaceful quotes with nature imagery
- CTA: Soft, inviting call-to-action
- Footer: Serene footer with minimal links`
  },
  {
    id: "clean",
    name: "Clean Space",
    description: `LAYOUT STYLE: Clean Space
- Hero: Crisp, clean hero with sharp typography
- Sections: Well-defined sections with clear boundaries
- Features: Clean card grid with consistent styling
- Testimonials: Simple, elegant testimonial display
- CTA: Clean, prominent button
- Footer: Organized, clean footer layout`
  },
  {
    id: "whitespace",
    name: "Lots of Air",
    description: `LAYOUT STYLE: Lots of Air
- Hero: Spacious hero with minimal content
- Sections: Extra generous padding and margins
- Features: Widely spaced feature cards
- Testimonials: Single testimonial with lots of breathing room
- CTA: Isolated button with significant whitespace
- Footer: Spread out footer elements`
  },
  // Dynamic & Interactive
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
    id: "interactive",
    name: "Interactive",
    description: `LAYOUT STYLE: Interactive
- Hero: Engaging hero with interactive elements
- Sections: Sections with reveal-on-scroll effects
- Features: Cards with flip or expand interactions
- Testimonials: Interactive testimonial carousel
- CTA: Animated button with micro-interactions
- Footer: Footer with interactive elements`
  },
  {
    id: "animated",
    name: "Animated",
    description: `LAYOUT STYLE: Animated
- Hero: Smooth entrance animations on load
- Sections: Scroll-triggered animations for each section
- Features: Animated icons and card transitions
- Testimonials: Fade-in testimonials with motion
- CTA: Pulsing or animated call-to-action button
- Footer: Subtle footer animations`
  },
  {
    id: "parallax",
    name: "Parallax",
    description: `LAYOUT STYLE: Parallax
- Hero: Multi-layer parallax background effect
- Sections: Parallax transitions between sections
- Features: Cards with depth and shadow movement
- Testimonials: Floating quote effect on scroll
- CTA: Fixed background with scrolling content overlay
- Footer: Parallax footer background`
  },
  // Tech & Product
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
    id: "startup",
    name: "Startup",
    description: `LAYOUT STYLE: Startup
- Hero: Bold headline with product demo video
- Sections: Problem-solution format with clear visuals
- Features: Benefit-focused cards with modern icons
- Testimonials: Investor and customer quotes
- CTA: Early access or signup emphasis
- Footer: Startup footer with social and newsletter`
  },
  {
    id: "tech",
    name: "Tech Modern",
    description: `LAYOUT STYLE: Tech Modern
- Hero: Dark theme with neon accents and tech imagery
- Sections: Code-inspired layouts with monospace fonts
- Features: Terminal-style or dashboard-like presentation
- Testimonials: Tech industry quotes with company logos
- CTA: Tech-style button with hover glow
- Footer: Dark footer with tech aesthetic`
  },
  {
    id: "app",
    name: "App Landing",
    description: `LAYOUT STYLE: App Landing
- Hero: Phone mockup with app screenshot, download buttons
- Sections: App feature showcase with device frames
- Features: App store style feature highlights
- Testimonials: App store reviews with star ratings
- CTA: Download on App Store / Google Play buttons
- Footer: App links and support information`
  },
  // Style-specific
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
    id: "glassmorphism",
    name: "Glassmorphism",
    description: `LAYOUT STYLE: Glassmorphism
- Hero: Frosted glass effect with colorful blur background
- Sections: Translucent sections with backdrop blur
- Features: Glass cards with subtle borders and shadows
- Testimonials: Floating glass quote cards
- CTA: Glass button with light border
- Footer: Semi-transparent footer`
  },
  {
    id: "neomorphism",
    name: "Neomorphism",
    description: `LAYOUT STYLE: Neomorphism
- Hero: Soft shadows creating depth on light background
- Sections: Raised and inset effects throughout
- Features: Soft shadow cards that appear pressed or raised
- Testimonials: Inset quote cards with soft shadows
- CTA: Soft shadow button with press effect
- Footer: Subtle neomorphic footer elements`
  },
  {
    id: "retro",
    name: "Retro 90s",
    description: `LAYOUT STYLE: Retro 90s
- Hero: Bold neon colors, geometric shapes, retro fonts
- Sections: Memphis design influences with shapes and patterns
- Features: Retro-styled cards with bright colors
- Testimonials: Vintage-style quote presentations
- CTA: Retro button with nostalgic styling
- Footer: 90s-inspired footer design`
  },
  // Portfolio & Showcase
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
  },
  {
    id: "agency",
    name: "Agency",
    description: `LAYOUT STYLE: Agency
- Hero: Bold agency branding with client work preview
- Sections: Case studies with before/after or process steps
- Features: Service offerings with visual icons
- Testimonials: Client success stories with metrics
- CTA: "Start a project" emphasis
- Footer: Professional agency footer with awards`
  },
  {
    id: "studio",
    name: "Studio",
    description: `LAYOUT STYLE: Studio
- Hero: Cinematic hero with video background
- Sections: Behind-the-scenes style content
- Features: Equipment or capability showcase
- Testimonials: Director/producer style quotes
- CTA: Booking or consultation focused
- Footer: Creative studio footer with showreel link`
  },
  // E-commerce & Services
  {
    id: "ecommerce",
    name: "E-commerce",
    description: `LAYOUT STYLE: E-commerce
- Hero: Featured products with sale banner
- Sections: Product grids with quick-view functionality
- Features: Shipping, returns, payment icons
- Testimonials: Customer reviews with star ratings
- CTA: Shop now and add to cart emphasis
- Footer: E-commerce footer with payment icons and policies`
  },
  {
    id: "services",
    name: "Service Company",
    description: `LAYOUT STYLE: Service Company
- Hero: Service highlight with booking CTA
- Sections: Service packages with pricing
- Features: Why choose us points
- Testimonials: Customer success stories
- CTA: Book appointment or get quote
- Footer: Service area and contact information`
  },
  {
    id: "restaurant",
    name: "Restaurant/Cafe",
    description: `LAYOUT STYLE: Restaurant/Cafe
- Hero: Food photography with reservation CTA
- Sections: Menu highlights with mouth-watering images
- Features: Ambiance, chef, ingredients features
- Testimonials: Diner reviews with food photos
- CTA: Reserve a table or order online
- Footer: Hours, location, delivery partners`
  },
  {
    id: "hotel",
    name: "Hotel/Resort",
    description: `LAYOUT STYLE: Hotel/Resort
- Hero: Stunning property photos with booking widget
- Sections: Room types and amenities showcase
- Features: Spa, dining, activities highlights
- Testimonials: Guest reviews with travel platforms
- CTA: Book your stay with date picker
- Footer: Location map, contact, booking policies`
  }
];

const PHP_GENERATION_PROMPT = `CRITICAL: CREATE A STUNNING, PREMIUM MULTI-PAGE PHP WEBSITE WITH EXCEPTIONAL DESIGN QUALITY

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
- Mixing languages = BROKEN!

✅ CORRECT BEHAVIOR:
- If language = "en" → ALL text in English
- If language = "de" → ALL text in German (Startseite, Über uns, Dienstleistungen, Kontakt)
- If language = "uk" → ALL text in Ukrainian (Головна, Про нас, Послуги, Контакти)
- If language = "pl" → ALL text in Polish (Strona główna, O nas, Usługi, Kontakt)

**IF WEBSITE IS IN WRONG LANGUAGE = WEBSITE IS COMPLETELY BROKEN!**

⛔⛔⛔ TEXT CONTRAST - ABSOLUTELY CRITICAL - NO EXCEPTIONS! ⛔⛔⛔
**NEVER USE WHITE TEXT ON WHITE/LIGHT BACKGROUNDS!** This makes text INVISIBLE and BREAKS the website!

MANDATORY CONTRAST RULES:
- Light backgrounds (#fff, #f5f5f5, #fafafa, white, cream, beige): Use DARK text (#333, #222, #1a1a1a)
- Dark backgrounds (#1a1a1a, #222, #333, black, navy): Use WHITE or LIGHT text (#fff, #f5f5f5)
- Hero sections with background images: ALWAYS add dark overlay (rgba(0,0,0,0.5)) before white text
- Cards on light pages: Use dark text (#333 or darker) - NEVER white!

CSS EXAMPLES:
WRONG: .section { background: #fff; color: #fff; } /* INVISIBLE TEXT! */
CORRECT: .section { background: #fff; color: #333; } /* Readable! */
CORRECT: .dark-section { background: #1a1a1a; color: #fff; } /* Readable! */

**IF TEXT IS UNREADABLE = WEBSITE IS BROKEN!**

👤👥🚨 TEAM/STAFF PORTRAITS - MANDATORY HUMAN PHOTOS! 🚨👥👤
**When creating ANY section with people (Team, Staff, Employees, Testimonials with photos):**

YOU MUST USE REAL HUMAN PORTRAIT PHOTOS FROM PEXELS! These are VERIFIED working URLs:

MALE PORTRAITS (use these exact URLs):
- https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop

FEMALE PORTRAITS (use these exact URLs):
- https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop
- https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop

⛔ NEVER USE FOR PEOPLE:
- picsum.photos - these are RANDOM images, not faces!
- Placeholder URLs with random numbers
- Abstract images or silhouettes

✅ MANDATORY: Alternate male/female, use different URLs for each person!

**IF TEAM SECTION HAS NO REAL FACE PHOTOS = WEBSITE IS BROKEN!**

📞📧🚨 CONTACT INFO - READ THIS FIRST! ABSOLUTELY MANDATORY! 🚨📧📞
EVERY website MUST have a REAL phone number and email. NO EXCEPTIONS!

**PHONE NUMBER - REQUIRED IN FOOTER ONLY:**
- MUST appear in FOOTER on ALL pages (NOT in header!)
- MUST be realistic for the country/GEO
- MUST be clickable (tel:): <a href="tel:+493028976543">+49 30 2897 6543</a>
- The visible text MUST include the country code with "+" and spacing (never a bare local number)
- MUST be at least 10 digits total (excluding spaces, parentheses, dashes)
- NEVER output only the local part like "4567890" (INVALID)
- NEVER use placeholder patterns: 123456, 4567890, 555-1234, XXX, 000000, 999999, (555)
- ⚠️ CRITICAL: NEVER DUPLICATE THE COUNTRY CODE! Wrong: "+49 +49 30...", Correct: "+49 30..."
- Examples by country:
  * Germany: +49 30 2897 6543, +49 89 4521 7892
  * Poland: +48 22 593 27 41, +48 12 784 63 19
  * Spain: +34 912 643 781, +34 932 815 604
  * France: +33 1 42 68 53 21, +33 4 93 45 67 12
  * Italy: +39 06 8745 6321, +39 02 7654 3219
  * UK: +44 20 7946 0958, +44 161 496 0753
  * USA: +1 (212) 647-3812, +1 (415) 781-2046
  * Netherlands: +31 20 794 5682
  * Czech Republic: +420 221 643 781
  * Ukraine: +380 44 239 4187
  * Austria: +43 1 239 4187

**EMAIL - REQUIRED IN FOOTER ONLY:**
- MUST appear in FOOTER on ALL pages (NOT in header!)
- MUST use the site's domain: info@<sitename>.com, contact@<sitename>.com
- Extract domain from business name (lowercase, no spaces)
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
- PHP config example: 
  define('SITE_HOURS_WEEKDAYS', 'Monday - Friday: 9:00 AM - 6:00 PM');
  define('SITE_HOURS_WEEKEND', 'Saturday - Sunday: Closed');
- HTML example:
  <div class="footer-hours">
    <strong>Working Hours:</strong><br>
    <?php echo SITE_HOURS_WEEKDAYS; ?><br>
    <?php echo SITE_HOURS_WEEKEND; ?>
  </div>

⚠️ IF NO PHONE/EMAIL/HOURS IN OUTPUT = SITE IS BROKEN! ALWAYS INCLUDE THEM!

**🎨 DESIGN PHILOSOPHY - THIS IS NON-NEGOTIABLE:**
You are creating a PREMIUM, AGENCY-QUALITY website that looks like it cost $5,000+ to build.
The design must be EXCEPTIONAL - think award-winning agency work, not template garbage.

**⚠️ MANDATORY MULTI-PAGE REQUIREMENT - NON-NEGOTIABLE:**
You MUST create a MINIMUM of 6 SEPARATE PHP PAGE FILES. This is ABSOLUTELY REQUIRED:

REQUIRED PAGES (ALL MANDATORY):
1. index.php - Homepage with hero, features, about preview, services preview, testimonials, CTA
2. about.php - About Us page with company history, mission, vision, team section, values
3. services.php - Services/Products page with detailed service descriptions, benefits, process
4. contact.php - Contact page with WORKING form, map placeholder, contact info, working hours
5. thank-you.php - Thank you page after form submission
6. privacy.php - Privacy policy page with 10+ sections (see Privacy Policy requirements below)
7. terms.php - Terms of Service page with 14 sections (see Terms of Service requirements below)
8. cookie-policy.php - Cookie Policy page with cookies table (see Cookie Policy requirements below)

OPTIONAL ADDITIONAL PAGES (add 1-3 based on business type):
- portfolio.php - For creative/agency businesses
- team.php - Team members page
- faq.php - Frequently asked questions
- pricing.php - Pricing/packages (use "Contact for quote" instead of prices)
- blog.php - Blog listing page
- gallery.php - Photo gallery page

**FAILURE TO CREATE ALL 6 MANDATORY PAGES = INVALID OUTPUT**

**🖥️ PHP STRUCTURE - ABSOLUTELY CRITICAL:**
This is a PHP website. You MUST:
1. Use .php file extensions for ALL pages (index.php, about.php, services.php, contact.php, etc.)
2. Create reusable PHP includes for header, footer, and navigation:
   - includes/header.php - Contains <!DOCTYPE html>, <head>, navigation with links to ALL pages
   - includes/footer.php - Contains footer content and closing </body></html>
   - includes/config.php - Contains site configuration variables
3. Use PHP includes on every page:
   <?php include 'includes/header.php'; ?>
   <!-- page content -->
   <?php include 'includes/footer.php'; ?>
4. Create a proper contact form handler (form-handler.php) that processes POST data
5. Use PHP variables for site-wide settings (site name, email, phone)

**⚠️ CRITICAL PHP INCLUDE PATHS - MUST FOLLOW EXACTLY:**
- ALWAYS use simple relative paths: include 'includes/header.php';
- NEVER use ./ prefix: NOT include './includes/header.php';
- NEVER use absolute paths: NOT include '/includes/header.php';
- NEVER use dirname(__FILE__): NOT include dirname(__FILE__) . '/includes/header.php';

**CORRECT INCLUDE SYNTAX (USE THIS EXACTLY):**
\`\`\`php
<?php include 'includes/header.php'; ?>
<!-- page content here -->
<?php include 'includes/footer.php'; ?>
\`\`\`

**WRONG (NEVER DO THIS):**
\`\`\`php
<?php include './includes/header.php'; ?> // WRONG - no ./
<?php include_once __DIR__ . '/includes/header.php'; ?> // WRONG - no __DIR__
<?php require_once dirname(__FILE__).'/includes/header.php'; ?> // WRONG
\`\`\`

**PHP CODE REQUIREMENTS:**
- All PHP code MUST be valid and syntactically correct
- Use proper PHP opening tags: <?php
- Close PHP tags only when switching to HTML: ?>
- Use htmlspecialchars() for outputting user data
- Use proper form handling with $_POST
- Include error handling and validation
- DO NOT use deprecated functions

**MANDATORY FILE STRUCTURE (MINIMUM):**
\`\`\`
includes/
  config.php      - Site configuration (REQUIRED)
  header.php      - Header template with nav to ALL pages (REQUIRED)
  footer.php      - Footer template (REQUIRED)
index.php         - Homepage (REQUIRED)
about.php         - About page (REQUIRED)
services.php      - Services page (REQUIRED)
contact.php       - Contact page with form (REQUIRED)
form-handler.php  - Form processing (REQUIRED)
thank-you.php     - Thank you page (REQUIRED)
privacy.php       - Privacy policy with 10+ sections (REQUIRED)
terms.php         - Terms of Service with 14 sections (REQUIRED)
cookie-policy.php - Cookie Policy with cookies table (REQUIRED)
css/
  style.css       - Main stylesheet (REQUIRED)
js/
  script.js       - JavaScript functionality (REQUIRED)
\`\`\`

**EXAMPLE config.php (REPLACE WITH REAL VALUES FOR YOUR GEO):**
\`\`\`php
<?php
// Site Configuration - REPLACE WITH REALISTIC VALUES!
define('SITE_NAME', 'Company Name');
// EMAIL MUST be domain-based: info@companyname.com (extract from business name)
define('SITE_EMAIL', 'info@companyname.com');
// PHONE MUST be realistic for GEO! Examples: +49 30 2897 6543 (Germany), +48 22 456 78 90 (Poland)
define('SITE_PHONE', '+49 30 2897 6543');
define('SITE_ADDRESS', 'Friedrichstraße 123, 10117 Berlin, Germany');
define('PRIMARY_COLOR', '#2563eb');
define('SECONDARY_COLOR', '#1e40af');
?>
\`\`\`

**🎨🎨🎨 PREMIUM CSS DESIGN SYSTEM - ABSOLUTELY MANDATORY 🎨🎨🎨**
This is the MOST IMPORTANT part. The CSS must be EXCEPTIONAL:

\`\`\`css
/* ===== PREMIUM DESIGN SYSTEM - MANDATORY ===== */

/* CSS Custom Properties for cohesive design */
:root {
  /* Colors - Adjust based on brief */
  --primary: #2563eb;
  --primary-dark: #1e40af;
  --primary-light: #3b82f6;
  --primary-glow: rgba(37, 99, 235, 0.15);
  --secondary: #0f172a;
  --accent: #06b6d4;
  --success: #10b981;
  
  /* Neutrals */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-dark: #0f172a;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-light: #e2e8f0;
  --border-medium: #cbd5e1;
  
  /* Typography Scale */
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  
  /* Spacing Scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  --space-4xl: 6rem;
  
  /* Effects */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --shadow-glow: 0 0 40px var(--primary-glow);
  
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Reset & Base */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.7;
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow-x: hidden;
}

/* Typography with visual hierarchy */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

h1 { 
  font-size: clamp(2.5rem, 5vw, 4rem); 
  font-weight: 800;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

h2 { 
  font-size: clamp(2rem, 4vw, 3rem); 
  margin-bottom: var(--space-lg);
}

h3 { font-size: clamp(1.5rem, 3vw, 2rem); }
h4 { font-size: clamp(1.25rem, 2vw, 1.5rem); }

p {
  color: var(--text-secondary);
  margin-bottom: var(--space-md);
}

/* Links */
a {
  color: var(--primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--primary-dark);
}

/* Container */
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-xl);
}

/* ===== PREMIUM NAVIGATION ===== */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: all var(--transition-base);
}

.navbar.scrolled {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-md);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.logo {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.25rem;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  list-style: none;
}

.nav-links a {
  font-weight: 500;
  color: var(--text-secondary);
  position: relative;
  padding: var(--space-sm) 0;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  transition: width var(--transition-base);
}

.nav-links a:hover::after,
.nav-links a.active::after {
  width: 100%;
}

.nav-links a:hover {
  color: var(--text-primary);
}

.nav-cta {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white !important;
  padding: var(--space-sm) var(--space-lg) !important;
  border-radius: var(--radius-full);
  font-weight: 600;
  box-shadow: 0 4px 15px var(--primary-glow);
  transition: all var(--transition-base);
}

.nav-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--primary-glow);
}

.nav-cta::after {
  display: none !important;
}

.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: var(--space-sm);
  color: var(--text-primary);
}

/* ===== HERO SECTION - STUNNING ===== */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  padding: calc(80px + var(--space-4xl)) 0 var(--space-4xl);
  overflow: hidden;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
}

.hero-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.hero-bg::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 80%;
  height: 150%;
  background: radial-gradient(ellipse, var(--primary-glow) 0%, transparent 70%);
  animation: float 20s ease-in-out infinite;
}

.hero-bg::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 60%;
  height: 100%;
  background: radial-gradient(ellipse, rgba(6, 182, 212, 0.1) 0%, transparent 70%);
  animation: float 15s ease-in-out infinite reverse;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(30px, -30px) rotate(5deg); }
  66% { transform: translate(-20px, 20px) rotate(-5deg); }
}

.hero-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4xl);
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-content {
  max-width: 600px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  margin-bottom: var(--space-lg);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.hero-badge-dot {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.hero h1 {
  margin-bottom: var(--space-lg);
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-xl);
  line-height: 1.8;
}

.hero-buttons {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.hero-image-wrapper {
  position: relative;
}

.hero-image {
  width: 100%;
  height: auto;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  transform: perspective(1000px) rotateY(-5deg) rotateX(5deg);
  transition: transform var(--transition-slow);
}

.hero-image:hover {
  transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
}

.hero-float-card {
  position: absolute;
  background: white;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  align-items: center;
  gap: var(--space-md);
  animation: floatCard 6s ease-in-out infinite;
}

.hero-float-card.card-1 {
  top: 10%;
  right: -10%;
  animation-delay: 0s;
}

.hero-float-card.card-2 {
  bottom: 20%;
  left: -10%;
  animation-delay: 2s;
}

@keyframes floatCard {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

/* ===== PREMIUM BUTTONS ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-xl);
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-lg);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  text-decoration: none;
  white-space: nowrap;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  box-shadow: 0 4px 15px var(--primary-glow);
}

.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px var(--primary-glow);
  color: white;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}

.btn-secondary:hover {
  background: var(--bg-secondary);
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
}

.btn-outline:hover {
  background: var(--primary);
  color: white;
}

.btn-lg {
  padding: var(--space-lg) var(--space-2xl);
  font-size: 1.125rem;
}

.btn-icon {
  transition: transform var(--transition-fast);
}

.btn:hover .btn-icon {
  transform: translateX(4px);
}

/* ===== SECTIONS ===== */
section {
  padding: var(--space-4xl) 0;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto var(--space-3xl);
}

.section-badge {
  display: inline-block;
  padding: var(--space-xs) var(--space-md);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  margin-bottom: var(--space-md);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-title {
  margin-bottom: var(--space-md);
}

.section-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
}

/* ===== FEATURE CARDS - PREMIUM ===== */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-xl);
}

.feature-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: var(--space-2xl);
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--transition-base);
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-xl);
  border-color: transparent;
}

.feature-card:hover::before {
  transform: scaleX(1);
}

.feature-icon {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--primary-glow), rgba(6, 182, 212, 0.1));
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  margin-bottom: var(--space-lg);
}

.feature-card h3 {
  margin-bottom: var(--space-md);
  font-size: 1.25rem;
}

.feature-card p {
  color: var(--text-secondary);
  margin: 0;
}

/* ===== ABOUT SECTION ===== */
.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4xl);
  align-items: center;
}

.about-image-wrapper {
  position: relative;
}

.about-image {
  width: 100%;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
}

.about-image-accent {
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 200px;
  height: 200px;
  background: linear-gradient(135deg, var(--primary-glow), var(--accent));
  border-radius: var(--radius-2xl);
  z-index: -1;
  opacity: 0.5;
}

.about-content h2 {
  margin-bottom: var(--space-lg);
}

.about-content p {
  margin-bottom: var(--space-md);
}

.about-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
  margin-top: var(--space-2xl);
  padding-top: var(--space-2xl);
  border-top: 1px solid var(--border-light);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: var(--space-xs);
}

/* ===== SERVICES SECTION ===== */
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--space-xl);
}

.service-card {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}

.service-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-2xl);
}

.service-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.service-content {
  padding: var(--space-xl);
}

.service-content h3 {
  margin-bottom: var(--space-md);
}

.service-content p {
  color: var(--text-secondary);
  margin-bottom: var(--space-lg);
}

.service-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: 600;
  color: var(--primary);
}

.service-link:hover .btn-icon {
  transform: translateX(4px);
}

/* ===== TESTIMONIALS ===== */
.testimonials {
  background: var(--bg-secondary);
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--space-xl);
}

.testimonial-card {
  background: var(--bg-primary);
  padding: var(--space-2xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  position: relative;
}

.testimonial-quote {
  font-size: 4rem;
  color: var(--primary-glow);
  position: absolute;
  top: var(--space-md);
  right: var(--space-lg);
  line-height: 1;
}

.testimonial-text {
  font-size: 1.125rem;
  font-style: italic;
  color: var(--text-primary);
  margin-bottom: var(--space-xl);
  line-height: 1.8;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.testimonial-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
}

.testimonial-name {
  font-weight: 700;
  color: var(--text-primary);
}

.testimonial-role {
  font-size: 0.875rem;
  color: var(--text-muted);
}

/* ===== CTA SECTION ===== */
.cta {
  background: linear-gradient(135deg, var(--secondary) 0%, var(--primary-dark) 100%);
  color: white;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.cta::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%);
}

.cta-content {
  position: relative;
  z-index: 1;
  max-width: 700px;
  margin: 0 auto;
}

.cta h2 {
  color: white;
  margin-bottom: var(--space-md);
}

.cta p {
  color: rgba(255,255,255,0.8);
  font-size: 1.25rem;
  margin-bottom: var(--space-xl);
}

.cta .btn-primary {
  background: white;
  color: var(--primary);
}

.cta .btn-primary:hover {
  background: var(--bg-secondary);
}

/* ===== FOOTER ===== */
footer {
  background: var(--bg-dark);
  color: white;
  padding: var(--space-4xl) 0 var(--space-xl);
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: var(--space-3xl);
  margin-bottom: var(--space-3xl);
}

.footer-brand .logo {
  color: white;
  margin-bottom: var(--space-lg);
}

.footer-brand p {
  color: rgba(255,255,255,0.6);
  max-width: 300px;
}

.footer-column h4 {
  color: white;
  font-size: 1rem;
  margin-bottom: var(--space-lg);
}

.footer-column ul {
  list-style: none;
}

.footer-column li {
  margin-bottom: var(--space-sm);
}

.footer-column a {
  color: rgba(255,255,255,0.6);
  transition: color var(--transition-fast);
}

.footer-column a:hover {
  color: white;
}

.footer-bottom {
  padding-top: var(--space-xl);
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.footer-bottom p {
  color: rgba(255,255,255,0.4);
  font-size: 0.875rem;
  margin: 0;
}

.footer-bottom-links {
  display: flex;
  gap: var(--space-lg);
}

.footer-bottom-links a {
  color: rgba(255,255,255,0.4);
  font-size: 0.875rem;
}

/* ===== CONTACT PAGE ===== */
.contact-hero {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  padding: calc(80px + var(--space-3xl)) 0 var(--space-3xl);
  text-align: center;
}

.contact-section {
  padding: var(--space-4xl) 0;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: var(--space-3xl);
}

.contact-info {
  background: var(--bg-secondary);
  padding: var(--space-2xl);
  border-radius: var(--radius-xl);
}

.contact-info h2 {
  margin-bottom: var(--space-xl);
}

.info-item {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.info-item-icon {
  width: 48px;
  height: 48px;
  background: var(--primary-glow);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.info-item-content h4 {
  font-size: 1rem;
  margin-bottom: var(--space-xs);
}

.info-item-content p {
  color: var(--text-secondary);
  margin: 0;
}

.info-item-content a {
  color: var(--primary);
}

.contact-form-wrapper {
  background: white;
  padding: var(--space-2xl);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

.contact-form-wrapper h2 {
  margin-bottom: var(--space-xl);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: var(--space-md);
  border: 2px solid var(--border-light);
  border-radius: var(--radius-lg);
  font-size: 1rem;
  font-family: inherit;
  transition: all var(--transition-fast);
  background: var(--bg-primary);
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-glow);
}

.form-group textarea {
  resize: vertical;
  min-height: 150px;
}

.submit-btn {
  width: 100%;
  padding: var(--space-lg);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px var(--primary-glow);
}

/* ===== LEGAL PAGES ===== */
.legal-page {
  padding: calc(80px + var(--space-3xl)) 0 var(--space-4xl);
}

.legal-container {
  max-width: 800px;
  margin: 0 auto;
}

.legal-container h1 {
  margin-bottom: var(--space-lg);
}

.legal-container h2 {
  font-size: 1.5rem;
  margin-top: var(--space-2xl);
  margin-bottom: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border-light);
}

.legal-container h2:first-of-type {
  border-top: none;
  padding-top: 0;
}

.legal-container p {
  margin-bottom: var(--space-md);
}

.legal-container ul {
  margin-bottom: var(--space-md);
  padding-left: var(--space-xl);
}

.legal-container li {
  margin-bottom: var(--space-sm);
  color: var(--text-secondary);
}

/* ===== COOKIES TABLE ===== */
.cookies-table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-xl) 0;
  font-size: 0.9rem;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.cookies-table thead {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
}

.cookies-table th {
  padding: var(--space-md) var(--space-lg);
  text-align: left;
  font-weight: 600;
}

.cookies-table td {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-light);
}

.cookies-table tbody tr {
  transition: background var(--transition-fast);
}

.cookies-table tbody tr:hover {
  background: var(--bg-secondary);
}

.cookies-table tbody tr:last-child td {
  border-bottom: none;
}

/* ===== THANK YOU PAGE ===== */
.thank-you-section {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: calc(80px + var(--space-4xl)) var(--space-xl) var(--space-4xl);
}

.thank-you-content {
  max-width: 500px;
}

.thank-you-icon {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, var(--success), #059669);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-xl);
  font-size: 3rem;
  color: white;
  animation: scaleIn 0.5s ease-out;
}

@keyframes scaleIn {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .hero-container,
  .about-grid,
  .contact-grid {
    grid-template-columns: 1fr;
    gap: var(--space-2xl);
  }
  
  .hero-image-wrapper {
    order: -1;
  }
  
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    padding: var(--space-lg);
    box-shadow: var(--shadow-lg);
  }
  
  .nav-links.active {
    display: flex;
  }
  
  .mobile-menu-btn {
    display: block;
  }
  
  .hero {
    padding: calc(80px + var(--space-2xl)) 0 var(--space-2xl);
    min-height: auto;
  }
  
  .hero-buttons {
    flex-direction: column;
  }
  
  .about-stats {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }
  
  .features-grid,
  .services-grid,
  .testimonials-grid {
    grid-template-columns: 1fr;
  }
  
  .footer-grid {
    grid-template-columns: 1fr;
  }
  
  .footer-bottom {
    flex-direction: column;
    text-align: center;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  section {
    padding: var(--space-3xl) 0;
  }
}

/* ===== ANIMATIONS ===== */
.fade-in {
  opacity: 0;
  transform: translateY(30px);
  transition: all 0.6s ease-out;
}

.fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ===== COOKIE BANNER ===== */
.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-dark);
  color: white;
  padding: var(--space-lg) var(--space-xl);
  z-index: 9999;
  display: none;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
}

.cookie-banner.show {
  display: block;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.cookie-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xl);
  flex-wrap: wrap;
}

.cookie-content p {
  color: rgba(255,255,255,0.8);
  margin: 0;
  flex: 1;
}

.cookie-buttons {
  display: flex;
  gap: var(--space-md);
}

.cookie-btn {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-lg);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.cookie-btn-accept {
  background: var(--primary);
  color: white;
}

.cookie-btn-accept:hover {
  background: var(--primary-dark);
}

.cookie-btn-decline {
  background: transparent;
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
}

.cookie-btn-decline:hover {
  background: rgba(255,255,255,0.1);
}
\`\`\`

**JAVASCRIPT - PREMIUM INTERACTIONS (js/script.js):**
\`\`\`javascript
// Mobile menu toggle
function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  navLinks.classList.toggle('active');
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// Cookie consent
document.addEventListener('DOMContentLoaded', () => {
  const cookieBanner = document.querySelector('.cookie-banner');
  const accepted = localStorage.getItem('cookieConsent');
  
  if (!accepted && cookieBanner) {
    setTimeout(() => cookieBanner.classList.add('show'), 1000);
  }
});

function acceptCookies() {
  localStorage.setItem('cookieConsent', 'accepted');
  document.querySelector('.cookie-banner').classList.remove('show');
}

function declineCookies() {
  localStorage.setItem('cookieConsent', 'declined');
  document.querySelector('.cookie-banner').classList.remove('show');
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
\`\`\`

**📸 IMAGE REQUIREMENTS - CRITICAL:**
1. ALL images MUST use valid URLs that will load correctly
2. Use Pexels URLs provided in the image strategy OR Picsum placeholder images
3. NEVER use broken or local file paths for images
4. EVERY image MUST have loading="lazy" attribute
5. EVERY image MUST have descriptive alt text

**🎯 IMAGE THEME MATCHING - ALL IMAGES MUST FIT THE WEBSITE TOPIC:**
- EVERY image MUST be relevant to the website's industry/theme/topic!
- Examples by industry:
  * Medical/Clinic: doctors, medical equipment, patients, hospital rooms
  * Restaurant/Food: dishes, kitchen, dining area, chefs
  * Auto/Car services: cars, mechanics, garage, car parts
  * Legal/Law: office, courthouse, lawyers, documents
  * Real Estate: houses, apartments, interiors, architecture
  * Construction: buildings, workers, equipment, sites
  * Beauty/Spa: treatments, salon, cosmetics, relaxation
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

**CORRECT IMAGE USAGE:**
\`\`\`html
<img src="https://picsum.photos/800/600?random=1" alt="Description" loading="lazy">
<img src="https://images.pexels.com/photos/XXX/pexels-photo-XXX.jpeg" alt="Description" loading="lazy">
\`\`\`

**WRONG (NEVER DO):**
\`\`\`html
<img src="images/hero.jpg"> <!-- WRONG - local path won't work -->
<img src="/assets/image.png"> <!-- WRONG - absolute local path -->
<img src="hero-bg.jpg"> <!-- WRONG - local file -->
\`\`\`

**CSS BACKGROUND IMAGES:**
\`\`\`css
.hero {
    background-image: url('https://picsum.photos/1920/1080?random=hero');
    background-size: cover;
    background-position: center;
}
\`\`\`

**PAGE CONTENT REQUIREMENTS:**
Each page MUST have UNIQUE, SUBSTANTIAL content:
- index.php: Hero section, 3+ feature blocks, about preview, services preview, testimonials, CTA (minimum 500 words)
- about.php: Company story, mission/vision, team section, values (minimum 400 words)
- services.php: 3-6 detailed service descriptions with benefits (minimum 400 words)
- contact.php: Contact form, address, phone, email, working hours, map placeholder (minimum 200 words)
- thank-you.php: Confirmation message, next steps, links back to site (minimum 100 words)

**📜 PRIVACY POLICY PAGE (privacy.php) - MANDATORY 10+ SECTIONS:**
Privacy Policy MUST contain AT LEAST 10 distinct sections with full legal text:
1. Introduction & General Information
2. Data Controller Contact Information
3. Types of Personal Data Collected
4. Purpose of Data Processing
5. Legal Basis for Processing
6. Data Retention Periods
7. Data Sharing with Third Parties
8. International Data Transfers
9. User Rights (Access, Rectification, Erasure, Portability, etc.)
10. Cookie Policy Reference
11. Security Measures (optional but recommended)
12. Changes to Privacy Policy (optional but recommended)
Each section MUST have a heading (h2/h3) and 2-4 paragraphs of detailed legal text.

**📋 TERMS OF SERVICE PAGE (terms.php) - MANDATORY 14 SECTIONS:**
Terms of Service MUST contain EXACTLY 14 distinct sections with full legal text:
1. Acceptance of Terms
2. Definitions
3. User Eligibility
4. Account Registration and Security
5. Permitted Use of Services
6. Prohibited Activities
7. Intellectual Property Rights
8. User-Generated Content
9. Third-Party Links and Services
10. Disclaimers and Limitation of Liability
11. Indemnification
12. Termination
13. Governing Law and Dispute Resolution
14. Contact Information and Notices
Each section MUST have a heading (h2/h3) and 2-4 paragraphs of detailed legal text.

**🍪 COOKIE POLICY PAGE (cookie-policy.php) - MANDATORY WITH COOKIES TABLE:**
Cookie Policy MUST contain:
1. Introduction explaining what cookies are
2. Why we use cookies
3. Types of cookies we use (with explanations)
4. **MANDATORY COOKIES TABLE** with the following columns:
   - Cookie Name
   - Provider
   - Purpose
   - Expiry
   - Type (Essential/Analytics/Marketing/Functional)
   
Example table structure:
\`\`\`html
<table class="cookies-table">
  <thead>
    <tr>
      <th>Cookie Name</th>
      <th>Provider</th>
      <th>Purpose</th>
      <th>Expiry</th>
      <th>Type</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>cookieConsent</td>
      <td><?php echo SITE_NAME; ?></td>
      <td>Stores user's cookie consent preference</td>
      <td>1 year</td>
      <td>Essential</td>
    </tr>
    <!-- Add 5-10 more cookie entries -->
  </tbody>
</table>
\`\`\`
5. How to manage/disable cookies
6. Contact information for cookie-related inquiries
The table MUST include AT LEAST 6-10 different cookies commonly used on websites.

**🌍 LANGUAGE COMPLIANCE - ABSOLUTELY MANDATORY:**
The website MUST be generated in the EXACT language specified in the request. This is NON-NEGOTIABLE:

1. **ALL text content** MUST be in the specified language:
   - Headings, paragraphs, buttons, links, navigation
   - Form labels, placeholders, error messages
   - Footer text, copyright notices
   - Cookie banner text
   - Alt text for images
   - Meta descriptions and page titles

2. **Language code mapping** (use correct language for each code):
   - EN = English (US/UK)
   - DE = German (Deutsch)
   - FR = French (Français)
   - ES = Spanish (Español)
   - IT = Italian (Italiano)
   - PL = Polish (Polski)
   - NL = Dutch (Nederlands)
   - UK/UA = Ukrainian (Українська)
   - PT = Portuguese (Português)
   - CS/CZ = Czech (Čeština)
   - RU = Russian (Русский)
   - TR = Turkish (Türkçe)

3. **NEVER mix languages** - If the site is in German, ALL text must be German

**NAVIGATION LINKS - ABSOLUTELY CRITICAL:**
- ALL navigation links MUST use RELATIVE paths: href="about.php" NOT href="/about"
- EVERY link MUST use .php extension
- Header navigation MUST include links to ALL pages
- Footer MUST include links to key pages

**DESIGN PHILOSOPHY - AGENCY-QUALITY UI:**
- Create STUNNING, POLISHED websites that look expensive
- Use the premium CSS system with animations and transitions
- Apply glass morphism, gradients, and modern effects
- Ensure perfect spacing and visual hierarchy

**🍪 MANDATORY COOKIE SYSTEM:**
Every website MUST include a REAL, FUNCTIONAL cookie consent system that ACTUALLY STORES user choices using localStorage.

**🚫 NUMBERS PROHIBITION - ABSOLUTELY CRITICAL, NON-NEGOTIABLE:**
NEVER include ANY numerical data anywhere on the website. This is a STRICT requirement:

**FORBIDDEN (NEVER USE):**
- Prices, costs, monetary figures ($99, €50, £100, ₴500, etc.)
- Statistics, percentages (95%, 100+, 50% off, etc.)
- Years of experience ("10 years", "Since 2010", etc.)
- Client/project counts ("500+ clients", "1000 projects", etc.)
- Team size numbers ("50 experts", "Team of 20", etc.)
- Ratings and scores ("4.9/5", "5 stars", etc.)
- Time frames with numbers ("24/7", "in 48 hours", etc.)
- Numerical guarantees ("100% satisfaction", "30-day guarantee", etc.)
- Square meters, distances, capacities
- Any forecasts, projections, or numerical predictions
- Countdown timers or numerical deadlines

**ALLOWED ALTERNATIVES (USE THESE INSTEAD):**
- "Contact us for pricing" instead of prices
- "Years of experience" instead of "10 years"
- "Hundreds of satisfied clients" instead of "500+ clients"
- "Our expert team" instead of "Team of 50"
- "Top-rated service" instead of "4.9/5 rating"
- "Fast delivery" instead of "in 24 hours"
- "Satisfaction guaranteed" instead of "100% guarantee"
- "Always available" instead of "24/7"
- "Request a quote" instead of any price
- "Proven track record" instead of statistics

**THE ONLY ALLOWED NUMBERS:**
- Phone numbers (required for contact)
- Postal codes in addresses (required for location)
- Years in copyright footer (e.g., "© 2024")

**THIS RULE IS NON-NEGOTIABLE - ANY NUMERICAL DATA OTHER THAN CONTACT INFO WILL MAKE THE WEBSITE INVALID!**

**⚠️ MANDATORY DISCLAIMER - ABSOLUTELY CRITICAL, NON-NEGOTIABLE:**
Every PHP website MUST include a disclaimer section adapted to the website's theme. This is REQUIRED for Google Ads compliance:

**DISCLAIMER REQUIREMENTS:**
1. Add the disclaimer in includes/footer.php, ABOVE the copyright section
2. The disclaimer MUST be styled to MATCH THE WEBSITE'S DESIGN STYLE:
   - Use colors that complement the site's color palette (can be accent color, muted tone, or contrasting block)
   - Match the typography and spacing of the site
   - Make it visible but harmonious with overall design
   - Can use borders, subtle backgrounds, or other styling that fits the site aesthetic
3. The disclaimer text MUST be ADAPTED to match the website's theme/industry:
   - Keep the core meaning: "content is for general information/education only, not professional advice"
   - Adapt terminology to the specific industry (e.g., "financial advice" for finance, "medical advice" for health, "legal advice" for law, etc.)
   - Always include: not professional advice, consult qualified experts, involves risk, we don't sell [relevant products]

**📞 PHONE NUMBERS - MANDATORY REQUIREMENTS:**
All phone numbers MUST be:
1. **REALISTIC and RANDOM for the specified country** - Generate unique, realistic phone numbers:
   - USA/Canada: +1 (212) 555-0147, +1 (415) 637-8294
   - UK: +44 20 7839 5471, +44 7842 156 923
   - Germany: +49 30 2897 6543, +49 89 4521 7890
   - France: +33 1 42 68 53 00, +33 4 93 45 67 89
   - Italy: +39 06 8745 6321, +39 02 7654 3210
   - Spain: +34 912 456 789, +34 932 876 543
   - Poland: +48 22 456 78 90, +48 12 345 67 89
   - Netherlands: +31 20 794 5682, +31 10 456 7890
   - Ukraine: +380 44 456 7890, +380 67 123 4567
   - Russia: +7 495 123 4567, +7 812 456 7890
2. **CLICKABLE with tel: links**: <a href="tel:+14155550147">+1 (415) 555-0147</a>
3. **NEVER use fake numbers** like 1234567, 0000000, or placeholder XXX

**🏠 ADDRESSES - MANDATORY REQUIREMENTS:**
All physical addresses MUST be realistic and from the specified country/city.

**📧 EMAIL ADDRESSES - MUST MATCH SITE DOMAIN:**
- Email MUST use the site's domain name, NOT generic placeholders
- Format: info@<sitename>.com, contact@<sitename>.com
- Extract sitename from business name (lowercase, no spaces)
- Examples:
  * "Green Garden Services" → info@greengarden.com
  * "Auto Pro Center" → contact@autoprocenter.com
- MUST be clickable: <a href="mailto:info@sitename.com">info@sitename.com</a>
- NEVER use generic emails like info@company.com or test@example.com

**🙏 THANK YOU PAGE - MANDATORY FOR ALL WEBSITES:**
Every PHP website MUST include a thank-you.php page that users see after submitting ANY form:

1. **Create thank-you.php** with:
   - Same header/navigation as other pages (include 'includes/header.php')
   - Hero section with success checkmark icon
   - Thank you heading (in site language)
   - Friendly message explaining next steps
   - Contact info for urgent matters
   - Button to return to homepage: <a href="index.php">Return to Home</a>
   - Same footer as other pages (include 'includes/footer.php')

**CONTENT LENGTH:**
- Total website content: Minimum 2000 words across all pages
- Each main page (index, about, services): Minimum 400 words each
- Rich, detailed descriptions for all sections

**OUTPUT FORMAT:**
Return ONLY a series of file definitions in this format:
--- FILE: path/filename.ext ---
content here
--- END FILE ---

NEVER add explanations outside file blocks. Generate COMPLETE files with full content.
REMEMBER: MINIMUM 6 SEPARATE PHP PAGE FILES ARE REQUIRED!
`.trim();

const IMAGE_STRATEGY_BASIC = `
IMAGE STRATEGY: Unsplash (Reliable)
- Use https://images.unsplash.com/photo-{id}?w=WIDTH&h=HEIGHT&fit=crop for all images
- Example: <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop" alt="Description">
- Change the photo ID for variety. Use these IDs:
  - Business: 1497366216548-37526070297c, 1560179707-f14e90ef3623, 1454165804606-c3d57bc86b40
  - Office: 1497366811353-6870744d04b2, 1497366754146-60ec025e3a30
  - Team: 1522202176988-66273c2fd55f, 1552664730-d307ca884978
  - Portrait: 1507003211169-0a1dd7228f2d, 1438761681033-6461ffad8d80

**🏢 BRAND LOGOS - USE REAL LOGOS, NOT PLACEHOLDERS:**
For partner logos, client logos, certification badges, or any brand logos - ALWAYS use real logos from CDN services:

**Logo CDN Sources (use these URLs):**
- https://logo.clearbit.com/[company-domain] - e.g., https://logo.clearbit.com/google.com
- https://cdn.brandfetch.io/[company-domain]/w/400/h/400 - e.g., https://cdn.brandfetch.io/apple.com/w/400/h/400

**Industry-Specific Logo Examples:**
- Tech/Software: google.com, microsoft.com, aws.amazon.com, github.com, stripe.com, slack.com
- E-commerce/Payments: visa.com, mastercard.com, paypal.com, shopify.com, amazon.com
- Shipping/Logistics: dhl.com, fedex.com, ups.com, dpd.com

**Usage in PHP:**
<img src="https://logo.clearbit.com/stripe.com" alt="Stripe" class="partner-logo" loading="lazy">
<img src="https://logo.clearbit.com/visa.com" alt="Visa" class="payment-logo" loading="lazy">

**RULES:**
- NEVER use placeholder logos or generic icons for brand logos
- Choose logos that make sense for the website's industry
`;

async function fetchPexelsPhotos(query: string, count = 5): Promise<string[]> {
  const pexelsKey = Deno.env.get("PEXELS_API_KEY");
  if (!pexelsKey) return [];
  
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: pexelsKey } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.photos || []).map((p: any) => p.src?.large || p.src?.original);
  } catch {
    return [];
  }
}

async function extractKeywordsAI(prompt: string): Promise<string[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return extractKeywordsFallback(prompt);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Extract 3-5 keywords from the user's website description that would be good search terms for finding relevant stock photos. Return ONLY a JSON array of strings, nothing else."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
      }),
    });

    if (!resp.ok) return extractKeywordsFallback(prompt);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const keywords = JSON.parse(content);
    return Array.isArray(keywords) ? keywords : extractKeywordsFallback(prompt);
  } catch {
    return extractKeywordsFallback(prompt);
  }
}

function extractKeywordsFallback(prompt: string): string[] {
  const commonWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "need", "want", "сайт", "website", "page", "create", "make", "build", "design"]);
  
  const words = prompt.toLowerCase()
    .replace(/[^a-zA-Zа-яА-ЯіІїЇєЄ\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.has(w));
  
  return [...new Set(words)].slice(0, 5);
}

async function buildPexelsImageStrategy(prompt: string): Promise<string> {
  const keywords = await extractKeywordsAI(prompt);
  console.log("Extracted keywords for Pexels:", keywords);
  
  const allUrls: string[] = [];
  for (const keyword of keywords) {
    const urls = await fetchPexelsPhotos(keyword, 3);
    allUrls.push(...urls);
  }
  
  if (allUrls.length === 0) {
    return IMAGE_STRATEGY_BASIC;
  }
  
  return `
IMAGE STRATEGY: Pexels (High Quality)
Use these SPECIFIC image URLs throughout the website:
${allUrls.map((url, i) => `- Image ${i + 1}: ${url}`).join("\n")}

For additional images beyond these, use: https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop (change photo ID for variety)
`;
}

const IMAGE_CSS = `
/* Essential image CSS - include in style.css */
img {
  max-width: 100%;
  height: auto;
  display: block;
}

.hero-image {
  width: 100%;
  height: 60vh;
  object-fit: cover;
}

.card-image {
  width: 100%;
  height: 250px;
  object-fit: cover;
  border-radius: 8px;
}

.feature-icon {
  width: 80px;
  height: 80px;
  object-fit: contain;
}
`;

// Token pricing per model (input/output per 1M tokens)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "google/gemini-2.5-pro": { input: 2.5, output: 15 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
};

interface GeneratedFile {
  path: string;
  content: string;
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

function calculateCost(usage: TokenUsage, model: string): number {
  const pricing = TOKEN_PRICING[model] || TOKEN_PRICING["gpt-4o-mini"];
  const inputCost = ((usage.prompt_tokens || 0) / 1_000_000) * pricing.input;
  const outputCost = ((usage.completion_tokens || 0) / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

interface GenerationResult {
  success: boolean;
  files?: GeneratedFile[];
  refinedPrompt?: string;
  totalFiles?: number;
  fileList?: string[];
  error?: string;
  totalCost?: number;
  specificModel?: string;
}

function cleanFileContent(content: string): string {
  return content
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .trim();
}

function parseFilesFromModelText(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const regex = /---\s*FILE:\s*(.+?)\s*---\n([\s\S]*?)(?=---\s*(?:FILE:|END FILE)|\s*$)/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const path = match[1].trim();
    const content = cleanFileContent(match[2]);
    if (path && content) {
      files.push({ path, content });
    }
  }

  return files;
}

async function runGeneration({
  prompt,
  language,
  aiModel,
  layoutStyle,
  imageSource = "basic",
  siteName,
  colorScheme: userColorScheme,
}: {
  prompt: string;
  language?: string;
  aiModel: "junior" | "senior";
  layoutStyle?: string;
  imageSource?: "basic" | "ai";
  siteName?: string;
  colorScheme?: string | null;
}): Promise<GenerationResult> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!lovableApiKey && !openaiKey) {
    return { success: false, error: "No API key configured (LOVABLE_API_KEY or OPENAI_API_KEY)" };
  }

  // Use Lovable AI for better quality generation
  const useLovableAI = !!lovableApiKey;
  
  // Determine which model to use
  const refineModel = useLovableAI ? "google/gemini-2.5-flash" : "gpt-4o-mini";
  const generateModel = useLovableAI 
    ? (aiModel === "senior" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash")
    : (aiModel === "senior" ? "gpt-4o" : "gpt-4o-mini");

  console.log(`PHP Generation using: Refine=${refineModel}, Generate=${generateModel}, Lovable AI=${useLovableAI}`);

  // 1. Refine the prompt
  const languageInstruction = language
    ? `\n\nIMPORTANT: The website MUST be in ${language}. All text, buttons, navigation, and content should be in this language.`
    : "";

  // Add site name instruction if provided
  const siteNameInstruction = siteName
    ? `\n\nCRITICAL SITE NAME REQUIREMENT: The website/business/brand name MUST be "${siteName}". Use this EXACT name in the logo, header, footer, page titles, meta tags, copyright, and all references to the business. Do NOT invent a different name.`
    : "";

  // API call helper for Lovable AI or OpenAI
  const makeAPICall = async (
    systemContent: string,
    userContent: string,
    maxTokens: number,
    model: string,
    opts?: { timeoutMs?: number; temperature?: number }
  ) => {
    const timeoutMs = opts?.timeoutMs ?? 120_000;
    const temperature = opts?.temperature ?? 0.7;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = useLovableAI
        ? "https://ai.gateway.lovable.dev/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

      const apiKey = useLovableAI ? lovableApiKey : openaiKey;
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_tokens: maxTokens,
      };

      // OpenAI supports temperature; gateway is OpenAI-compatible, so this is safe here.
      if (!useLovableAI) body.temperature = temperature;
      else body.temperature = temperature;

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      return resp;
    } finally {
      clearTimeout(timeout);
    }
  };

  const refineResponse = await makeAPICall(
    SYSTEM_PROMPT + languageInstruction + siteNameInstruction,
    prompt + siteNameInstruction,
    1000,
    refineModel,
    { timeoutMs: 90_000, temperature: 0.3 }
  );

  if (!refineResponse.ok) {
    const errText = await refineResponse.text();
    console.error("Refine API error:", errText);
    return { success: false, error: `Prompt refinement failed: ${errText}` };
  }

  // Defensive JSON parsing (prevents "Unexpected end of JSON input" from leaving jobs stuck)
  let refineData: any;
  try {
    const raw = await refineResponse.text();
    refineData = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Refine API JSON parse error:", e);
    return { success: false, error: "Prompt refinement failed: invalid JSON response" };
  }

  const refinedPrompt = refineData?.choices?.[0]?.message?.content || prompt;
  const refineUsage = refineData?.usage || {};
  const refineCost = calculateCost(refineUsage, refineModel);

  console.log(
    `💰 Token usage for ${refineModel}: ${refineUsage.prompt_tokens || 0} in, ${refineUsage.completion_tokens || 0} out = $${refineCost.toFixed(6)}`
  );
  console.log("Refined prompt:", refinedPrompt.substring(0, 200) + "...");

  // 2. Select layout variation with stronger enforcement
  let layoutDescription = "";
  let selectedLayoutName = "";
  if (layoutStyle) {
    const selectedLayout = LAYOUT_VARIATIONS.find(l => l.id === layoutStyle);
    if (selectedLayout) {
      selectedLayoutName = selectedLayout.name;
      layoutDescription = `
⚠️⚠️⚠️ MANDATORY LAYOUT STRUCTURE - NON-NEGOTIABLE! ⚠️⚠️⚠️
LAYOUT STYLE: "${selectedLayout.name}"

${selectedLayout.description}

⚠️ CRITICAL LAYOUT RULES - YOU MUST FOLLOW EXACTLY:
- Hero section MUST match the layout description above!
- Card grids MUST use the specified arrangement!
- Section layouts MUST follow the style guidelines!
- IF YOU IGNORE THIS LAYOUT = GENERATION FAILURE!
`;
    }
  } else {
    // Random layout
    const randomLayout = LAYOUT_VARIATIONS[Math.floor(Math.random() * LAYOUT_VARIATIONS.length)];
    selectedLayoutName = randomLayout.name;
    layoutDescription = `
⚠️⚠️⚠️ MANDATORY LAYOUT STRUCTURE - NON-NEGOTIABLE! ⚠️⚠️⚠️
LAYOUT STYLE: "${randomLayout.name}"

${randomLayout.description}

⚠️ CRITICAL LAYOUT RULES - YOU MUST FOLLOW EXACTLY:
- Hero section MUST match the layout description above!
- Card grids MUST use the specified arrangement!
- Section layouts MUST follow the style guidelines!
- IF YOU IGNORE THIS LAYOUT = GENERATION FAILURE!
`;
  }

  // 2b. Build mandatory color palette section for AI prompt
  let mandatoryColorSection = "";
  if (userColorScheme && userColorScheme !== "random") {
    const schemeColors = getBrandColors(userColorScheme);
    if (schemeColors) {
      mandatoryColorSection = `
⚠️⚠️⚠️ MANDATORY COLOR PALETTE - YOU MUST USE THESE EXACT COLORS EVERYWHERE! ⚠️⚠️⚠️

Color Scheme: "${userColorScheme}"
PRIMARY COLOR: ${schemeColors.primary} (main brand color)
ACCENT COLOR: ${schemeColors.accent} (highlights and CTAs)

═══════════════════════════════════════════════════════════════════
🔴 BUTTONS - CRITICAL (MUST USE PRIMARY/ACCENT COLORS):
═══════════════════════════════════════════════════════════════════
- ALL primary buttons: background-color: ${schemeColors.primary}; color: #fff;
- ALL secondary buttons: border: 2px solid ${schemeColors.primary}; color: ${schemeColors.primary};
- ALL CTA buttons (Call-to-Action): background-color: ${schemeColors.accent}; color: #fff;
- Button hover states: use darker shade of ${schemeColors.primary} or ${schemeColors.accent}
- NEVER use default blue, green, or gray buttons!

═══════════════════════════════════════════════════════════════════
🔴 FOOTER - CRITICAL (MUST APPLY COLOR SCHEME):
═══════════════════════════════════════════════════════════════════
- Footer background: use dark shade based on ${schemeColors.primary} (e.g., darken by 30-40%)
- Footer links on hover: color: ${schemeColors.accent}
- Footer social icons: color: ${schemeColors.accent}
- Footer headings: slightly lighter than footer text
- Copyright bar: subtle use of ${schemeColors.primary} as accent line or background
- Newsletter button in footer: background-color: ${schemeColors.accent}

═══════════════════════════════════════════════════════════════════
🔴 OTHER ELEMENTS (MUST USE COLOR SCHEME):
═══════════════════════════════════════════════════════════════════
- Links: color: ${schemeColors.primary}; hover: ${schemeColors.accent}
- Section accents/borders: ${schemeColors.accent}
- Active nav items: ${schemeColors.primary}
- Card hover borders: ${schemeColors.primary}
- Icons and badges: ${schemeColors.accent}
- Form focus states: border-color: ${schemeColors.primary}

⛔ FORBIDDEN:
- DO NOT use green (#10b981, #047857, #38a169) unless that's the selected scheme!
- DO NOT use default Bootstrap/Tailwind colors!
- DO NOT generate random colors - USE ONLY THESE HEX CODES!
- DO NOT leave any buttons without the color scheme applied!
- DO NOT leave the footer without brand colors!

`;
      console.log(`🎨 PHP: Injecting mandatory color scheme "${userColorScheme}" into AI prompt: primary=${schemeColors.primary}, accent=${schemeColors.accent}`);
    }
  }

  // 3. Build image strategy
  let imageStrategy = IMAGE_STRATEGY_BASIC;
  if (imageSource === "ai") {
    imageStrategy = await buildPexelsImageStrategy(prompt);
  }

  // CRITICAL: Fixed required file set - guarantees these 14 files exist in every generation
  const requiredPaths = [
    "includes/config.php",
    "includes/header.php",
    "includes/footer.php",
    "index.php",
    "about.php",
    "services.php",         // Added
    "contact.php",
    "form-handler.php",
    "thank-you.php",
    "privacy.php",
    "terms.php",
    "cookie-policy.php",    // Added
    "css/style.css",
    "js/script.js",
  ];

  // Minimum content thresholds per file type (bytes) to detect "empty" pages
  const MIN_CONTENT_LENGTH: Record<string, number> = {
    "includes/config.php": 100,
    "includes/header.php": 300,
    "includes/footer.php": 200,
    "index.php": 800,
    "about.php": 600,
    "services.php": 600,
    "contact.php": 500,
    "form-handler.php": 100,
    "thank-you.php": 200,
    "privacy.php": 1000,
    "terms.php": 1000,
    "cookie-policy.php": 800,
    "css/style.css": 500,
    "js/script.js": 50,
  };

  const validateFiles = (files: GeneratedFile[]) => {
    const paths = new Set(files.map((f) => f.path));
    const missing = requiredPaths.filter((p) => !paths.has(p));
    // Guard against "nothingburger" files: if the file exists but is extremely short, treat as invalid.
    const tooShort = files
      .filter((f) => requiredPaths.includes(f.path))
      .filter((f) => {
        const threshold = MIN_CONTENT_LENGTH[f.path] || 50;
        return f.content.trim().length < threshold;
      })
      .map((f) => f.path);

    return { missing, tooShort };
  };

  const generateOnce = async (opts: { strictFormat: boolean; timeoutMs?: number }) => {
    // Timeout per individual model attempt - PHP needs longer due to complex multi-file output
    // Increased to 210s (3.5 min) for improved prompts that are larger and more complex
    const perModelTimeoutMs = opts.timeoutMs ?? 210_000; // 3.5 minutes per model

    const strictFormatBlock = opts.strictFormat
      ? `\n\nSTRICT OUTPUT FORMAT (MANDATORY):\n- Output ONLY file blocks in this exact format. No commentary, no markdown headings.\n\n--- FILE: includes/config.php ---\n<file contents>\n--- END FILE ---\n\n--- FILE: includes/header.php ---\n<file contents>\n--- END FILE ---\n\n(Repeat for every file.)\n\nIf you cannot comply, output nothing.`
      : "";

    const systemContent = PHP_GENERATION_PROMPT + mandatoryColorSection + layoutDescription + "\n\n" + imageStrategy + "\n\n" + IMAGE_CSS;
    // Simplified user prompt for faster, more reliable generation
    const userContent = `Create a PHP website based on this brief:

${refinedPrompt}

REQUIRED FILES (generate ALL 14):
1. includes/config.php - Site constants (SITE_NAME, SITE_EMAIL, SITE_PHONE, SITE_ADDRESS)
2. includes/header.php - HTML head + navigation
3. includes/footer.php - Footer with links
4. index.php - Homepage with hero, features, CTA
5. about.php - About page
6. services.php - Services/Products page
7. contact.php - Contact form (action="form-handler.php")
8. form-handler.php - Form processor → redirect to thank-you.php
9. thank-you.php - Thank you page
10. privacy.php - Privacy Policy (10+ sections)
11. terms.php - Terms of Service (14 sections)
12. cookie-policy.php - Cookie Policy with cookies table
13. css/style.css - Complete responsive CSS (400+ lines)
14. js/script.js - Mobile menu JS

FORMAT: Use --- FILE: path --- and --- END FILE --- markers.
Generate complete, working code. No placeholders.${strictFormatBlock}`;

    try {
      let generateResponse: Response;
      const startTime = Date.now();
      
      // Check if prompt is very large (improved prompts can be 10k+ chars)
      // For large prompts, use Flash first (faster) then Pro as fallback
      const isLargePrompt = refinedPrompt.length > 5000;
      const modelsToTry = useLovableAI 
        ? (isLargePrompt 
            ? ["google/gemini-2.5-flash", "google/gemini-2.5-pro"] // Flash first for large prompts
            : ["google/gemini-2.5-pro", "google/gemini-2.5-flash"])
        : [generateModel];
      
      console.log(`📝 Prompt size: ${refinedPrompt.length} chars, using model order: ${modelsToTry.join(" -> ")}`);
      
      let lastError = "";
      let usedModel = generateModel;
      
      for (const modelToUse of modelsToTry) {
        console.log(`🚀 Trying generation with ${modelToUse} (timeout: ${perModelTimeoutMs / 1000}s)...`);
        usedModel = modelToUse;
        
        // Create a fresh AbortController for each model attempt
        const modelController = new AbortController();
        const modelTimeoutId = setTimeout(() => {
          console.error(`⏰ ${modelToUse} timeout after ${perModelTimeoutMs / 1000}s`);
          modelController.abort();
        }, perModelTimeoutMs);
        
        try {
          if (useLovableAI) {
            generateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: modelToUse,
                messages: [
                  { role: "system", content: systemContent },
                  { role: "user", content: userContent },
                ],
                max_tokens: 65536,
              }),
              signal: modelController.signal,
            });
          } else {
            generateResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: modelToUse,
                messages: [
                  { role: "system", content: systemContent },
                  { role: "user", content: userContent },
                ],
                max_tokens: 16000,
                temperature: opts.strictFormat ? 0.4 : 0.6,
              }),
              signal: modelController.signal,
            });
          }

          if (!generateResponse.ok) {
            const errText = await generateResponse.text();
            console.error(`❌ ${modelToUse} error:`, errText.substring(0, 200));
            lastError = errText;
            continue;
          }
          
          const raw = await generateResponse.text();
          console.log(`📥 Raw response length from ${modelToUse}: ${raw.length}`);
          
          // Check if response is too short
          if (raw.length < 5000) {
            console.error(`❌ Response too short from ${modelToUse}: ${raw.length} chars`);
            lastError = "Response too short";
            continue;
          }
          
          let generateData: any;
          try {
            generateData = raw ? JSON.parse(raw) : null;
          } catch (e) {
            console.error(`❌ ${modelToUse} JSON parse error`);
            lastError = "Invalid JSON response";
            continue;
          }

          const generatedText = generateData?.choices?.[0]?.message?.content || "";
          
          if (generatedText.length < 3000) {
            console.error(`❌ Content too short from ${modelToUse}: ${generatedText.length} chars`);
            lastError = "Generated content too short";
            continue;
          }
          
          const genUsage = generateData?.usage || {};
          const generateCost = calculateCost(genUsage, modelToUse);

          console.log(`✅ Generation successful with ${modelToUse} in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          console.log(
            `💰 Token usage for ${modelToUse}: ${genUsage.prompt_tokens || 0} in, ${genUsage.completion_tokens || 0} out = $${generateCost.toFixed(6)}`
          );

          // Parse
          const files = parseFilesFromModelText(generatedText);
          console.log(`Parsed ${files.length} files from generation`);

          clearTimeout(modelTimeoutId);
          return { ok: true as const, files, generateCost, modelUsed: modelToUse };
        } catch (fetchErr) {
          clearTimeout(modelTimeoutId);
          console.error(`❌ ${modelToUse} fetch error:`, fetchErr);
          lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          continue;
        }
      }
      return { ok: false as const, error: `All models failed. Last error: ${lastError}` };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.error(`Generation aborted due to timeout`);
        return { ok: false as const, error: `Generation timed out` };
      }
      console.error("Generate unexpected error:", err);
      return { ok: false as const, error: `Generation failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  };

  // 4. Generate the PHP website (retry on JSON errors or incomplete files)
  let first = await generateOnce({ strictFormat: false });

  // Auto-retry once on invalid JSON error
  if (!first.ok && first.error?.includes("invalid JSON")) {
    console.warn("Retrying PHP generation due to invalid JSON response...");
    first = await generateOnce({ strictFormat: false });
  }

  if (!first.ok) return { success: false, error: first.error };

  let files = first.files;
  let generateCost = first.generateCost;

  // If model returned something parseable but incomplete/empty-ish, retry once with stricter format.
  const v1 = validateFiles(files);
  let retryAttempted = false;
  let retryError: string | null = null;
  
  if (files.length === 0 || v1.missing.length > 0 || v1.tooShort.length > 0) {
    console.warn(
      `PHP generation invalid on attempt #1. Files: ${files.length}, Missing: ${v1.missing.join(", ")}; Too short: ${v1.tooShort.join(", ")}`
    );
    retryAttempted = true;

    try {
      // Retry with reasonable timeout (90s) and strict format
      const second = await generateOnce({ strictFormat: true, timeoutMs: 90_000 });
      if (second.ok) {
        const v2 = validateFiles(second.files);
        console.log(`Retry attempt result: ${second.files.length} files, Missing: ${v2.missing.join(", ")}, Too short: ${v2.tooShort.join(", ")}`);
        
        // Use second result if it's better (more files or fewer issues)
        if (second.files.length > files.length || 
            (v2.missing.length < v1.missing.length) || 
            (v2.missing.length === 0 && v2.tooShort.length === 0)) {
          files = second.files;
          generateCost = second.generateCost;
          console.log(`Using retry result: ${files.length} files`);
        } else {
          console.log(`Keeping first result as it's not worse: ${files.length} files`);
        }
      } else {
        retryError = second.error || "Retry failed";
        console.error(`Retry failed: ${retryError}`);
      }
    } catch (retryErr) {
      retryError = retryErr instanceof Error ? retryErr.message : "Retry exception";
      console.error(`Retry exception: ${retryError}`);
    }
  }

  // Graceful degradation: accept results with minor issues (reduced requirements for speed)
  const finalValidation = validateFiles(files);
  const criticalFiles = ["index.php", "includes/header.php", "includes/footer.php"];
  const missingCritical = finalValidation.missing.filter(f => criticalFiles.includes(f));
  
  const totalCost = refineCost + generateCost;
  console.log(
    `Generation costs: Refine=$${refineCost.toFixed(4)}, Generate=$${generateCost.toFixed(4)}, Total=$${totalCost.toFixed(4)}`
  );

  if (files.length === 0) {
    return { success: false, error: `Failed to parse generated files${retryAttempted ? ` (retry also failed: ${retryError})` : ""}` };
  }

  // If we have 5+ files and no critical files missing, accept with warning (relaxed for speed)
  if (files.length >= 5 && missingCritical.length === 0) {
    if (finalValidation.missing.length > 0 || finalValidation.tooShort.length > 0) {
      console.warn(`⚠️ Accepting partial result: ${files.length} files`);
      console.warn(`  - Missing non-critical: ${finalValidation.missing.join(", ") || "none"}`);
      console.warn(`  - Too short: ${finalValidation.tooShort.join(", ") || "none"}`);
    }
    // Continue with partial result
  } else if (missingCritical.length > 0 || files.length < 4) {
    // Only fail if critical files are missing or very few files generated (relaxed threshold)
    console.error(`Final validation failed after ${retryAttempted ? "retry" : "first attempt"}:`);
    console.error(`- Files generated: ${files.length} (${files.map(f => f.path).join(", ")})`);
    console.error(`- Missing critical: ${missingCritical.join(", ")}`);
    console.error(`- Missing all: ${finalValidation.missing.join(", ")}`);
    console.error(`- Too short: ${finalValidation.tooShort.join(", ")}`);
    
    return {
      success: false,
      error: `Generation incomplete. Missing critical files: ${missingCritical.join(", ") || "none"}. Total files: ${files.length}.`,
    };
  }
  const normalizePaths = (files: GeneratedFile[]) =>
    files.map((f) => ({ ...f, path: f.path.replace(/^\/+/, "").trim() }));

  // Ensure contact form flow works (contact.php -> form-handler.php -> thank-you.php)
  const ensureContactFlow = (files: GeneratedFile[]): GeneratedFile[] => {
    const next = [...files];

    const findIndex = (path: string) => next.findIndex((f) => f.path === path);
    const upsert = (path: string, content: string) => {
      const idx = findIndex(path);
      if (idx >= 0) next[idx] = { path, content };
      else next.push({ path, content });
    };

    const contactIdx = findIndex("contact.php");
    if (contactIdx >= 0) {
      let c = next[contactIdx].content;

      if (/<form\b/i.test(c)) {
        // enforce method="POST"
        if (!/method\s*=\s*"post"/i.test(c)) {
          if (/method\s*=\s*"[^"]*"/i.test(c)) c = c.replace(/method\s*=\s*"[^"]*"/i, 'method="POST"');
          else c = c.replace(/<form\b/i, '<form method="POST"');
        }

        // enforce action="form-handler.php"
        if (!/action\s*=\s*"form-handler\.php"/i.test(c)) {
          if (/action\s*=\s*"[^"]*"/i.test(c)) c = c.replace(/action\s*=\s*"[^"]*"/i, 'action="form-handler.php"');
          else c = c.replace(/<form\b/i, '<form action="form-handler.php"');
        }
      }

      next[contactIdx] = { ...next[contactIdx], content: c };
    }

    // Ensure handler exists and redirects reliably
    if (findIndex("form-handler.php") === -1) {
      upsert(
        "form-handler.php",
        `<?php\nif ($_SERVER['REQUEST_METHOD'] === 'POST') {\n  $name = htmlspecialchars(trim($_POST['name'] ?? ''));\n  $email = filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);\n  $phone = htmlspecialchars(trim($_POST['phone'] ?? ''));\n  $subject = htmlspecialchars(trim($_POST['subject'] ?? ''));\n  $message = htmlspecialchars(trim($_POST['message'] ?? ''));\n\n  $isValid = !empty($name) && filter_var($email, FILTER_VALIDATE_EMAIL) && !empty($subject) && !empty($message);\n\n  if ($isValid) {\n    header('Location: thank-you.php');\n    exit;\n  }\n\n  header('Location: contact.php?error=1');\n  exit;\n}\n\nheader('Location: contact.php');\nexit;\n?>`
      );
    }

    // Ensure thank-you exists (some generations forget it)
    if (findIndex("thank-you.php") === -1) {
      upsert(
        "thank-you.php",
        `<?php\n$page_title = 'Thank You';\ninclude 'includes/header.php';\n?>\n\n<section class="page-hero">\n  <div class="container">\n    <h1>Thank you!</h1>\n    <p>Your message has been received. We'll get back to you shortly.</p>\n    <a class="btn" href="index.php">Back to Home</a>\n  </div>\n</section>\n\n<?php include 'includes/footer.php'; ?>`
      );
    }

    return next;
  };

  // Ensure cookie banner exists
  const ensureCookieBanner = (files: GeneratedFile[]): GeneratedFile[] => {
    const hasCookieJs = files.some((f) => f.path.includes("cookie"));

    if (!hasCookieJs) {
      files.push({
        path: "js/cookie-banner.js",
        content: `// Cookie Consent Banner\ndocument.addEventListener('DOMContentLoaded', function() {\n  const cookieConsent = localStorage.getItem('cookieConsent');\n  if (!cookieConsent) {\n    showCookieBanner();\n  }\n});\n\nfunction showCookieBanner() {\n  const banner = document.createElement('div');\n  banner.id = 'cookie-banner';\n  banner.innerHTML = \`\n    <div style="position: fixed; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.9); color: white; padding: 1rem; z-index: 9999; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">\n      <p style="margin: 0; flex: 1;">We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.</p>\n      <div style="display: flex; gap: 0.5rem;">\n        <button onclick="acceptCookies()" style="background: #4CAF50; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;">Accept</button>\n        <button onclick="declineCookies()" style="background: #666; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;">Decline</button>\n      </div>\n    </div>\n  \`;\n  document.body.appendChild(banner);\n}\n\nfunction acceptCookies() {\n  localStorage.setItem('cookieConsent', 'accepted');\n  document.getElementById('cookie-banner')?.remove();\n}\n\nfunction declineCookies() {\n  localStorage.setItem('cookieConsent', 'declined');\n  document.getElementById('cookie-banner')?.remove();\n}\n`,
      });
    }

    // Ensure all PHP files include cookie banner script
    return files.map((file) => {
      if (!file.path.endsWith(".php")) return file;

      let content = file.content;
      const hasCookieScript =
        content.includes("cookie-banner.js") ||
        content.includes("cookie-banner") ||
        content.includes("cookieConsent");

      if (!hasCookieScript && content.includes("</body>")) {
        content = content.replace(
          "</body>",
          '  <script src="js/cookie-banner.js"></script>\n</body>'
        );
      }

      return { ...file, content };
    });
  };

  // ============ CSS QUALITY ENFORCEMENT FOR PHP SITES ============
  // Ensure css/style.css has proper quality and all required styles
  const ensureQualityCSS = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const MINIMUM_CSS_LINES = 400;
    const MINIMUM_QUALITY_SCORE = 5;
    
    // 30 color schemes for variety
    const COLOR_SCHEMES = [
      { name: 'ocean', primary: '#0d4f8b', primaryRgb: '13, 79, 139', secondary: '#1a365d', accent: '#3182ce', heading: '#1a202c', text: '#4a5568', bgLight: '#ebf8ff', border: '#bee3f8' },
      { name: 'midnight', primary: '#1a1a2e', primaryRgb: '26, 26, 46', secondary: '#16213e', accent: '#2563eb', heading: '#1a202c', text: '#4a5568', bgLight: '#f7fafc', border: '#e2e8f0' },
      { name: 'teal', primary: '#234e52', primaryRgb: '35, 78, 82', secondary: '#1d4044', accent: '#319795', heading: '#1a202c', text: '#4a5568', bgLight: '#e6fffa', border: '#81e6d9' },
      { name: 'arctic', primary: '#0c4a6e', primaryRgb: '12, 74, 110', secondary: '#075985', accent: '#38bdf8', heading: '#0c4a6e', text: '#475569', bgLight: '#f0f9ff', border: '#bae6fd' },
      { name: 'navy', primary: '#1e3a5f', primaryRgb: '30, 58, 95', secondary: '#0d2137', accent: '#4a90d9', heading: '#1e3a5f', text: '#475569', bgLight: '#f1f5f9', border: '#cbd5e1' },
      { name: 'sky', primary: '#0284c7', primaryRgb: '2, 132, 199', secondary: '#0369a1', accent: '#7dd3fc', heading: '#0c4a6e', text: '#475569', bgLight: '#f0f9ff', border: '#bae6fd' },
      { name: 'forest', primary: '#276749', primaryRgb: '39, 103, 73', secondary: '#22543d', accent: '#38a169', heading: '#1a202c', text: '#4a5568', bgLight: '#f0fff4', border: '#9ae6b4' },
      { name: 'emerald', primary: '#047857', primaryRgb: '4, 120, 87', secondary: '#065f46', accent: '#10b981', heading: '#1a202c', text: '#4a5568', bgLight: '#ecfdf5', border: '#6ee7b7' },
      { name: 'sage', primary: '#3f6212', primaryRgb: '63, 98, 18', secondary: '#365314', accent: '#84cc16', heading: '#1a2e05', text: '#4a5568', bgLight: '#f7fee7', border: '#bef264' },
      { name: 'mint', primary: '#059669', primaryRgb: '5, 150, 105', secondary: '#047857', accent: '#34d399', heading: '#064e3b', text: '#4a5568', bgLight: '#ecfdf5', border: '#a7f3d0' },
      { name: 'olive', primary: '#4d5527', primaryRgb: '77, 85, 39', secondary: '#3f4720', accent: '#708238', heading: '#1a1c0d', text: '#525252', bgLight: '#fafaf5', border: '#d4d4aa' },
      { name: 'sunset', primary: '#c53030', primaryRgb: '197, 48, 48', secondary: '#9b2c2c', accent: '#e53e3e', heading: '#1a202c', text: '#4a5568', bgLight: '#fff5f5', border: '#feb2b2' },
      { name: 'coral', primary: '#c05621', primaryRgb: '192, 86, 33', secondary: '#9c4221', accent: '#dd6b20', heading: '#1a202c', text: '#4a5568', bgLight: '#fffaf0', border: '#fbd38d' },
      { name: 'crimson', primary: '#991b1b', primaryRgb: '153, 27, 27', secondary: '#7f1d1d', accent: '#dc2626', heading: '#450a0a', text: '#4a5568', bgLight: '#fef2f2', border: '#fecaca' },
      { name: 'amber', primary: '#b45309', primaryRgb: '180, 83, 9', secondary: '#92400e', accent: '#f59e0b', heading: '#78350f', text: '#4a5568', bgLight: '#fffbeb', border: '#fde68a' },
      { name: 'flame', primary: '#ea580c', primaryRgb: '234, 88, 12', secondary: '#c2410c', accent: '#fb923c', heading: '#7c2d12', text: '#4a5568', bgLight: '#fff7ed', border: '#fed7aa' },
      { name: 'royal', primary: '#553c9a', primaryRgb: '85, 60, 154', secondary: '#44337a', accent: '#805ad5', heading: '#1a202c', text: '#4a5568', bgLight: '#faf5ff', border: '#d6bcfa' },
      { name: 'rose', primary: '#97266d', primaryRgb: '151, 38, 109', secondary: '#702459', accent: '#d53f8c', heading: '#1a202c', text: '#4a5568', bgLight: '#fff5f7', border: '#fbb6ce' },
      { name: 'lavender', primary: '#7c3aed', primaryRgb: '124, 58, 237', secondary: '#6d28d9', accent: '#a78bfa', heading: '#4c1d95', text: '#4a5568', bgLight: '#f5f3ff', border: '#ddd6fe' },
      { name: 'fuchsia', primary: '#a21caf', primaryRgb: '162, 28, 175', secondary: '#86198f', accent: '#e879f9', heading: '#701a75', text: '#4a5568', bgLight: '#fdf4ff', border: '#f5d0fe' },
      { name: 'plum', primary: '#6b21a8', primaryRgb: '107, 33, 168', secondary: '#581c87', accent: '#c084fc', heading: '#3b0764', text: '#4a5568', bgLight: '#faf5ff', border: '#e9d5ff' },
      { name: 'mauve', primary: '#9d4edd', primaryRgb: '157, 78, 221', secondary: '#7b2cbf', accent: '#c77dff', heading: '#5a189a', text: '#525252', bgLight: '#faf5ff', border: '#e9d5ff' },
      { name: 'slate', primary: '#2d3748', primaryRgb: '45, 55, 72', secondary: '#1a202c', accent: '#4a5568', heading: '#1a202c', text: '#4a5568', bgLight: '#f7fafc', border: '#e2e8f0' },
      { name: 'charcoal', primary: '#1f2937', primaryRgb: '31, 41, 55', secondary: '#111827', accent: '#374151', heading: '#111827', text: '#4b5563', bgLight: '#f9fafb', border: '#d1d5db' },
      { name: 'bronze', primary: '#92400e', primaryRgb: '146, 64, 14', secondary: '#78350f', accent: '#d97706', heading: '#451a03', text: '#525252', bgLight: '#fffbeb', border: '#fde68a' },
      { name: 'coffee', primary: '#78350f', primaryRgb: '120, 53, 15', secondary: '#451a03', accent: '#a16207', heading: '#292524', text: '#525252', bgLight: '#fefce8', border: '#fef08a' },
      { name: 'sand', primary: '#a8a29e', primaryRgb: '168, 162, 158', secondary: '#78716c', accent: '#d6d3d1', heading: '#44403c', text: '#57534e', bgLight: '#fafaf9', border: '#e7e5e4' },
      { name: 'terracotta', primary: '#9a3412', primaryRgb: '154, 52, 18', secondary: '#7c2d12', accent: '#ea580c', heading: '#431407', text: '#525252', bgLight: '#fff7ed', border: '#fed7aa' },
      { name: 'gold', primary: '#b7791f', primaryRgb: '183, 121, 31', secondary: '#975a16', accent: '#ecc94b', heading: '#744210', text: '#4a5568', bgLight: '#fffff0', border: '#faf089' },
      { name: 'silver', primary: '#64748b', primaryRgb: '100, 116, 139', secondary: '#475569', accent: '#94a3b8', heading: '#334155', text: '#64748b', bgLight: '#f8fafc', border: '#cbd5e1' },
    ];
    
    // Select color scheme: use user-selected scheme if provided, otherwise random
    let colorScheme;
    if (userColorScheme) {
      colorScheme = COLOR_SCHEMES.find(s => s.name === userColorScheme) || COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];
      console.log(`🎨 PHP CSS: Using user-selected ${colorScheme.name} theme`);
    } else {
      colorScheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];
      console.log(`🎨 PHP CSS: Using random ${colorScheme.name} theme`);
    }
    
    const BASELINE_PHP_CSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');

:root {
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
  --border-color: ${colorScheme.border};
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 12px 35px rgba(0,0,0,0.12);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --transition: all 0.3s ease;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-heading: 'Poppins', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body {
  font-family: var(--font-body);
  color: var(--text-color);
  background-color: var(--bg-color);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  color: var(--heading-color);
  line-height: 1.3;
  font-weight: 700;
}
h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.5rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.75rem); }
a { color: var(--accent-color); text-decoration: none; transition: var(--transition); }
a:hover { text-decoration: underline; }
img { max-width: 100%; height: auto; display: block; object-fit: cover; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

/* HEADER & NAVIGATION */
.header, .main-header {
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
.site-logo, .nav-logo, .logo {
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
  padding: 0.5rem 0;
  position: relative;
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
.nav-links a:hover::after, .nav-links a.active::after { width: 100%; }
.nav-toggle, .hamburger-menu {
  display: none;
  cursor: pointer;
  background: none;
  border: none;
  padding: 8px;
}
.nav-toggle .hamburger, .hamburger-menu .bar {
  display: block;
  width: 25px;
  height: 3px;
  margin: 5px 0;
  background-color: var(--primary-color);
  transition: var(--transition);
}

/* HERO SECTION */
.hero, .page-hero {
  position: relative;
  min-height: 70vh;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--white);
  padding: 80px 20px;
}
.hero::before, .page-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(22, 33, 62, 0.85) 0%, rgba(22, 33, 62, 0.6) 100%);
  z-index: 1;
}
.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 800px;
}
.hero h1, .hero-title {
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 800;
  margin-bottom: 1rem;
  color: var(--white);
}
.hero p, .hero-subtitle {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  max-width: 700px;
  margin: 0 auto 2rem;
  opacity: 0.9;
  color: rgba(255,255,255,0.9);
}

/* BUTTONS */
.btn {
  display: inline-block;
  padding: 14px 32px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
  border: none;
  cursor: pointer;
}
.btn-primary, .btn {
  background-color: var(--accent-color);
  color: var(--white);
}
.btn-primary:hover, .btn:hover {
  background-color: var(--primary-color);
  transform: translateY(-2px);
  text-decoration: none;
}
.btn-secondary, .btn-outline {
  background: transparent;
  color: var(--accent-color);
  border: 2px solid var(--accent-color);
}
.btn-secondary:hover, .btn-outline:hover {
  background: var(--accent-color);
  color: white;
}

/* SECTIONS */
section, .section {
  padding: 80px 0;
}
section.light, .section.light, .bg-light {
  background: var(--bg-light);
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

/* CARDS & GRIDS */
.grid, .cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
}
.card {
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-lg);
}
.card-image, .card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}
.card-body, .card-content {
  padding: 24px;
}
.card-title, .card h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--heading-color);
}
.card-text, .card p {
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 16px;
}

/* FEATURES */
.feature-item, .feature-card {
  text-align: center;
  padding: 32px 24px;
  background: var(--white);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: var(--transition);
}
.feature-item:hover, .feature-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}
.feature-icon {
  font-size: 3rem;
  color: var(--accent-color);
  margin-bottom: 16px;
}
.feature-item h3 { margin-bottom: 12px; }
.feature-item p { color: var(--text-muted); }

/* FORMS */
.form-group { margin-bottom: 20px; }
.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--heading-color);
}
.form-control, input[type="text"], input[type="email"], input[type="tel"], textarea, select {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  background: var(--white);
  color: var(--text-color);
}
.form-control:focus, input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
}
textarea { min-height: 150px; resize: vertical; }

/* CONTACT */
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
.contact-details .icon { color: var(--accent-color); font-size: 1.5rem; }

/* MAP */
.map-container {
  width: 100%;
  height: 400px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  margin-top: 3rem;
}
.map-container iframe { width: 100%; height: 100%; border: none; }

/* FOOTER */
.footer, .main-footer {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0;
  padding: 60px 0 30px;
  margin-top: 80px;
}
.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 40px;
  margin-bottom: 40px;
}
.footer-logo { font-size: 1.5rem; font-weight: 700; color: var(--white); margin-bottom: 16px; }
.footer-description { font-size: 0.9rem; line-height: 1.6; color: #a0a0a0; margin-bottom: 20px; }
.footer-heading { font-size: 1rem; font-weight: 600; color: var(--white); margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
.footer-links { list-style: none; }
.footer-links li { margin-bottom: 12px; }
.footer-links a { color: #a0a0a0; text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
.footer-links a:hover { color: var(--white); }
.footer-contact-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; font-size: 0.9rem; color: #a0a0a0; }
.footer-bottom { border-top: 1px solid rgba(255,255,255,0.1); padding: 20px 0; text-align: center; color: #707070; font-size: 0.85rem; }
.footer-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 30px 0; }
.footer-social { display: flex; gap: 12px; margin-top: 20px; }
.footer-social a { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: var(--white); transition: var(--transition); }
.footer-social a:hover { background: var(--accent-color); transform: translateY(-3px); }

/* DISCLAIMER */
.disclaimer-section {
  background-color: rgba(0,0,0,0.2);
  color: #a0a0a0;
  padding: 20px 30px;
  margin: 0 auto 40px;
  border-radius: var(--radius-md);
  text-align: center;
  font-size: 0.85rem;
  line-height: 1.6;
  max-width: 1200px;
  width: 90%;
}
.disclaimer-section strong { display: block; margin-bottom: 8px; color: var(--white); }

/* COOKIE BANNER */
#cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.95);
  color: var(--white);
  padding: 1.5rem;
  z-index: 10000;
  display: none;
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

/* LEGAL PAGES */
.legal-content {
  background: var(--white);
  padding: 40px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
.legal-content h2 { font-size: 1.6rem; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; }
.legal-content p, .legal-content ul { font-size: 1rem; line-height: 1.7; margin-bottom: 1rem; }

/* TABLES (Cookie Policy) */
table { width: 100%; border-collapse: collapse; margin: 30px 0; font-size: 0.95rem; background: var(--white); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; }
thead { background: var(--bg-light); }
th, td { padding: 15px 20px; text-align: left; border-bottom: 1px solid var(--border-color); }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--bg-light); }

/* ANIMATIONS */
.fade-in { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
.fade-in.visible { opacity: 1; transform: translateY(0); }

/* RESPONSIVE */
@media (max-width: 992px) {
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .contact-grid { grid-template-columns: 1fr; }
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
  .map-container { height: 300px; }
}
@media (max-width: 576px) {
  .footer-grid { grid-template-columns: 1fr; text-align: center; }
  .footer-bottom { flex-direction: column; text-align: center; }
  .footer-social { justify-content: center; }
  .grid, .cards-grid { grid-template-columns: 1fr; }
}`;

    // Check if css/style.css exists
    const styleFile = generatedFiles.find(f => f.path === 'css/style.css');
    
    if (!styleFile) {
      console.log(`🚨 PHP CSS: style.css NOT FOUND! Creating with baseline CSS.`);
      generatedFiles.push({ path: 'css/style.css', content: BASELINE_PHP_CSS });
      return generatedFiles;
    }
    
    const existingCSS = styleFile.content;
    const lineCount = existingCSS.split('\n').length;
    const charCount = existingCSS.length;
    
    const qualityIndicators = {
      hasRootVars: existingCSS.includes(':root'),
      hasContainer: existingCSS.includes('.container'),
      hasFooter: existingCSS.includes('.footer') || existingCSS.includes('footer'),
      hasCard: existingCSS.includes('.card'),
      hasResponsive: existingCSS.includes('@media'),
      hasHeader: existingCSS.includes('.header'),
      hasHero: existingCSS.includes('.hero'),
      hasButton: existingCSS.includes('.btn'),
    };
    
    const qualityScore = Object.values(qualityIndicators).filter(Boolean).length;
    const hasMinimumLength = lineCount >= MINIMUM_CSS_LINES || charCount >= 12000;
    
    console.log(`📊 PHP CSS Quality: ${lineCount} lines, ${charCount} chars, score: ${qualityScore}/8`);
    
    const needsEnhancement = !hasMinimumLength || qualityScore < MINIMUM_QUALITY_SCORE;
    
    if (needsEnhancement) {
      console.log(`⚠️ PHP CSS insufficient. ENHANCING with baseline CSS.`);
      const enhancedCSS = BASELINE_PHP_CSS + '\n\n/* ===== SITE-SPECIFIC STYLES ===== */\n\n' + existingCSS;
      
      return generatedFiles.map(f => 
        f.path === 'css/style.css' ? { ...f, content: enhancedCSS } : f
      );
    }
    
    console.log(`✅ PHP CSS quality sufficient - no enhancement needed`);
    return generatedFiles;
  };

  // Remove emojis and instruction symbols from generated content
  const removeEmojisFromContent = (generatedFiles: GeneratedFile[]): GeneratedFile[] => {
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{25A0}-\u{25FF}]|[\u{2B50}]|[\u{2934}-\u{2935}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;
    
    return generatedFiles.map(file => {
      if (!/\.(php|css|html?|js)$/i.test(file.path)) return file;
      
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

  const normalized = normalizePaths(files);
  const withoutEmojis = removeEmojisFromContent(normalized);
  const withContact = ensureContactFlow(withoutEmojis);
  const withQualityCSS = ensureQualityCSS(withContact);
  const finalFiles = ensureCookieBanner(withQualityCSS);
  console.log(`Final files count: ${finalFiles.length}`);

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
  salePrice: number = 0
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[BG] Starting PHP background generation for history ID: ${historyId}, team: ${teamId}, salePrice: $${salePrice}`);

  try {
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    const result = await runGeneration({ prompt, language, aiModel, layoutStyle, imageSource });

    if (result.success && result.files) {
      const geoMatch = prompt.match(/(?:geo|country|страна|країна|гео)[:\s]*([^\n,;]+)/i);
      const geo = geoMatch ? geoMatch[1].trim() : undefined;

      const explicit = extractExplicitBrandingFromPrompt(prompt);
      const desiredSiteName = explicit.siteName;
      const desiredPhone = explicit.phone;
      
      console.log(`[BG] PHP - Extracted branding - siteName: "${desiredSiteName}", phone: "${desiredPhone}"`);
      
      // STEP 1: Force ALL images to use external URLs (picsum.photos) - no local assets
      const externalImgResult = forceExternalImages(result.files);
      let enforcedFiles = externalImgResult.files;
      if (externalImgResult.replaced > 0) {
        console.log(`🌐 [BG] Replaced ${externalImgResult.replaced} local image path(s) with external URLs`);
      }
      
      // STEP 2: Fix broken image URLs (AI hallucinations with phone numbers in URLs)
      enforcedFiles = enforcedFiles.map(f => {
        const imgFix = fixBrokenImageUrls(f.content);
        if (imgFix.fixed > 0) {
          console.log(`🖼️ [BG] Fixed ${imgFix.fixed} broken image URL(s) in ${f.path}`);
        }
        return { ...f, content: imgFix.content };
      });

      // STEP 3: Phone number handling
      if (desiredPhone) {
        console.log(`[BG] PHP - Using explicit phone from prompt: "${desiredPhone}" - skipping phone number fixing`);
        enforcedFiles = enforcePhoneInFiles(enforcedFiles, desiredPhone);
        console.log(`[BG] PHP - Enforced phone "${desiredPhone}" across all files`);
      } else {
        const { files: fixedFiles, totalFixed } = fixPhoneNumbersInFiles(enforcedFiles, geo);
        if (totalFixed > 0) {
          console.log(`[BG] Fixed ${totalFixed} invalid phone number(s) in PHP files`);
        }
        const autoPhone = generateRealisticPhone(geo);
        console.log(`[BG] PHP - No phone in prompt. Auto-generated regional phone: "${autoPhone}" (geo: "${geo || 'default'}")`);
        enforcedFiles = enforcePhoneInFiles(fixedFiles, autoPhone);
        console.log(`[BG] PHP - Enforced auto-generated phone "${autoPhone}" across all files`);
      }

      enforcedFiles = enforceSiteNameInFiles(enforcedFiles, desiredSiteName);
      enforcedFiles = enforceEmailInFiles(enforcedFiles, desiredSiteName);
      enforcedFiles = enforceResponsiveImagesInFiles(enforcedFiles);
      // Use color scheme for logo/favicon colors
      // Note: userColorScheme is not passed to runBackgroundGeneration, use default colors
      enforcedFiles = ensureFaviconAndLogoInFiles(enforcedFiles, desiredSiteName);
      
      // STEP 4: Ensure all 14 required files exist
      const siteNameForPages = desiredSiteName || extractExplicitBrandingFromPrompt(prompt).siteName;
      const { files: filesWithAllPages, warnings: missingPageWarnings, createdPages } = ensureMissingLinkedPagesExist(enforcedFiles, language, geo, siteNameForPages);
      enforcedFiles = filesWithAllPages;
      if (createdPages.length > 0) {
        console.log(`[BG] PHP - Created ${createdPages.length} missing linked pages: ${createdPages.join(', ')}`);
      }

      // STEP 5: Rebuild empty pages with quality template content
      const { files: nonEmptyFiles, warnings: nonEmptyWarnings, rebuiltPages } = ensureNonEmptyPhpPages(
        enforcedFiles,
        language,
        geo,
        siteNameForPages
      );
      enforcedFiles = nonEmptyFiles;
      if (rebuiltPages.length > 0) {
        console.log(`[BG] PHP - Rebuilt ${rebuiltPages.length} empty page(s): ${rebuiltPages.join(', ')}`);
      }

      // STEP 6: Final pass - ensure no local assets slipped through
      const assetsFix = fixMissingLocalAssets(enforcedFiles);
      enforcedFiles = assetsFix.files;
      if (assetsFix.fixed > 0) {
        console.log(`[BG] PHP - Replaced ${assetsFix.fixed} remaining local asset reference(s) with placeholders`);
      }
      
      // Run contact page validation (phone/email in contact.php, contact links in footers)
      // CRITICAL: Pass the phone to ensure it's on ALL pages and clickable
      const phoneForValidation = desiredPhone || generateRealisticPhone(geo);
      const { files: contactValidatedFiles, warnings: contactWarnings } = runContactValidation(enforcedFiles, geo, language, phoneForValidation);
      enforcedFiles = contactValidatedFiles;
      if (contactWarnings.length > 0) {
        console.log(`[BG] PHP Contact validation applied ${contactWarnings.length} fixes (phone: ${phoneForValidation})`);
      }
      
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
          // color_scheme and layout_style saved via main handler
        })
        .eq("id", historyId);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_complete",
        title: "PHP сайт згенеровано",
        message: `PHP сайт успішно створено (${enforcedFiles.length} файлів)`,
        data: { historyId, filesCount: enforcedFiles.length }
      });

      console.log(`[BG] PHP Generation completed for ${historyId}: ${enforcedFiles.length} files, sale: $${salePrice}, cost: $${generationCost.toFixed(4)}`);
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

      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "Generation failed",
          sale_price: 0,
        })
        .eq("id", historyId);

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "generation_failed",
        title: "Помилка генерації PHP",
        message: result.error || "Не вдалося згенерувати PHP сайт",
        data: { historyId, error: result.error }
      });

      console.error(`[BG] PHP Generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] PHP Background generation error for ${historyId}:`, error);

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
        sale_price: 0,
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
    
    console.log("Authenticated PHP generation request from user:", userId);

    // Build prompt with language and geo context if provided
    // Priority for retry: vipPrompt > improvedPrompt > prompt (same as startGeneration)
    let promptForGeneration = vipPrompt || improvedPrompt || prompt;
    
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
    
    const promptToSave = originalPrompt || prompt;
    const improvedPromptToSave = improvedPrompt || null;

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine team and deduct balance
    let teamId: string | null = overrideTeamId || null;
    let salePrice = 0;

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

      // Use HTML price for PHP (same as HTML)
      salePrice = pricing?.html_price || 0;
      
      if (imageSource === "ai") {
        salePrice += 2;
        console.log(`Added $2 for AI photo search. Total salePrice: $${salePrice}`);
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
          
          if (newBalance < -creditLimit) {
            console.log(`🚫 BLOCKED: Team ${teamId} would exceed credit limit.`);
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
          console.log(`💰 IMMEDIATELY deducted $${salePrice} from team ${teamId} for PHP generation. New balance: $${newBalance}`);
        }
      }
    }

    // Handle retry: update existing record OR create new one
    let historyId: string;
    
    if (retryHistoryId) {
      // RETRY MODE: Update existing failed record instead of creating new one
      console.log(`🔄 RETRY MODE: Updating existing PHP record ${retryHistoryId}`);
      
      const { data: existingRecord, error: fetchError } = await supabase
        .from("generation_history")
        .select("id, status, user_id")
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
      
      historyId = retryHistoryId;
      console.log(`🔄 Updated existing record for PHP retry: ${retryHistoryId}`);
    } else {
      const { data: historyEntry, error: insertError } = await supabase
        .from("generation_history")
        .insert({
          prompt: promptToSave,
          improved_prompt: improvedPromptToSave,
          language: language || "auto",
          user_id: userId,
          team_id: teamId || null,
          status: "pending",
          ai_model: aiModel,
          website_type: "php",
          site_name: siteName || null,
          image_source: imageSource || "basic",
          sale_price: salePrice,
          geo: geo || null,
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
    
    console.log("Using PHP history entry:", historyId);

    // ASYNC PATTERN: Return immediately, run generation in background
    // UI polls status via realtime subscription on generation_history table
    const backgroundPromise = (async () => {
      try {
        console.log("[BG-PHP] Starting async generation for:", historyId);
        
        const result = await runGeneration({
          prompt: promptForGeneration,
          language,
          aiModel,
          layoutStyle,
          imageSource,
          siteName,
        });

        if (!result.success || !result.files) {
          console.error("[BG-PHP] Generation failed:", result.error);
          
          // Refund balance
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
              console.log(`[BG-PHP] REFUNDED $${salePrice} to team ${teamId}`);
            }
          }

          await supabase
            .from("generation_history")
            .update({
              status: "failed",
              error_message: result.error || "PHP generation failed",
              sale_price: 0,
            })
            .eq("id", historyId);

          await supabase.from("notifications").insert({
            user_id: userId,
            type: "generation_failed",
            title: "Помилка генерації PHP",
            message: result.error || "Не вдалося згенерувати PHP сайт",
            data: { historyId: historyId, error: result.error }
          });
          return;
        }

        // Post-process files
        const explicit = extractExplicitBrandingFromPrompt(promptForGeneration);
        const desiredSiteName = explicit.siteName || siteName;
        const desiredPhone = explicit.phone;
        const geoToUse = geo;

        // CRITICAL: Fix broken image URLs FIRST (before any phone processing)
        let enforcedFiles = result.files.map(f => {
          const imgFix = fixBrokenImageUrls(f.content);
          if (imgFix.fixed > 0) {
            console.log(`🖼️ [BG-PHP-ASYNC] Fixed ${imgFix.fixed} broken image URL(s) in ${f.path}`);
          }
          return { ...f, content: imgFix.content };
        });

        const { files: fixedFiles } = fixPhoneNumbersInFiles(enforcedFiles, geoToUse);
        const phoneToUse = desiredPhone || generateRealisticPhone(geoToUse);
        enforcedFiles = enforcePhoneInFiles(fixedFiles, phoneToUse);
        enforcedFiles = enforceSiteNameInFiles(enforcedFiles, desiredSiteName);
        enforcedFiles = enforceEmailInFiles(enforcedFiles, desiredSiteName);
        enforcedFiles = enforceResponsiveImagesInFiles(enforcedFiles);
        
        // Ensure branding assets with color scheme
        const brandColorsForLogo = getBrandColors(colorScheme);
        enforcedFiles = ensureFaviconAndLogoInFiles(enforcedFiles, desiredSiteName, brandColorsForLogo);
        const { files: contactValidatedFiles } = runContactValidation(enforcedFiles, geoToUse, language);
        enforcedFiles = contactValidatedFiles;

        // Create zip
        const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
        const zip = new JSZip();
        for (const file of enforcedFiles) {
          if (/\.ico$/i.test(file.path)) {
            zip.file(file.path, file.content, { base64: true });
          } else {
            zip.file(file.path, file.content);
          }
        }
        const zipBase64 = await zip.generateAsync({ type: "base64" });

        // Update history with completed result
        await supabase
          .from("generation_history")
          .update({
            status: "completed",
            files_data: enforcedFiles,
            zip_data: zipBase64,
            generation_cost: result.totalCost || 0,
            specific_ai_model: result.specificModel || null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", historyId);

        // Send notification
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "generation_complete",
          title: "PHP сайт згенеровано",
          message: `PHP сайт успішно створено (${enforcedFiles.length} файлів)`,
          data: { historyId: historyId, filesCount: enforcedFiles.length }
        });

        console.log(`[BG-PHP] Completed: ${historyId}, ${enforcedFiles.length} files`);
      } catch (error) {
        console.error("[BG-PHP] Error:", error);
        
        // Refund on error
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
              console.log(`[BG-PHP] REFUNDED $${salePrice} on error`);
            }
          } catch (refundErr) {
            console.error("[BG-PHP] Refund failed:", refundErr);
          }
        }

        await supabase
          .from("generation_history")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            sale_price: 0,
          })
          .eq("id", historyId);
      }
    })();

    // Use EdgeRuntime.waitUntil to keep the function alive for background work
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundPromise);
    } else {
      // Fallback: just fire and don't await (less reliable but works)
      backgroundPromise.catch(e => console.error("[BG-PHP] Unhandled:", e));
    }

    // Return immediately with pending status
    return new Response(
      JSON.stringify({
        success: true,
        historyId: historyId,
        status: "pending",
        message: "PHP generation started. Check history for results.",
      }),
      {
        status: 202, // Accepted
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
