import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// VIP prompt template with placeholders
const VIP_TEMPLATE = `Domain: {domain}

Name: {siteName}

Geo: {geo}

Language: {language}

Address: {address}

Phone: {phone}

Topic: {topic}

Type: Information Platform + {typeDescription}

Description: {description}

Keywords: {keywords}

Banned words: {bannedWords}

{pageStructure}

{design}

Technology: HTML5 / CSS3 / Vanilla JS; responsive; semantic markup; JSON-LD schema; meta tags; hreflang={hreflang}; sitemap.xml + robots.txt`;

// Generate page structure based on topic
async function generatePageStructure(topic: string, siteName: string, apiKey: string): Promise<string> {
  const prompt = `Based on the topic "${topic}" for a website called "${siteName}", generate a detailed page structure.

RULES:
1. Generate 7-10 pages total
2. Each page should have 4-6 unique sections
3. Include: home, about/services, articles (with 3 sub-pages), contact, terms, privacy
4. Make sections specific to the topic, not generic
5. Articles page should link to 3 specific article pages

FORMAT exactly like this:
Page Structure (unique)

home.html — Hero ("{siteName} — [Catchy tagline]"); Section 1: [specific section]; Section 2: [specific section]; Section 3: [specific section]; Section 4: [specific section]; Section 5: Newsletter

[page2].html — Hero; Section 1: [specific]; Section 2: [specific]; Section 3: [specific]; Section 4: [specific]

[continue for all pages...]

articles.html — Hero; Section 1: Topics ([topic1], [topic2], [topic3]); Section 2: Featured Articles (6). Pages: [article1].html, [article2].html, [article3].html

contact.html — Hero; Section 1: Inquiry Form; Section 2: Office Location (map); Section 3: Feedback

terms.html — Terms of Service with EXACTLY 14 sections: 1. Acceptance of Terms; 2. Definitions; 3. User Eligibility; 4. Account Registration and Security; 5. Permitted Use of Services; 6. Prohibited Activities; 7. Intellectual Property Rights; 8. User-Generated Content; 9. Third-Party Links and Services; 10. Disclaimers and Limitation of Liability; 11. Indemnification; 12. Termination; 13. Governing Law and Dispute Resolution; 14. Contact Information and Notices

privacy.html — Privacy Policy with 10+ sections: 1. Introduction; 2. Data Controller Contact; 3. Types of Data Collected; 4. Purpose of Processing; 5. Legal Basis; 6. Data Retention; 7. Data Sharing; 8. International Transfers; 9. User Rights; 10. Cookie Policy Reference; 11. Security Measures; 12. Policy Changes

cookie-policy.html — Cookie Policy with: 1. What are cookies; 2. Why we use cookies; 3. Types of cookies; 4. COOKIES TABLE (Cookie Name, Provider, Purpose, Expiry, Type) with 6-10 entries; 5. How to manage cookies; 6. Contact info

Return ONLY the page structure, nothing else.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a website structure expert. Generate detailed, topic-specific page structures." },
        { role: "user", content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    console.error("Failed to generate page structure:", await response.text());
    throw new Error("Failed to generate page structure");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Generate design based on topic
async function generateDesign(topic: string, apiKey: string): Promise<string> {
  const prompt = `Based on the topic "${topic}", generate a complete design specification for a website.

RULES:
1. Style should match the topic (e.g., gaming = energetic, law = professional, etc.)
2. Colors must be 4 HEX codes that work together
3. Fonts: 1 display font for titles, 1 body font, optionally 1 mono font for code/specs
4. Layout should be specific and detailed
5. Images description should match the topic
6. Mood should be 3-4 descriptive words

FORMAT exactly like this:
Design

Style: [Descriptive style matching the topic, e.g., "Modern gaming aesthetic with screenshots, controller icons, and pixel art accents"]

Colors: #[hex1], #[hex2], #[hex3], #[hex4]

Fonts: [Display font] (titles), [Body font] (body), [Optional mono font] (specs)

Layout: [Detailed layout description, e.g., "Dynamic grid, genre filters, interactive rating widgets"]

Images: [Specific image types for this topic, e.g., "Game covers, gameplay screenshots, player avatars, esports events"]

Mood: [3-4 mood words, e.g., "Energetic, social, collaborative"]

Return ONLY the design specification, nothing else.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a web designer expert. Generate cohesive, topic-appropriate design specifications." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    console.error("Failed to generate design:", await response.text());
    throw new Error("Failed to generate design");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Generate type description based on topic
function getTypeDescription(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes("game") || topicLower.includes("gaming")) {
    return "Review & Community Hub";
  } else if (topicLower.includes("law") || topicLower.includes("legal")) {
    return "Legal Services Portal";
  } else if (topicLower.includes("health") || topicLower.includes("medical")) {
    return "Healthcare Information Center";
  } else if (topicLower.includes("food") || topicLower.includes("restaurant")) {
    return "Culinary & Dining Guide";
  } else if (topicLower.includes("travel") || topicLower.includes("tourism")) {
    return "Travel & Adventure Hub";
  } else if (topicLower.includes("tech") || topicLower.includes("software")) {
    return "Technology Resource Center";
  } else if (topicLower.includes("education") || topicLower.includes("learning")) {
    return "Educational Resource Platform";
  } else if (topicLower.includes("finance") || topicLower.includes("banking")) {
    return "Financial Services Portal";
  } else if (topicLower.includes("real estate") || topicLower.includes("property")) {
    return "Property Listings & Guide";
  } else if (topicLower.includes("fitness") || topicLower.includes("gym") || topicLower.includes("sport")) {
    return "Fitness & Wellness Hub";
  }
  
  return "Information & Resource Hub";
}

// Get hreflang code from language and geo
function getHreflang(language: string, geo: string): string {
  const langCode = language.toLowerCase().slice(0, 2);
  const geoCode = geo.toLowerCase().slice(0, 2);
  return `${langCode}-${geoCode.toUpperCase()}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      domain,
      siteName,
      geo,
      language,
      address,
      phone,
      topic,
      description,
      keywords,
      bannedWords,
    } = await req.json();

    // Validate required fields
    if (!domain || !siteName || !address || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: domain, siteName, address, phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract topic from description if not provided
    const topicToUse = topic || description?.split(/[.,!?]/)[0]?.trim() || "General Business";
    
    // Generate page structure and design in parallel
    const [pageStructure, design] = await Promise.all([
      generatePageStructure(topicToUse, siteName, LOVABLE_API_KEY),
      generateDesign(topicToUse, LOVABLE_API_KEY),
    ]);

    // Build the final VIP prompt
    const vipPrompt = VIP_TEMPLATE
      .replace("{domain}", domain)
      .replace("{siteName}", siteName)
      .replace("{geo}", geo || "International")
      .replace("{language}", language || "English")
      .replace("{address}", address)
      .replace("{phone}", phone)
      .replace("{topic}", topicToUse)
      .replace("{typeDescription}", getTypeDescription(topicToUse))
      .replace("{description}", description || `${siteName} is a platform dedicated to ${topicToUse.toLowerCase()}.`)
      .replace("{keywords}", keywords || topicToUse.toLowerCase().split(" ").join(", "))
      .replace("{bannedWords}", bannedWords || "crypto, free, miracle, health, profit, investment, quick gain, earnings, money, price, cost, guarantee, exclusive, top, bonus, 100%, risk-free")
      .replace("{pageStructure}", pageStructure)
      .replace("{design}", design)
      .replace("{hreflang}", getHreflang(language || "en", geo || "us"));

    return new Response(
      JSON.stringify({ vipPrompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating VIP prompt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
