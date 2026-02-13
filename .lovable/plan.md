
# Plan: Fix HTML Generator Quality Issues

## Problem Summary

Three critical issues are causing poor HTML site generation:
1. **96% of failures are timeouts** -- heavy post-processing exceeds edge function time limits
2. **Topic substitution** -- the internal "refine" step can change the user's topic (e.g., cleaning becomes digital marketing)
3. **Language mixing** -- the geo location overrides the selected language (e.g., France geo causes French output despite Russian being selected)
4. **Missing Kazakhstan** support in address/phone generation

---

## Changes

### 1. Fix Topic Enforcement in generate-website SYSTEM_PROMPT

**File:** `supabase/functions/generate-website/index.ts` (lines ~3992-4026)

Add topic enforcement to the SYSTEM_PROMPT used in the internal refine step, matching what was already added to `improve-prompt`:

- Add `TOPIC (CRITICAL, NON-NEGOTIABLE)` section
- Instruct: "The brief MUST be about the EXACT topic from the user's prompt. Do NOT change, reinterpret, or substitute the topic."
- Pass the original user topic as a constraint in the user message for the refine step

### 2. Fix Language Enforcement in Refine Step

**File:** `supabase/functions/generate-website/index.ts` (lines ~8006-8016)

Strengthen the language constraint in the refine step:

- Add an explicit `LANGUAGE — ABSOLUTE PRIORITY` block to the system prompt, identical to improve-prompt
- Move the `TARGET CONTENT LANGUAGE` from being a footnote in the user message to being a primary constraint in the system message
- Ensure the refine step output includes `TARGET_LANGUAGE: <code>` that matches the user's selection, not the geo

### 3. Add Kazakhstan Support to generate-website

**File:** `supabase/functions/generate-website/index.ts`

Add Kazakhstan (`kz`) to:
- `GEO_NAMES` map (line ~116): `kz: "Kazakhstan"`
- `generateRealisticPhone()` function: add `+7 7xx xxx xx xx` format (Kazakhstan uses +7 like Russia but with 7xx area codes)
- `generateRealisticAddress()` function: add Kazakhstan streets (Almaty, Astana) and address format
- Country matching logic in `resolveGeoCountryCode()`

### 4. Reduce Timeout Risk

**File:** `supabase/functions/generate-website/index.ts`

- Add timeout guards around image bundling (`bundleExternalImagesForZip`) -- if it takes more than 30 seconds, skip remaining downloads
- Add a per-image download timeout of 5 seconds (currently no timeout on individual image fetches)
- Add early exit in `ensureQualityCSS` if CSS is already above minimum thresholds (avoid unnecessary regeneration)

---

## Technical Details

### Topic Enforcement Change (SYSTEM_PROMPT)

```text
TOPIC (CRITICAL, NON-NEGOTIABLE):
- The brief MUST be about the EXACT topic described in the user's input.
- Do NOT change, reinterpret, or substitute the topic.
- If the input says "cleaning" -- the brief is about cleaning services.
- If the input says "dental" -- the brief is about dental services.
- Topic deviation = GENERATION FAILURE.
```

### Language Enforcement Change (Refine Step)

The current refine step (line 8016) puts language as a footnote:
```
TARGET CONTENT LANGUAGE: ${language === "uk" ? "Ukrainian" : ...}
```

Change to inject into SYSTEM prompt as absolute priority:
```
LANGUAGE (ABSOLUTE PRIORITY, NON-NEGOTIABLE):
- Set TARGET_LANGUAGE to: ${normalizedLanguage}
- ALL content descriptions in the brief MUST reference this language
- The geo/country does NOT determine the language!
- If geo=France but language=Russian, the site MUST be in Russian!
```

### Kazakhstan Phone/Address

```typescript
// Phone: Kazakhstan uses +7 7xx format (unlike Russia's +7 4xx/8xx)
if (hasGeoCode("kz") || geoLower.includes("kazakhstan") || geoLower.includes("казахстан")) {
  const areaCodes = ["701", "702", "705", "707", "747", "771", "775", "776", "778"];
  return `+7 ${pick(areaCodes)} ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
}

// Address: Kazakhstan cities
kz: {
  streets: ["проспект Абая", "улица Толе би", "проспект Назарбаева", "улица Гоголя", "проспект Достык"],
  cities: ["Алматы", "Астана", "Шымкент", "Караганда", "Актобе"],
  postal: () => `${num(1, 9)}${num(10000, 99999)}`,
  format: (s, n, c, p) => `${s}, ${n}, ${c}, ${p}, Казахстан`,
}
```

### Timeout Mitigation

Add a per-image timeout and an overall bundling timeout:

```typescript
// In downloadImageAsBase64():
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s per image
const res = await fetch(url, { signal: controller.signal, ... });

// In bundleExternalImagesForZip():
const BUNDLE_DEADLINE = Date.now() + 30000; // 30s total for all images
async function worker() {
  while (idx < urls.length && Date.now() < BUNDLE_DEADLINE) {
    // ... download logic
  }
}
```

---

## Files to Modify

1. `supabase/functions/generate-website/index.ts` -- all 4 fixes (topic, language, Kazakhstan, timeouts)

## Risk Assessment

- **Low risk**: Kazakhstan support is purely additive
- **Low risk**: Topic/language enforcement only adds constraints, doesn't change generation flow
- **Medium risk**: Timeout mitigation changes image bundling behavior (may result in fewer bundled images, but prevents failures)
