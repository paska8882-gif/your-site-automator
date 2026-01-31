// ============ TYPOGRAPHY SYSTEM FOR LAYOUT STYLES ============
// Each layout style has unique font combinations for visual diversity

export interface Typography {
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  bodyWeight: string;
  headingStyle?: string;
  letterSpacing?: string;
  lineHeight: string;
  googleFontsUrl: string;
  fallback: string;
}

// Full typography configurations for all 30+ layout styles
export const STYLE_TYPOGRAPHY: Record<string, Typography> = {
  // Classic & Corporate
  classic: {
    headingFont: "Playfair Display",
    bodyFont: "Source Sans Pro",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Sans+Pro:wght@400;600&display=swap",
    fallback: "serif"
  },
  corporate: {
    headingFont: "Montserrat",
    bodyFont: "Open Sans",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "-0.02em",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&family=Open+Sans:wght@400;600&display=swap",
    fallback: "sans-serif"
  },
  professional: {
    headingFont: "Roboto Slab",
    bodyFont: "Roboto",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.65",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;600;700&family=Roboto:wght@400;500&display=swap",
    fallback: "serif"
  },
  executive: {
    headingFont: "Cinzel",
    bodyFont: "Lora",
    headingWeight: "600",
    bodyWeight: "400",
    headingStyle: "normal",
    letterSpacing: "0.05em",
    lineHeight: "1.8",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:wght@400;500;600&display=swap",
    fallback: "serif"
  },

  // Modern & Creative
  asymmetric: {
    headingFont: "Archivo Black",
    bodyFont: "Archivo",
    headingWeight: "400",
    bodyWeight: "400",
    letterSpacing: "-0.03em",
    lineHeight: "1.5",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600&display=swap",
    fallback: "sans-serif"
  },
  editorial: {
    headingFont: "Cormorant Garamond",
    bodyFont: "Libre Baskerville",
    headingWeight: "600",
    bodyWeight: "400",
    headingStyle: "italic",
    letterSpacing: "0.02em",
    lineHeight: "1.9",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,600&family=Libre+Baskerville:wght@400;700&display=swap",
    fallback: "serif"
  },
  bold: {
    headingFont: "Bebas Neue",
    bodyFont: "Barlow",
    headingWeight: "400",
    bodyWeight: "400",
    letterSpacing: "0.1em",
    lineHeight: "1.5",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600&display=swap",
    fallback: "sans-serif"
  },
  creative: {
    headingFont: "Caveat",
    bodyFont: "Poppins",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Poppins:wght@400;500;600&display=swap",
    fallback: "cursive"
  },
  artistic: {
    headingFont: "DM Serif Display",
    bodyFont: "Karla",
    headingWeight: "400",
    bodyWeight: "400",
    letterSpacing: "0.01em",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Karla:wght@400;500;600&display=swap",
    fallback: "serif"
  },

  // Minimalist
  minimalist: {
    headingFont: "Inter",
    bodyFont: "Inter",
    headingWeight: "300",
    bodyWeight: "400",
    letterSpacing: "-0.01em",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap",
    fallback: "sans-serif"
  },
  zen: {
    headingFont: "Cormorant",
    bodyFont: "Nunito Sans",
    headingWeight: "400",
    bodyWeight: "400",
    letterSpacing: "0.03em",
    lineHeight: "1.9",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600&family=Nunito+Sans:wght@400;600&display=swap",
    fallback: "serif"
  },
  clean: {
    headingFont: "Work Sans",
    bodyFont: "Work Sans",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap",
    fallback: "sans-serif"
  },
  whitespace: {
    headingFont: "Jost",
    bodyFont: "Jost",
    headingWeight: "500",
    bodyWeight: "400",
    letterSpacing: "0.02em",
    lineHeight: "1.8",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&display=swap",
    fallback: "sans-serif"
  },

  // Interactive
  showcase: {
    headingFont: "Syne",
    bodyFont: "Space Grotesk",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "-0.02em",
    lineHeight: "1.5",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@500;700;800&family=Space+Grotesk:wght@400;500&display=swap",
    fallback: "sans-serif"
  },
  interactive: {
    headingFont: "Plus Jakarta Sans",
    bodyFont: "Plus Jakarta Sans",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "-0.01em",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
    fallback: "sans-serif"
  },
  animated: {
    headingFont: "Outfit",
    bodyFont: "Outfit",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap",
    fallback: "sans-serif"
  },
  parallax: {
    headingFont: "Oswald",
    bodyFont: "Lato",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "0.05em",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=Lato:wght@400;700&display=swap",
    fallback: "sans-serif"
  },

  // Tech & SaaS
  saas: {
    headingFont: "Inter",
    bodyFont: "Inter",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "-0.02em",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    fallback: "sans-serif"
  },
  startup: {
    headingFont: "Manrope",
    bodyFont: "Manrope",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "-0.01em",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
    fallback: "sans-serif"
  },
  tech: {
    headingFont: "Space Grotesk",
    bodyFont: "IBM Plex Sans",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "-0.02em",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500&display=swap",
    fallback: "sans-serif"
  },
  app: {
    headingFont: "SF Pro Display",
    bodyFont: "SF Pro Text",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "-0.01em",
    lineHeight: "1.5",
    // SF Pro is Apple-specific, fallback to similar
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },

  // Modern effects
  gradient: {
    headingFont: "Clash Display",
    bodyFont: "Satoshi",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "-0.02em",
    lineHeight: "1.5",
    // Using alternatives since Clash/Satoshi require different hosting
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=DM+Sans:wght@400;500&display=swap",
    fallback: "sans-serif"
  },
  brutalist: {
    headingFont: "Space Grotesk",
    bodyFont: "JetBrains Mono",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "0",
    lineHeight: "1.4",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap",
    fallback: "monospace"
  },
  glassmorphism: {
    headingFont: "Poppins",
    bodyFont: "Poppins",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
    fallback: "sans-serif"
  },
  neomorphism: {
    headingFont: "Nunito",
    bodyFont: "Nunito",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap",
    fallback: "sans-serif"
  },
  retro: {
    headingFont: "Press Start 2P",
    bodyFont: "VT323",
    headingWeight: "400",
    bodyWeight: "400",
    letterSpacing: "0.05em",
    lineHeight: "1.8",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap",
    fallback: "monospace"
  },

  // Portfolio & Agency
  portfolio: {
    headingFont: "Sora",
    bodyFont: "DM Sans",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "-0.01em",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=DM+Sans:wght@400;500;700&display=swap",
    fallback: "sans-serif"
  },
  agency: {
    headingFont: "Clash Display",
    bodyFont: "Cabinet Grotesk",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "-0.02em",
    lineHeight: "1.5",
    // Using alternatives
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Work+Sans:wght@400;500&display=swap",
    fallback: "sans-serif"
  },
  studio: {
    headingFont: "Bodoni Moda",
    bodyFont: "Figtree",
    headingWeight: "600",
    bodyWeight: "400",
    headingStyle: "italic",
    letterSpacing: "0.02em",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,400;0,600;1,600&family=Figtree:wght@400;500;600&display=swap",
    fallback: "serif"
  },

  // Business & Services
  ecommerce: {
    headingFont: "Lexend",
    bodyFont: "Lexend",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "-0.01em",
    lineHeight: "1.6",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap",
    fallback: "sans-serif"
  },
  services: {
    headingFont: "Mulish",
    bodyFont: "Mulish",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800&display=swap",
    fallback: "sans-serif"
  },
  restaurant: {
    headingFont: "Playfair Display",
    bodyFont: "Raleway",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "0.02em",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Raleway:wght@400;500;600&display=swap",
    fallback: "serif"
  },
  hotel: {
    headingFont: "Cormorant Garamond",
    bodyFont: "Nunito Sans",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "0.03em",
    lineHeight: "1.8",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Nunito+Sans:wght@400;600&display=swap",
    fallback: "serif"
  },
  medical: {
    headingFont: "DM Sans",
    bodyFont: "DM Sans",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
    fallback: "sans-serif"
  },
  legal: {
    headingFont: "Merriweather",
    bodyFont: "Source Sans Pro",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.8",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Source+Sans+Pro:wght@400;600&display=swap",
    fallback: "serif"
  },
  education: {
    headingFont: "Lora",
    bodyFont: "Open Sans",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=Open+Sans:wght@400;600&display=swap",
    fallback: "serif"
  },
  nonprofit: {
    headingFont: "Bitter",
    bodyFont: "Public Sans",
    headingWeight: "700",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bitter:wght@400;600;700&family=Public+Sans:wght@400;500;600&display=swap",
    fallback: "serif"
  },
  realestate: {
    headingFont: "Prata",
    bodyFont: "Nunito",
    headingWeight: "400",
    bodyWeight: "400",
    letterSpacing: "0.02em",
    lineHeight: "1.7",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Prata&family=Nunito:wght@400;600;700&display=swap",
    fallback: "serif"
  },
  fitness: {
    headingFont: "Teko",
    bodyFont: "Roboto",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "0.05em",
    lineHeight: "1.5",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Roboto:wght@400;500&display=swap",
    fallback: "sans-serif"
  },
  photography: {
    headingFont: "Tenor Sans",
    bodyFont: "Crimson Pro",
    headingWeight: "400",
    bodyWeight: "400",
    letterSpacing: "0.1em",
    lineHeight: "1.8",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Tenor+Sans&family=Crimson+Pro:wght@400;500;600&display=swap",
    fallback: "serif"
  },
  blog: {
    headingFont: "Literata",
    bodyFont: "Source Serif Pro",
    headingWeight: "600",
    bodyWeight: "400",
    letterSpacing: "normal",
    lineHeight: "1.9",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Literata:wght@400;600;700&family=Source+Serif+Pro:wght@400;600&display=swap",
    fallback: "serif"
  }
};

