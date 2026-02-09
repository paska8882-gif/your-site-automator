

# Plan: Diversification of Website Design Uniqueness

## Problem
Generated websites look similar because several key visual elements are not randomized:
- **Typography**: Always uses Inter for both headings and body text
- **Team portraits**: Same 12 hardcoded Pexels photos every time
- **Content images**: Same keyword-based search can return identical photos for similar topics
- **No Google Fonts integration**: Even if fonts were randomized, they wouldn't load without the CDN link

## Solution

### 1. Font Pair Randomization (30+ pairs)

Add a `FONT_PAIRS` array with 30+ curated Google Fonts combinations, each with a heading font and body font. Examples:
- Playfair Display + Source Sans 3
- Montserrat + Lora
- Oswald + Merriweather
- Raleway + Roboto
- Poppins + Nunito
- DM Serif Display + Inter
- Libre Baskerville + Open Sans
- etc.

Each pair will be randomly selected (or tied to the layout style for consistency). The selected fonts will be:
- Injected into `--font-family-heading` and `--font-family-body` CSS variables in `BASELINE_CSS`
- Automatically added as a `<link>` tag to Google Fonts CDN in every generated HTML file via post-processing

### 2. Extended Portrait Pool (30+ male, 30+ female)

Replace the current 6+6 hardcoded portrait list with 30+ verified Pexels portrait IDs per gender. The system will randomly select a subset for each generation, ensuring different "team members" appear on each site.

### 3. Hero Image Seed Randomization

Add a random seed parameter to Pexels API queries and picsum URLs so that even identical topics get different hero/content images. For picsum fallbacks, use `Math.random()` based seeds instead of sequential `random=1, random=2`.

### 4. Section Order Variation

Add a post-processing step that can optionally shuffle the order of middle sections (keeping Hero first and Footer last) within each layout template, creating more visual variety even with the same layout style.

---

## Technical Details

### File: `supabase/functions/generate-website/index.ts`

**A. New constant: `FONT_PAIRS` (~line 8250)**
```typescript
const FONT_PAIRS = [
  { heading: 'Playfair Display', body: 'Source Sans 3', style: 'elegant' },
  { heading: 'Montserrat', body: 'Lora', style: 'modern' },
  { heading: 'Oswald', body: 'Merriweather', style: 'bold' },
  { heading: 'Raleway', body: 'Roboto', style: 'clean' },
  { heading: 'Poppins', body: 'Nunito', style: 'friendly' },
  { heading: 'DM Serif Display', body: 'Inter', style: 'editorial' },
  // ... 25+ more pairs
];
```

**B. Modified `BASELINE_CSS` (~line 8284)**
- Replace hardcoded `'Inter'` with selected font pair
- `--font-family-heading: '${fontPair.heading}', ...`
- `--font-family-body: '${fontPair.body}', ...`

**C. New function: `injectGoogleFonts(files, fontPair)`**
- Finds all `.html` files
- Inserts `<link href="https://fonts.googleapis.com/css2?family=X&family=Y&display=swap">` into `<head>`

**D. Extended `PORTRAIT_URLS` (~line 4815)**
- Expand from 12 to 60+ verified Pexels portrait IDs
- Randomly select 6 male + 6 female per generation from the pool

**E. Image seed randomization**
- Replace `?random=1` with `?random=${Math.floor(Math.random()*10000)}`
- Add `page` parameter variation to Pexels API calls

**F. Post-processing pipeline update**
Add `injectGoogleFonts` to the existing processing chain:
```
files -> validateFiles -> injectGoogleFonts -> ensureQualityCSS -> ...
```

### Estimated scope
- ~200 lines of new constants (font pairs + portrait pool)
- ~30 lines for Google Fonts injection function
- ~20 lines for image seed randomization
- Minor modifications to existing functions

