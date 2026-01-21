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
    // (Skip if inside src="...", href="...", content="...", data-*="...")
    content = content.replace(/\+\d[\d\s().-]{7,}\d/g, (match, offset) => {
      const before = content.substring(Math.max(0, offset - 100), offset);
      if (/src=["'][^"']*$/i.test(before)) return match;
      if (/href=["'](?!tel:)[^"']*$/i.test(before)) return match;
      if (/content=["'][^"']*$/i.test(before)) return match;
      if (/data-[\w-]+=["'][^"']*$/i.test(before)) return match;
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
  
  // Determine text based on language
  const langLower = (language || 'en').toLowerCase();
  let cookiePolicyText = 'Cookie Policy';
  let cookieBannerText = 'We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.';
  let acceptButtonText = 'Accept';
  let learnMoreText = 'Learn more';
  
  if (langLower.includes('de')) {
    cookiePolicyText = 'Cookie-Richtlinie';
    cookieBannerText = 'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Durch die weitere Nutzung dieser Website stimmen Sie der Verwendung von Cookies zu.';
    acceptButtonText = 'Akzeptieren';
    learnMoreText = 'Mehr erfahren';
  } else if (langLower.includes('pl')) {
    cookiePolicyText = 'Polityka Cookies';
    cookieBannerText = 'Używamy plików cookie, aby poprawić Twoje doświadczenia. Kontynuując wizytę na tej stronie, zgadzasz się na używanie plików cookie.';
    acceptButtonText = 'Akceptuję';
    learnMoreText = 'Dowiedz się więcej';
  } else if (langLower.includes('uk')) {
    cookiePolicyText = 'Політика Cookie';
    cookieBannerText = 'Ми використовуємо файли cookie для покращення вашого досвіду. Продовжуючи відвідувати цей сайт, ви погоджуєтесь на використання cookie.';
    acceptButtonText = 'Прийняти';
    learnMoreText = 'Дізнатися більше';
  } else if (langLower.includes('ru')) {
    cookiePolicyText = 'Политика Cookie';
    cookieBannerText = 'Мы используем файлы cookie для улучшения вашего опыта. Продолжая посещать этот сайт, вы соглашаетесь на использование cookie.';
    acceptButtonText = 'Принять';
    learnMoreText = 'Узнать больше';
  } else if (langLower.includes('fr')) {
    cookiePolicyText = 'Politique de Cookies';
    cookieBannerText = 'Nous utilisons des cookies pour améliorer votre expérience. En continuant à visiter ce site, vous acceptez l\'utilisation de cookies.';
    acceptButtonText = 'Accepter';
    learnMoreText = 'En savoir plus';
  } else if (langLower.includes('es')) {
    cookiePolicyText = 'Política de Cookies';
    cookieBannerText = 'Utilizamos cookies para mejorar su experiencia. Al continuar visitando este sitio, acepta el uso de cookies.';
    acceptButtonText = 'Aceptar';
    learnMoreText = 'Saber más';
  } else if (langLower.includes('it')) {
    cookiePolicyText = 'Politica dei Cookie';
    cookieBannerText = 'Utilizziamo i cookie per migliorare la tua esperienza. Continuando a visitare questo sito, accetti l\'uso dei cookie.';
    acceptButtonText = 'Accetta';
    learnMoreText = 'Scopri di più';
  } else if (langLower.includes('ro')) {
    cookiePolicyText = 'Politica Cookie';
    cookieBannerText = 'Folosim cookie-uri pentru a vă îmbunătăți experiența. Continuând să vizitați acest site, sunteți de acord cu utilizarea cookie-urilor.';
    acceptButtonText = 'Accept';
    learnMoreText = 'Află mai multe';
  } else if (langLower.includes('nl')) {
    cookiePolicyText = 'Cookiebeleid';
    cookieBannerText = 'Wij gebruiken cookies om uw ervaring te verbeteren. Door deze site te blijven bezoeken, gaat u akkoord met het gebruik van cookies.';
    acceptButtonText = 'Accepteren';
    learnMoreText = 'Meer informatie';
  } else if (langLower.includes('pt')) {
    cookiePolicyText = 'Política de Cookies';
    cookieBannerText = 'Usamos cookies para melhorar sua experiência. Ao continuar visitando este site, você concorda com o uso de cookies.';
    acceptButtonText = 'Aceitar';
    learnMoreText = 'Saiba mais';
  }
  
  const cookiePolicyPath = cookiePolicyFile?.path.replace(/^\.?\//, '') || 'cookie-policy.php';
  
  // Cookie banner HTML with JS for accept/dismiss functionality
  const COOKIE_BANNER_ID = 'lovable-cookie-banner';
  const cookieBannerHtml = `
<!-- Cookie Banner -->
<div id="${COOKIE_BANNER_ID}" style="position: fixed; bottom: 0; left: 0; right: 0; background: #1a1a1a; color: #fff; padding: 16px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; z-index: 9999; box-shadow: 0 -2px 10px rgba(0,0,0,0.2); font-size: 14px;">
  <p style="margin: 0; flex: 1; min-width: 200px;">${cookieBannerText} <a href="${cookiePolicyPath}" style="color: #4da6ff; text-decoration: underline;">${learnMoreText}</a></p>
  <button onclick="document.getElementById('${COOKIE_BANNER_ID}').style.display='none'; localStorage.setItem('cookiesAccepted', 'true');" style="background: #4da6ff; color: #fff; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-weight: 600; white-space: nowrap;">${acceptButtonText}</button>
</div>
<script>
if(localStorage.getItem('cookiesAccepted')==='true'){document.getElementById('${COOKIE_BANNER_ID}').style.display='none';}
</script>
<!-- End Cookie Banner -->
`;
  
  const updatedFiles = files.map(f => {
    if (!/\.(?:html?|php)$/i.test(f.path)) return f;
    
    let content = f.content;
    let modified = false;
    
    // Check if cookie banner already exists
    const hasCookieBanner = 
      content.includes(COOKIE_BANNER_ID) ||
      /cookie[-_]?(?:banner|consent|notice|popup)/i.test(content) ||
      /gdpr[-_]?(?:banner|consent|notice)/i.test(content);
    
    // Inject cookie banner if missing
    if (!hasCookieBanner) {
      warnings.push(`${f.path}: Added missing cookie banner`);
      
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
          
          const cookieLinkHtml = `<a href="${cookiePolicyPath}" class="footer-legal-link">${cookiePolicyText}</a>`;
          
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
  const css = `\n<style id="${STYLE_ID}">\n  img, svg, video { max-width: 100%; height: auto; }\n  img { display: block; }\n  figure { margin: 0; }\n</style>\n`;

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
}: {
  prompt: string;
  language?: string;
  aiModel: "junior" | "senior";
  layoutStyle?: string;
  imageSource?: "basic" | "ai";
  siteName?: string;
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

  // 2. Select layout variation
  let layoutDescription = "";
  if (layoutStyle) {
    const selectedLayout = LAYOUT_VARIATIONS.find(l => l.id === layoutStyle);
    if (selectedLayout) {
      layoutDescription = `\n\n${selectedLayout.description}`;
    }
  } else {
    // Random layout
    const randomLayout = LAYOUT_VARIATIONS[Math.floor(Math.random() * LAYOUT_VARIATIONS.length)];
    layoutDescription = `\n\n${randomLayout.description}`;
  }

  // 3. Build image strategy
  let imageStrategy = IMAGE_STRATEGY_BASIC;
  if (imageSource === "ai") {
    imageStrategy = await buildPexelsImageStrategy(prompt);
  }

  // Reduced required paths for faster, more reliable generation
  const requiredPaths = [
    "includes/config.php",
    "includes/header.php",
    "includes/footer.php",
    "index.php",
    "about.php",
    "contact.php",
    "form-handler.php",
    "thank-you.php",
    "privacy.php",
    "terms.php",
    "css/style.css",
    "js/script.js",
  ];

  const validateFiles = (files: GeneratedFile[]) => {
    const paths = new Set(files.map((f) => f.path));
    const missing = requiredPaths.filter((p) => !paths.has(p));
    // Guard against "nothingburger" files: if the file exists but is extremely short, treat as invalid.
    const tooShort = files
      .filter((f) => requiredPaths.includes(f.path))
      .filter((f) => f.content.trim().length < 50)
      .map((f) => f.path);

    return { missing, tooShort };
  };

  const generateOnce = async (opts: { strictFormat: boolean; timeoutMs?: number }) => {
    // Timeout per individual model attempt - PHP needs longer due to complex multi-file output
    const perModelTimeoutMs = opts.timeoutMs ?? 150_000; // 2.5 minutes per model

    const strictFormatBlock = opts.strictFormat
      ? `\n\nSTRICT OUTPUT FORMAT (MANDATORY):\n- Output ONLY file blocks in this exact format. No commentary, no markdown headings.\n\n--- FILE: includes/config.php ---\n<file contents>\n--- END FILE ---\n\n--- FILE: includes/header.php ---\n<file contents>\n--- END FILE ---\n\n(Repeat for every file.)\n\nIf you cannot comply, output nothing.`
      : "";

    const systemContent = PHP_GENERATION_PROMPT + layoutDescription + "\n\n" + imageStrategy + "\n\n" + IMAGE_CSS;
    // Simplified user prompt for faster, more reliable generation
    const userContent = `Create a PHP website based on this brief:

${refinedPrompt}

REQUIRED FILES (generate ALL):
1. includes/config.php - Site constants (SITE_NAME, SITE_EMAIL, SITE_PHONE, SITE_ADDRESS)
2. includes/header.php - HTML head + navigation
3. includes/footer.php - Footer with links
4. index.php - Homepage with hero, features, CTA
5. about.php - About page
6. contact.php - Contact form (action="form-handler.php")
7. form-handler.php - Form processor → redirect to thank-you.php
8. thank-you.php - Thank you page
9. privacy.php - Privacy Policy
10. terms.php - Terms of Service
11. css/style.css - Complete responsive CSS
12. js/script.js - Mobile menu JS

FORMAT: Use --- FILE: path --- and --- END FILE --- markers.
Generate complete, working code. No placeholders.${strictFormatBlock}`;

    try {
      let generateResponse: Response;
      const startTime = Date.now();
      
      // Use gemini-2.5-pro as primary (more reliable for large PHP sites), flash as fallback
      const modelsToTry = useLovableAI 
        ? ["google/gemini-2.5-pro", "google/gemini-2.5-flash"]
        : [generateModel];
      
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
    
    // Color schemes for variety
    const COLOR_SCHEMES = [
      { name: 'ocean', primary: '#0d4f8b', primaryRgb: '13, 79, 139', secondary: '#1a365d', accent: '#3182ce', heading: '#1a202c', text: '#4a5568', bgLight: '#ebf8ff', border: '#bee3f8' },
      { name: 'forest', primary: '#276749', primaryRgb: '39, 103, 73', secondary: '#22543d', accent: '#38a169', heading: '#1a202c', text: '#4a5568', bgLight: '#f0fff4', border: '#9ae6b4' },
      { name: 'sunset', primary: '#c53030', primaryRgb: '197, 48, 48', secondary: '#9b2c2c', accent: '#e53e3e', heading: '#1a202c', text: '#4a5568', bgLight: '#fff5f5', border: '#feb2b2' },
      { name: 'royal', primary: '#553c9a', primaryRgb: '85, 60, 154', secondary: '#44337a', accent: '#805ad5', heading: '#1a202c', text: '#4a5568', bgLight: '#faf5ff', border: '#d6bcfa' },
      { name: 'teal', primary: '#234e52', primaryRgb: '35, 78, 82', secondary: '#1d4044', accent: '#319795', heading: '#1a202c', text: '#4a5568', bgLight: '#e6fffa', border: '#81e6d9' },
      { name: 'coral', primary: '#c05621', primaryRgb: '192, 86, 33', secondary: '#9c4221', accent: '#dd6b20', heading: '#1a202c', text: '#4a5568', bgLight: '#fffaf0', border: '#fbd38d' },
    ];
    
    const colorScheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];
    console.log(`🎨 PHP CSS: Selected ${colorScheme.name} theme`);
    
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
      
      // CRITICAL behavior:
      // - If phone is explicitly provided in prompt -> enforce EXACTLY that phone and DO NOT "fix" it.
      // - If phone is NOT provided -> generate a realistic phone based on geo and enforce it.
      let enforcedFiles = result.files;

      if (desiredPhone) {
        console.log(`[BG] PHP - Using explicit phone from prompt: "${desiredPhone}" - skipping phone number fixing`);
        enforcedFiles = enforcePhoneInFiles(enforcedFiles, desiredPhone);
        console.log(`[BG] PHP - Enforced phone "${desiredPhone}" across all files`);
      } else {
        const { files: fixedFiles, totalFixed } = fixPhoneNumbersInFiles(result.files, geo);
        if (totalFixed > 0) {
          console.log(`[BG] Fixed ${totalFixed} invalid phone number(s) in PHP files`);
        }
        const autoPhone = generateRealisticPhone(geo);
        console.log(`[BG] PHP - No phone in prompt. Auto-generated regional phone: "${autoPhone}" (geo: "${geo || 'default'}")`);
        enforcedFiles = enforcePhoneInFiles(fixedFiles, autoPhone);
        console.log(`[BG] PHP - Enforced auto-generated phone "${autoPhone}" across all files`);
      }

      enforcedFiles = enforceSiteNameInFiles(enforcedFiles, desiredSiteName);
      enforcedFiles = enforceResponsiveImagesInFiles(enforcedFiles);
      
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
      enforcedFiles.forEach((file) => zip.file(file.path, file.content));
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

    // Validate JWT using getClaims for more reliable token validation
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log("Authenticated PHP generation request from user:", userId);

    const { prompt, originalPrompt, improvedPrompt, language, aiModel = "senior", layoutStyle, siteName, imageSource = "basic", teamId: overrideTeamId, geo } = await req.json();

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

    // Create history entry
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
      // REFUND if we already deducted
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
          console.log(`REFUNDED $${salePrice} to team ${teamId} due to history creation failure`);
        }
      }
      return new Response(JSON.stringify({ success: false, error: "Failed to start generation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Created PHP history entry:", historyEntry.id);

    // ASYNC PATTERN: Return immediately, run generation in background
    // UI polls status via realtime subscription on generation_history table
    const backgroundPromise = (async () => {
      try {
        console.log("[BG-PHP] Starting async generation for:", historyEntry.id);
        
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
            .eq("id", historyEntry.id);

          await supabase.from("notifications").insert({
            user_id: userId,
            type: "generation_failed",
            title: "Помилка генерації PHP",
            message: result.error || "Не вдалося згенерувати PHP сайт",
            data: { historyId: historyEntry.id, error: result.error }
          });
          return;
        }

        // Post-process files
        const explicit = extractExplicitBrandingFromPrompt(promptForGeneration);
        const desiredSiteName = explicit.siteName || siteName;
        const desiredPhone = explicit.phone;
        const geoToUse = geo;

        const { files: fixedFiles } = fixPhoneNumbersInFiles(result.files, geoToUse);
        const phoneToUse = desiredPhone || generateRealisticPhone(geoToUse);
        let enforcedFiles = enforcePhoneInFiles(fixedFiles, phoneToUse);
        enforcedFiles = enforceSiteNameInFiles(enforcedFiles, desiredSiteName);
        enforcedFiles = enforceResponsiveImagesInFiles(enforcedFiles);
        
        const { files: contactValidatedFiles } = runContactValidation(enforcedFiles, geoToUse, language);
        enforcedFiles = contactValidatedFiles;

        // Create zip
        const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
        const zip = new JSZip();
        for (const file of enforcedFiles) {
          zip.file(file.path, file.content);
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
          .eq("id", historyEntry.id);

        // Send notification
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "generation_complete",
          title: "PHP сайт згенеровано",
          message: `PHP сайт успішно створено (${enforcedFiles.length} файлів)`,
          data: { historyId: historyEntry.id, filesCount: enforcedFiles.length }
        });

        console.log(`[BG-PHP] Completed: ${historyEntry.id}, ${enforcedFiles.length} files`);
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
          .eq("id", historyEntry.id);
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
        historyId: historyEntry.id,
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