// Default typography for styles not explicitly defined
export const DEFAULT_TYPOGRAPHY: Typography = {
  headingFont: "Inter",
  bodyFont: "Inter",
  headingWeight: "600",
  bodyWeight: "400",
  letterSpacing: "normal",
  lineHeight: "1.6",
  googleFontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  fallback: "sans-serif"
};

// Get typography for a specific style ID
export function getTypographyForStyle(styleId: string): Typography {
  return STYLE_TYPOGRAPHY[styleId] || DEFAULT_TYPOGRAPHY;
}

// Generate CSS variables for typography
export function generateTypographyCSSVariables(typography: Typography): string {
  return `
  /* Typography CSS Variables */
  :root {
    --font-heading: '${typography.headingFont}', ${typography.fallback};
    --font-body: '${typography.bodyFont}', ${typography.fallback};
    --heading-weight: ${typography.headingWeight};
    --body-weight: ${typography.bodyWeight};
    --heading-letter-spacing: ${typography.letterSpacing || 'normal'};
    --body-line-height: ${typography.lineHeight};
    ${typography.headingStyle ? `--heading-style: ${typography.headingStyle};` : ''}
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading);
    font-weight: var(--heading-weight);
    letter-spacing: var(--heading-letter-spacing);
    ${typography.headingStyle ? `font-style: var(--heading-style);` : ''}
  }

  body, p, li, td, th, span, a, label, input, textarea, button, select {
    font-family: var(--font-body);
    font-weight: var(--body-weight);
    line-height: var(--body-line-height);
  }
`;
}

