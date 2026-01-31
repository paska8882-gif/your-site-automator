// ============ BRANDING GENERATION MODULE ============
// Provides AI-generated logos via Gemini + diverse SVG template fallbacks

export interface BrandingConfig {
  siteName: string;
  topic?: string;
  primaryColor: string;
  accentColor: string;
  layoutStyle?: string;
}

export interface GeneratedBranding {
  logoSvg: string;
  faviconSvg: string;
  faviconIcoBase64: string;
  source: 'ai' | 'template';
}

// ============ 25+ SVG LOGO TEMPLATES ============
// Each template has a unique visual style for variety

type LogoTemplate = (config: {
  initials: string;
  siteName: string;
  primaryColor: string;
  accentColor: string;
}) => { logo: string; favicon: string };

const LOGO_TEMPLATES: LogoTemplate[] = [
  // 1. Classic rounded rectangle with gradient
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#g1)"/>
  <text x="32" y="41" text-anchor="middle" font-family="system-ui" font-size="26" font-weight="800" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#fg1)"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="26" font-weight="900" fill="#fff">${initials}</text>
</svg>`
  }),

  // 2. Circle with shadow
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><filter id="shadow2"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/></filter></defs>
  <circle cx="32" cy="32" r="28" fill="${primaryColor}" filter="url(#shadow2)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#1f2937">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="${primaryColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="24" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 3. Hexagon shape
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <polygon points="32,4 58,18 58,46 32,60 6,46 6,18" fill="url(#g3)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <polygon points="32,4 58,18 58,46 32,60 6,46 6,18" fill="url(#fg3)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 4. Diamond/rhombus
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect x="10" y="10" width="44" height="44" rx="4" fill="${primaryColor}" transform="rotate(45 32 32)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#1f2937">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="12" y="12" width="40" height="40" rx="4" fill="${primaryColor}" transform="rotate(45 32 32)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 5. Shield shape
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M32 4 L56 12 L56 36 Q56 52 32 60 Q8 52 8 36 L8 12 Z" fill="url(#g5)"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="800" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M32 4 L56 12 L56 36 Q56 54 32 62 Q8 54 8 36 L8 12 Z" fill="url(#fg5)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="800" fill="#fff">${initials}</text>
</svg>`
  }),

  // 6. Pill/capsule shape
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect x="4" y="12" width="56" height="40" rx="20" fill="${primaryColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#374151">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="8" y="16" width="48" height="32" rx="16" fill="${primaryColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 7. Square with corner accent
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect x="4" y="4" width="56" height="56" rx="8" fill="${primaryColor}"/>
  <rect x="4" y="4" width="20" height="20" rx="8" fill="${accentColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="6" y="6" width="52" height="52" rx="8" fill="${primaryColor}"/>
  <rect x="6" y="6" width="18" height="18" rx="8" fill="${accentColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 8. Stacked circles
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <circle cx="24" cy="32" r="22" fill="${accentColor}" opacity="0.6"/>
  <circle cx="40" cy="32" r="22" fill="${primaryColor}"/>
  <text x="40" y="40" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
  <text x="80" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="24" cy="32" r="22" fill="${accentColor}" opacity="0.6"/>
  <circle cx="40" cy="32" r="22" fill="${primaryColor}"/>
  <text x="40" y="40" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 9. Triangle pointing up
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <polygon points="32,6 58,58 6,58" fill="${primaryColor}"/>
  <text x="32" y="48" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#374151">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <polygon points="32,6 60,58 4,58" fill="${primaryColor}"/>
  <text x="32" y="48" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 10. Octagon
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g10" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <polygon points="20,4 44,4 60,20 60,44 44,60 20,60 4,44 4,20" fill="url(#g10)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg10" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <polygon points="20,4 44,4 60,20 60,44 44,60 20,60 4,44 4,20" fill="url(#fg10)"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 11. Split rectangle (two-tone)
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect x="4" y="4" width="56" height="56" rx="12" fill="${primaryColor}"/>
  <rect x="4" y="32" width="56" height="28" rx="0 0 12 12" fill="${accentColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="800" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="6" y="6" width="52" height="52" rx="10" fill="${primaryColor}"/>
  <rect x="6" y="32" width="52" height="26" rx="0 0 10 10" fill="${accentColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="800" fill="#fff">${initials}</text>
</svg>`
  }),

  // 12. Ring/donut
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <circle cx="32" cy="32" r="28" fill="none" stroke="${primaryColor}" stroke-width="6"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="${primaryColor}">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#374151">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="26" fill="none" stroke="${primaryColor}" stroke-width="6"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="${primaryColor}">${initials}</text>
</svg>`
  }),

  // 13. Squircle (super-ellipse)
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g13" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <rect x="4" y="4" width="56" height="56" rx="22" fill="url(#g13)"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="24" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#1f2937">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg13" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <rect x="6" y="6" width="52" height="52" rx="20" fill="url(#fg13)"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="24" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 14. Pentagon
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <polygon points="32,4 60,24 50,58 14,58 4,24" fill="${primaryColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <polygon points="32,4 62,26 50,60 14,60 2,26" fill="${primaryColor}"/>
  <text x="32" y="44" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 15. Bookmark shape
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g15" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M8 4 H56 V56 L32 44 L8 56 Z" fill="url(#g15)"/>
  <text x="32" y="34" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg15" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M10 4 H54 V58 L32 46 L10 58 Z" fill="url(#fg15)"/>
  <text x="32" y="36" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 16. Star shape
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <polygon points="32,4 38,24 60,24 42,38 48,58 32,46 16,58 22,38 4,24 26,24" fill="${primaryColor}"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="800" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <polygon points="32,4 40,26 62,26 44,40 50,62 32,48 14,62 20,40 2,26 24,26" fill="${primaryColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="800" fill="#fff">${initials}</text>
</svg>`
  }),

  // 17. Badge with border
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect x="4" y="4" width="56" height="56" rx="14" fill="${accentColor}"/>
  <rect x="8" y="8" width="48" height="48" rx="10" fill="${primaryColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#1f2937">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" rx="14" fill="${accentColor}"/>
  <rect x="8" y="8" width="48" height="48" rx="10" fill="${primaryColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 18. Diagonal split
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><clipPath id="clip18"><rect x="4" y="4" width="56" height="56" rx="12"/></clipPath></defs>
  <rect x="4" y="4" width="56" height="56" rx="12" fill="${primaryColor}"/>
  <polygon points="60,4 60,60 4,60" fill="${accentColor}" clip-path="url(#clip18)"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="800" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><clipPath id="fclip18"><rect x="6" y="6" width="52" height="52" rx="10"/></clipPath></defs>
  <rect x="6" y="6" width="52" height="52" rx="10" fill="${primaryColor}"/>
  <polygon points="58,6 58,58 6,58" fill="${accentColor}" clip-path="url(#fclip18)"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="800" fill="#fff">${initials}</text>
</svg>`
  }),

  // 19. Rounded square with inner circle
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <rect x="4" y="4" width="56" height="56" rx="14" fill="${primaryColor}"/>
  <circle cx="32" cy="32" r="20" fill="${accentColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="6" y="6" width="52" height="52" rx="12" fill="${primaryColor}"/>
  <circle cx="32" cy="32" r="18" fill="${accentColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 20. Arrow/chevron
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g20" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M4 4 L32 32 L4 60 L36 60 L64 32 L36 4 Z" fill="url(#g20)"/>
  <text x="28" y="40" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="700" fill="#fff">${initials}</text>
  <text x="80" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg20" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M4 4 L32 32 L4 60 L36 60 L64 32 L36 4 Z" fill="url(#fg20)"/>
  <text x="28" y="42" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 21. Cube/3D box
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <polygon points="32,8 56,20 56,44 32,56 8,44 8,20" fill="${primaryColor}"/>
  <polygon points="32,8 56,20 32,32 8,20" fill="${accentColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <polygon points="32,8 58,22 58,46 32,60 6,46 6,22" fill="${primaryColor}"/>
  <polygon points="32,8 58,22 32,34 6,22" fill="${accentColor}"/>
  <text x="32" y="46" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 22. Leaf/organic shape
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g22" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M32 4 Q60 4 60 32 Q60 60 32 60 Q4 60 4 32 Q4 4 32 4" fill="url(#g22)"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg22" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M32 4 Q62 4 62 32 Q62 62 32 62 Q4 62 4 32 Q4 4 32 4" fill="url(#fg22)"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui" font-size="24" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 23. Gear/cog shape
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <circle cx="32" cy="32" r="24" fill="${primaryColor}"/>
  <rect x="28" y="2" width="8" height="12" fill="${primaryColor}"/>
  <rect x="28" y="50" width="8" height="12" fill="${primaryColor}"/>
  <rect x="2" y="28" width="12" height="8" fill="${primaryColor}"/>
  <rect x="50" y="28" width="12" height="8" fill="${primaryColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="${primaryColor}"/>
  <rect x="28" y="4" width="8" height="10" fill="${primaryColor}"/>
  <rect x="28" y="50" width="8" height="10" fill="${primaryColor}"/>
  <rect x="4" y="28" width="10" height="8" fill="${primaryColor}"/>
  <rect x="50" y="28" width="10" height="8" fill="${primaryColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui" font-size="20" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 24. Cloud shape
  ({ initials, siteName, primaryColor, accentColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <defs><linearGradient id="g24" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M16 40 Q4 40 4 28 Q4 16 16 16 Q16 8 32 8 Q48 8 48 16 Q60 16 60 28 Q60 40 48 40 Z" fill="url(#g24)"/>
  <text x="32" y="32" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#111">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><linearGradient id="fg24" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primaryColor}"/><stop offset="1" stop-color="${accentColor}"/></linearGradient></defs>
  <path d="M18 46 Q4 46 4 32 Q4 18 18 18 Q18 6 32 6 Q46 6 46 18 Q60 18 60 32 Q60 46 46 46 Z" fill="url(#fg24)"/>
  <text x="32" y="36" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),

  // 25. Heart shape
  ({ initials, siteName, primaryColor }) => ({
    logo: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <path d="M32 58 Q4 32 18 14 Q32 4 32 18 Q32 4 46 14 Q60 32 32 58 Z" fill="${primaryColor}"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="700" fill="#fff">${initials}</text>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="600" fill="#374151">${siteName}</text>
</svg>`,
    favicon: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 58 Q0 28 18 12 Q32 0 32 16 Q32 0 46 12 Q64 28 32 58 Z" fill="${primaryColor}"/>
  <text x="32" y="38" text-anchor="middle" font-family="system-ui" font-size="16" font-weight="700" fill="#fff">${initials}</text>
</svg>`
  }),
];

// Map layout styles to preferred template indices
const STYLE_TEMPLATE_MAP: Record<string, number[]> = {
  classic: [0, 12, 5],       // Rectangle, squircle, shield
  corporate: [0, 6, 10],     // Rectangle, pill, octagon
  professional: [2, 5, 17],  // Hexagon, shield, badge
  executive: [5, 17, 15],    // Shield, badge, bookmark
  asymmetric: [3, 7, 18],    // Diamond, corner accent, diagonal
  editorial: [14, 15, 12],   // Pentagon, bookmark, squircle
  bold: [16, 9, 4],          // Star, triangle, diamond
  creative: [7, 8, 24],      // Corner accent, stacked circles, heart
  artistic: [22, 24, 8],     // Leaf, heart, stacked circles
  minimalist: [11, 1, 12],   // Ring, circle, squircle
  zen: [22, 1, 12],          // Leaf, circle, squircle
  clean: [0, 12, 6],         // Rectangle, squircle, pill
  whitespace: [11, 1, 12],   // Ring, circle, squircle
  showcase: [3, 20, 21],     // Diamond, arrow, cube
  interactive: [19, 2, 21],  // Inner circle, hexagon, cube
  animated: [20, 19, 8],     // Arrow, inner circle, stacked
  parallax: [21, 2, 10],     // Cube, hexagon, octagon
  saas: [12, 0, 6],          // Squircle, rectangle, pill
  startup: [20, 12, 3],      // Arrow, squircle, diamond
  tech: [2, 21, 23],         // Hexagon, cube, gear
  app: [12, 0, 6],           // Squircle, rectangle, pill
  gradient: [18, 13, 12],    // Diagonal, horizontal gradient, squircle
  brutalist: [6, 7, 11],     // Pill, corner accent, ring
  glassmorphism: [12, 1, 19], // Squircle, circle, inner circle
  neomorphism: [12, 0, 1],   // Squircle, rectangle, circle
  retro: [16, 9, 4],         // Star, triangle, diamond
  portfolio: [3, 18, 20],    // Diamond, diagonal, arrow
  agency: [20, 5, 17],       // Arrow, shield, badge
  studio: [15, 14, 5],       // Bookmark, pentagon, shield
  ecommerce: [6, 0, 12],     // Pill, rectangle, squircle
  services: [5, 17, 2],      // Shield, badge, hexagon
  restaurant: [22, 24, 8],   // Leaf, heart, stacked
  hotel: [17, 5, 12],        // Badge, shield, squircle
};

// Extract initials from site name
function getInitials(siteName: string): string {
  return siteName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "W";
}

// Generate template-based logo
function generateTemplateBasedBranding(config: BrandingConfig): { logoSvg: string; faviconSvg: string } {
  const initials = getInitials(config.siteName);
  const safeInitials = initials.replace(/[<>&"]/g, (c) => 
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
  const safeName = config.siteName.replace(/[<>&"]/g, (c) => 
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));

  // Get preferred templates for this layout style
  const preferredTemplates = STYLE_TEMPLATE_MAP[config.layoutStyle || ""] || [0, 1, 2];
  
  // Choose a random template from preferred ones
  const templateIndex = preferredTemplates[Math.floor(Math.random() * preferredTemplates.length)];
  const template = LOGO_TEMPLATES[templateIndex] || LOGO_TEMPLATES[0];

  const result = template({
    initials: safeInitials,
    siteName: safeName,
    primaryColor: config.primaryColor,
    accentColor: config.accentColor,
  });

  return {
    logoSvg: result.logo,
    faviconSvg: result.favicon,
  };
}

// Try AI-based logo generation via Gemini
async function tryAILogoGeneration(
  config: BrandingConfig,
  apiKey: string
): Promise<{ logoSvg: string; faviconSvg: string } | null> {
  try {
    const prompt = `Generate a simple, professional SVG logo icon for a company called "${config.siteName}". 
Topic/Industry: ${config.topic || "general business"}
Style: Modern, clean, minimal
Colors: Primary ${config.primaryColor}, Accent ${config.accentColor}

Requirements:
- Output ONLY the SVG code, no explanations
- Size: 64x64 viewBox
- Use only simple geometric shapes
- Include the company initials "${getInitials(config.siteName)}" if appropriate
- Make it suitable for both favicon and logo usage
- Use the exact colors provided`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "system", content: "You are an expert SVG logo designer. Create clean, minimal, professional logos." },
          { role: "user", content: prompt }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.log("[Branding] AI generation failed, status:", response.status);
      return null;
    }

    const data = await response.json();
    
    // Check if we got an image response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (imageUrl && imageUrl.startsWith("data:image/")) {
      // Convert PNG to simplified SVG with embedded image
      const initials = getInitials(config.siteName);
      const safeInitials = initials.replace(/[<>&"]/g, (c) => 
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
      const safeName = config.siteName.replace(/[<>&"]/g, (c) => 
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
      
      // Create SVG that embeds the generated image
      const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 64 64">
  <image width="64" height="64" xlink:href="${imageUrl}"/>
</svg>`;

      const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="64" viewBox="0 0 240 64">
  <image width="64" height="64" xlink:href="${imageUrl}"/>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#111827">${safeName}</text>
</svg>`;

      return { logoSvg, faviconSvg };
    }

    // If no image, check for SVG in text response
    const textContent = data.choices?.[0]?.message?.content;
    if (textContent) {
      // Try to extract SVG from response
      const svgMatch = textContent.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        const faviconSvg = svgMatch[0];
        const safeName = config.siteName.replace(/[<>&"]/g, (c) => 
          ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
        
        // Create logo with extracted favicon + text
        const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
  <g transform="translate(0, 0)">
    ${faviconSvg.replace(/<\?xml[^?]*\?>\s*/i, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
  </g>
  <text x="76" y="41" font-family="system-ui" font-size="18" font-weight="700" fill="#111827">${safeName}</text>
</svg>`;

        return { logoSvg, faviconSvg };
      }
    }

    return null;
  } catch (error) {
    console.log("[Branding] AI generation error:", error);
    return null;
  }
}

// Generate favicon.ico as base64
function generateFaviconIco(initials: string, primaryColor: string, accentColor: string): string {
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

  const w = 32;
  const h = 32;
  const pickChars = initials.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
  const chars = pickChars.length ? pickChars.split("") : ["W"];
  const pixels = new Uint8Array(w * h * 4);

  // Parse hex color to RGB
  const parseHex = (hex: string) => {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return match ? {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16)
    } : { r: 16, g: 185, b: 129 };
  };

  const c1 = parseHex(primaryColor);
  const c2 = parseHex(accentColor);

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

  // Rounded corners mask
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

  // Draw font
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
          for (let sx = 0; sx < scale; sx++) {
            setPx(ox + gx * scale + sx, startY + gy * scale + sy);
          }
        }
      }
    }
  });

  // AND mask
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

  // BITMAPINFOHEADER
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

  // ICO header
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
}

// Main function to generate branding
export async function generateBranding(
  config: BrandingConfig,
  apiKey?: string
): Promise<GeneratedBranding> {
  const initials = getInitials(config.siteName);
  let source: 'ai' | 'template' = 'template';
  let logoSvg: string;
  let faviconSvg: string;

  // Try AI generation first if API key is available
  if (apiKey) {
    console.log("[Branding] Attempting AI logo generation...");
    const aiResult = await tryAILogoGeneration(config, apiKey);
    if (aiResult) {
      console.log("[Branding] AI generation successful");
      logoSvg = aiResult.logoSvg;
      faviconSvg = aiResult.faviconSvg;
      source = 'ai';
    } else {
      console.log("[Branding] AI generation failed, using template fallback");
      const templateResult = generateTemplateBasedBranding(config);
      logoSvg = templateResult.logoSvg;
      faviconSvg = templateResult.faviconSvg;
    }
  } else {
    // No API key, use template directly
    console.log("[Branding] No API key, using template-based branding");
    const templateResult = generateTemplateBasedBranding(config);
    logoSvg = templateResult.logoSvg;
    faviconSvg = templateResult.faviconSvg;
  }

  // Generate favicon.ico
  const faviconIcoBase64 = generateFaviconIco(initials, config.primaryColor, config.accentColor);

  return {
    logoSvg,
    faviconSvg,
    faviconIcoBase64,
    source,
  };
}

// Synchronous version for when we can't use async (fallback only)
export function generateBrandingSync(config: BrandingConfig): GeneratedBranding {
  const templateResult = generateTemplateBasedBranding(config);
  const initials = getInitials(config.siteName);
  const faviconIcoBase64 = generateFaviconIco(initials, config.primaryColor, config.accentColor);

  return {
    logoSvg: templateResult.logoSvg,
    faviconSvg: templateResult.faviconSvg,
    faviconIcoBase64,
    source: 'template',
  };
}
