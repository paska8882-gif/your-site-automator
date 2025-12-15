import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Ти — створатор промптів для многосторінкових сайтів. Твоя задача — проаналізувати запит і створити промпт для генерації професійного многосторінкового сайту.

**КРИТИЧНО ВАЖЛИВО: ВИЗНАЧЕННЯ МОВИ**
При визначенні мови керуйся наступними пріоритетами:
1. **Явне вказання в запиті** — якщо користувач явно вказав мову, використовуй ВКАЗАНУ мову
2. **Мова контенту** — якщо мова явно не вказана, аналізуй мову представленого контенту
3. **За замовчуванням** — якщо мову неможливо визначити, використовуй англійську (EN)

**ФОРМАТ ВИВОДУ:**
Створи професійний БАГАТОСТОРІНКОВИЙ сайт з повною структурою.`;

const WEBSITE_GENERATION_PROMPT = `CRITICAL: CREATE EXCEPTIONAL MULTI-PAGE WEBSITE WITH 10X BETTER UI AND STATIC HEADER/FOOTER

**DESIGN PHILOSOPHY - 10X BETTER UI:**
🚀 **Start with FUNCTIONAL and BEAUTIFUL base UI** - Every pixel must serve a purpose
🎯 **Always make 10X better UI than standard** - Go beyond expectations
✨ **Use advanced CSS patterns** - CSS Grid, Flexbox, custom properties, clamp()
📈 **Add visual hierarchy incrementally** - Build up from solid foundation
🎨 **Think like a product designer** - Focus on user experience first

**CRITICAL REQUIREMENT: STATIC HEADER AND FOOTER ACROSS ALL PAGES**
⚠️ **HEADER/FOOTER MUST BE IDENTICAL ON EVERY PAGE**
- **Same structure, same navigation items, same positioning**
- **Navigation links must point to correct corresponding pages**
- **Active page indicator should update based on current page**
- **Logo, menu items, CTAs remain in identical positions**
- **Footer content, layout, and styling must be identical**

**VISUAL EXCELLENCE GUIDELINES:**
- **Whitespace is king** - Generous spacing (1.5x standard)
- **Clean typography system** - Hierarchy: H1 > H2 > H3 > Body > Small
- **Strategic color use** - 60% primary, 30% secondary, 10% accent
- **Consistent spacing scale** - 4px, 8px, 16px, 24px, 32px, 48px, 64px
- **Subtle depth** - Minimal shadows, clean borders
- **Smooth transitions** - 300ms ease-in-out for interactions

**MODERN CSS TECHNIQUES:**
- CSS Grid for main layouts
- Flexbox for components
- CSS Custom Properties for theming
- clamp() for fluid typography
- aspect-ratio for responsive media
- gap instead of margins where possible
- min-height: 100vh for full-height sections
- position: sticky for navigation

**IMAGE STRATEGY - CONTEXT AWARE:**
- **Images MUST match page content** - Relevant to subject
- Use picsum.photos for placeholder images
- https://picsum.photos/800/600?random=hero (hero)
- https://picsum.photos/600/400?random=business (business)
- https://picsum.photos/400/400?random=team (team)

**PERFORMANCE + BEAUTY:**
- **CSS under 500 lines** but exceptionally crafted
- **MAX 3 images per page** - each perfectly chosen
- **Lazy loading** with loading="lazy"
- **Semantic HTML** - accessibility built-in

**MOBILE-FIRST BREAKPOINTS:**
/* Mobile (default) */
/* Tablet: 768px */
@media (min-width: 768px) { ... }
/* Desktop: 1024px */
@media (min-width: 1024px) { ... }

**COOKIE BANNER - DESIGN INTEGRATED:**
- Subtle, non-intrusive design
- Matches site color scheme
- Clear Accept/Decline buttons
- Smooth appear animation

**OUTPUT FORMAT:**
<!-- FILE: styles.css -->
[Complete CSS with header/footer styles and active page states]

<!-- FILE: index.html -->
[Exceptional HTML with STATIC header/footer]

<!-- FILE: services.html -->
[SAME header/footer, unique content]

<!-- FILE: about.html -->
[SAME header/footer, professional about content]

<!-- FILE: contact.html -->
[SAME header/footer, clean contact page]

<!-- FILE: terms.html -->
[SAME header/footer, well-formatted legal page]

<!-- FILE: privacy.html -->
[SAME header/footer, clean privacy policy]

<!-- FILE: 404.html -->
[SAME header/footer, helpful error page]

<!-- FILE: robots.txt -->
User-agent: *
Allow: /

<!-- FILE: sitemap.xml -->
[Complete sitemap]

**IMPORTANT:** Header and footer HTML structure MUST be identical across all HTML files. Only update the 'active' class on navigation links to indicate current page.

Generate EXCEPTIONAL multi-page website with 10X better UI, STATIC identical header/footer across all pages, perfect imagery matching content, and outstanding user experience. All styles MUST render correctly in browser, NO markdown code blocks, NO \`\`\`html at beginning of files.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, language } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating website for prompt:', prompt.substring(0, 100));

    // Step 1: Generate refined prompt using AI Agent
    const agentResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Створи ОДИН промпт для генерації статичного HTML/CSS/JS сайту на основі цього запиту:\n\n"${prompt}"\n\nМова: ${language || 'auto-detect'}` }
        ],
      }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('Agent AI error:', agentResponse.status, errorText);
      
      if (agentResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (agentResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI agent error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentData = await agentResponse.json();
    const refinedPrompt = agentData.choices?.[0]?.message?.content || prompt;
    
    console.log('Refined prompt generated, now generating website...');

    // Step 2: Generate the actual website
    const websiteResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { 
            role: 'user', 
            content: WEBSITE_GENERATION_PROMPT + '\n\n' + refinedPrompt 
          }
        ],
      }),
    });

    if (!websiteResponse.ok) {
      const errorText = await websiteResponse.text();
      console.error('Website generation error:', websiteResponse.status, errorText);
      
      if (websiteResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (websiteResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Website generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const websiteData = await websiteResponse.json();
    const responseText = websiteData.choices?.[0]?.message?.content || '';

    console.log('Website generated, parsing files...');

    // Parse files from response
    const files: { path: string; content: string }[] = [];
    const filePattern = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;

    let match;
    while ((match = filePattern.exec(responseText)) !== null) {
      const fileName = match[1].trim();
      let fileContent = match[2].trim();
      
      if (fileContent && fileContent.length > 10) {
        files.push({
          path: fileName,
          content: fileContent
        });
        console.log(`✅ Found: ${fileName} (${fileContent.length} chars)`);
      }
    }

    console.log(`📁 Total files parsed: ${files.length}`);

    if (files.length === 0) {
      console.error('No files parsed from response');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse generated files',
          rawResponse: responseText.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        files,
        refinedPrompt,
        totalFiles: files.length,
        fileList: files.map(f => f.path)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating website:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