// Generate mandatory typography prompt section for AI
export function generateTypographyPromptSection(typography: Typography, styleName: string): string {
  return `
⚠️⚠️⚠️ MANDATORY TYPOGRAPHY - NON-NEGOTIABLE! ⚠️⚠️⚠️

LAYOUT STYLE: "${styleName}"

═══════════════════════════════════════════════════════════════════
🔤 FONT REQUIREMENTS - YOU MUST USE THESE EXACT FONTS:
═══════════════════════════════════════════════════════════════════

HEADING FONT: ${typography.headingFont} (Google Fonts)
BODY FONT: ${typography.bodyFont} (Google Fonts)

REQUIRED GOOGLE FONTS IMPORT (ADD TO <head> OF EVERY HTML PAGE):
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${typography.googleFontsUrl}" rel="stylesheet">

═══════════════════════════════════════════════════════════════════
🎨 TYPOGRAPHY CSS - APPLY THESE STYLES:
═══════════════════════════════════════════════════════════════════

h1, h2, h3, h4, h5, h6 {
  font-family: '${typography.headingFont}', ${typography.fallback};
  font-weight: ${typography.headingWeight};
  ${typography.letterSpacing !== 'normal' ? `letter-spacing: ${typography.letterSpacing};` : ''}
  ${typography.headingStyle ? `font-style: ${typography.headingStyle};` : ''}
}

body, p, li, a, span, td, input, textarea, button {
  font-family: '${typography.bodyFont}', ${typography.fallback};
  font-weight: ${typography.bodyWeight};
  line-height: ${typography.lineHeight};
}

═══════════════════════════════════════════════════════════════════
⛔ TYPOGRAPHY RULES - DO NOT VIOLATE:
═══════════════════════════════════════════════════════════════════

- DO NOT use Arial, Helvetica, Times New Roman, or system fonts!
- DO NOT skip the Google Fonts import!
- DO NOT use different fonts than specified!
- DO NOT use generic sans-serif or serif without the proper font-family first!
- EVERY page MUST have the Google Fonts link in <head>!

`;
}
