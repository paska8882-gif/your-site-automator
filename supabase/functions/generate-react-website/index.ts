import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Ти — створатор промптів для React сайтів. Твоя задача — проаналізувати запит і створити детальний промпт для генерації професійного React сайту.

**КРИТИЧНО ВАЖЛИВО: ВИЗНАЧЕННЯ МОВИ**
При визначенні мови керуйся наступними пріоритетами:
1. **Явне вказання в запиті** — якщо користувач явно вказав мову, використовуй ВКАЗАНУ мову
2. **Мова контенту** — якщо мова явно не вказана, аналізуй мову представленого контенту
3. **За замовчуванням** — якщо мову неможливо визначити, використовуй англійську (EN)

**ФОРМАТ ВИВОДУ:**
Створи детальний промпт для генерації React сайту з усіма необхідними компонентами та сторінками.`;

const REACT_GENERATION_PROMPT = `IMPORTANT: FOLLOW EXACT PROMPT STRUCTURE FOR REACT WEBSITE GENERATION

Create a COMPLETE, PROFESSIONAL React website with EXCELLENT design and ALL files.

**CRITICAL DEPLOYMENT REQUIREMENTS - GUARANTEED BUILD & DEPLOY:**

**MANDATORY FILES FOR GUARANTEED DEPLOYMENT:**

1. <!-- FILE: package.json -->
{
  "name": "[company-name]-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "react-scripts": "5.0.1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}

2. <!-- FILE: netlify.toml -->
[build]
  command = "npm run build"
  publish = "build/"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

3. <!-- FILE: vercel.json -->
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}

4. <!-- FILE: public/_redirects -->
/* /index.html 200

**CRITICAL BUILD GUARANTEE:**
- The EXACT package.json above MUST be used (tested and guaranteed)
- NO additional dependencies that could cause conflicts
- React-scripts 5.0.1 with React 18.2.0 - PROVEN compatibility
- The site MUST build with npm run build without errors
- Creates build/ folder with static files

**IMPORTANT IMAGE FIX - USE EXTERNAL URLS ONLY:**
- **USE ONLY EXTERNAL IMAGE URLs - NO LOCAL PATHS**
- All images must use full https:// URL
- No relative paths or image imports
- Use picsum.photos for placeholder images

**CRITICAL DESIGN REQUIREMENTS:**
- PERFECT responsive design - mobile-first approach
- Modern, clean header with sticky navigation
- Professional spacing and typography hierarchy
- Smooth animations and hover effects
- Perfectly aligned grid systems
- Balanced visual hierarchy

**ESSENTIAL FILES:**
- public/index.html
- src/index.js
- src/App.js (with React Router)
- Components: Header, Footer, CookieBanner, ScrollToTop
- Pages: Home, About, Services, Contact, Terms, Privacy
- src/styles/global.css (perfect responsive CSS)
- public/robots.txt
- public/sitemap.xml

**ADVANCED WEBSITE SECTIONS:**
- **Hero:** Compelling headline with animated CTA
- **Stats:** Achievement counters with animations
- **Services:** Interactive cards with hover effects
- **Process:** Step-by-step workflow visualization
- **Testimonials:** Carousel with customer quotes
- **Team:** Interactive team member profiles
- **Projects:** Filterable portfolio gallery
- **FAQ:** Accordion with common questions
- **Blog Preview:** Latest insights/updates
- **CTA Section:** Strong conversion-focused design

**PERFECT RESPONSIVE BREAKPOINTS:**
- Mobile: < 768px (perfect stacking)
- Tablet: 768px - 1024px (adaptive grids)
- Desktop: > 1024px (optimal multi-column)

**DYNAMIC IMAGES - EXTERNAL URLs ONLY:**
- **USE ONLY FULL HTTPS:// URLs FOR ALL IMAGES**
- **Hero:** https://picsum.photos/1600/900?random=1
- **Content:** https://picsum.photos/800/600?random=2
- **Team:** https://picsum.photos/400/400?random=3
- **Projects:** https://picsum.photos/1200/800?random=4
- **Logo:** Use text or simple SVG - NO image path
- **Services:** https://picsum.photos/600/400?random=5
- **Testimonials:** https://picsum.photos/200/200?random=6
- **Use unique random parameters for each image**
- **Professional alt text matching business context**
- **IMPORTANT: All <img> tags must use src="https://..." format**

**MODERN HEADER REQUIREMENTS:**
- Clean logo + navigation layout
- Sticky behavior with smooth scroll
- Mobile hamburger menu with smooth animation
- Active page highlighting
- Proper spacing and typography

**INTERACTIVE FEATURES:**
- Smooth scroll animations
- Hover effects on cards/buttons
- Loading states for external images
- Form validation with user feedback
- Mobile touch-friendly interactions

**PERFECT CSS STRUCTURE:**
- CSS Grid and Flexbox for layouts
- CSS variables for consistent theming
- Mobile-first responsive design
- Smooth transitions and animations
- Professional color scheme
- Perfect typography scale

**FORMAT:**
<!-- FILE: package.json -->
[EXACT content as above - with added browserslist]

<!-- FILE: netlify.toml -->
[EXACT content as above]

<!-- FILE: vercel.json -->
[EXACT content as above]

<!-- FILE: public/_redirects -->
/* /index.html 200

<!-- FILE: public/index.html -->
[complete file content]

<!-- FILE: src/index.js -->
[complete file content]

<!-- FILE: src/App.js -->
[complete file content with all routes]

<!-- FILE: src/components/Header.js -->
[perfect responsive header with mobile menu - USE TEXT LOGO]

<!-- FILE: src/components/Footer.js -->
[professional footer with columns]

<!-- FILE: src/components/CookieBanner.js -->
[styled cookie banner]

<!-- FILE: src/components/ScrollToTop.js -->
[smooth scroll component]

<!-- FILE: src/pages/Home.js -->
[complete home with all advanced sections - USE ONLY EXTERNAL IMAGE URLs]

<!-- FILE: src/pages/About.js -->
[detailed about page with team - USE ONLY EXTERNAL IMAGE URLs]

<!-- FILE: src/pages/Services.js -->
[interactive services showcase - USE ONLY EXTERNAL IMAGE URLs]

<!-- FILE: src/pages/Contact.js -->
[professional contact form]

<!-- FILE: src/pages/Terms.js -->
[terms of service page]

<!-- FILE: src/pages/Privacy.js -->
[privacy policy page]

<!-- FILE: src/styles/global.css -->
[perfect responsive CSS with animations]

<!-- FILE: public/robots.txt -->
[complete file content]

<!-- FILE: public/sitemap.xml -->
[complete file content]

**BUILD VERIFICATION:**
The generated site MUST pass these checks:
1. npm install completes without errors
2. npm run build creates build/ folder
3. **ALL images use EXTERNAL HTTPS:// URLs only**
4. No missing imports or dependencies
5. React Router configured correctly
6. **GUARANTEED: No "Module not found" errors for images**

Generate EXCELLENT, PROFESSIONAL code with PERFECT responsive design and GUARANTEED deployment on any platform.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('Request rejected: No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated request received');

    const { prompt, language, aiModel = 'senior' } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isJunior = aiModel === 'junior';
    console.log(`Using ${isJunior ? 'Junior AI (OpenAI GPT-4o)' : 'Senior AI (Lovable AI)'} for React generation`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (isJunior && !OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured for Junior AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isJunior && !LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable AI not configured for Senior AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating React website for prompt:', prompt.substring(0, 100));

    const apiUrl = isJunior 
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://ai.gateway.lovable.dev/v1/chat/completions';
    const apiKey = isJunior ? OPENAI_API_KEY : LOVABLE_API_KEY;
    const refineModel = isJunior ? 'gpt-4o-mini' : 'google/gemini-2.5-flash';
    const generateModel = isJunior ? 'gpt-4o' : 'google/gemini-2.5-pro';

    // Step 1: Generate refined prompt
    const agentResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: refineModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Створи детальний промпт для генерації React сайту на основі цього запиту:\n\n"${prompt}"\n\nМова контенту: ${language || 'auto-detect'}` }
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
    
    console.log('Refined prompt generated, now generating React website...');

    // Step 2: Generate the actual React website
    const websiteRequestBody: any = {
      model: generateModel,
      messages: [
        {
          role: 'system',
          content: 'You are a React code generator. Return ONLY file blocks using the exact markers like: <!-- FILE: src/App.js -->. No explanations, no markdown backticks around code. Generate complete, working React code.',
        },
        {
          role: 'user',
          content: REACT_GENERATION_PROMPT + '\n\nUser request:\n' + refinedPrompt,
        },
      ],
    };

    if (isJunior) {
      websiteRequestBody.max_tokens = 16000;
    }

    const websiteResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(websiteRequestBody),
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
    const rawText = websiteData.choices?.[0]?.message?.content || '';
    const normalizedText = rawText.replace(/\r\n/g, "\n");

    console.log('React website generated, parsing files...');
    console.log('Raw response length:', rawText.length);

    const cleanFileContent = (content: string) => {
      let c = content.trim();
      c = c.replace(/^```[a-z0-9_-]*\s*\n/i, "");
      c = c.replace(/\n```\s*$/i, "");
      return c.trim();
    };

    const filesMap = new Map<string, string>();

    const upsertFile = (path: string, content: string, source: string) => {
      const cleanPath = path.trim();
      const cleanContent = cleanFileContent(content);
      if (!cleanPath || cleanContent.length <= 10) return;
      filesMap.set(cleanPath, cleanContent);
      console.log(`✅ Found (${source}): ${cleanPath} (${cleanContent.length} chars)`);
    };

    // Format 1: <!-- FILE: filename -->
    const filePattern1 = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;
    let match;
    while ((match = filePattern1.exec(normalizedText)) !== null) {
      upsertFile(match[1], match[2], 'format1');
    }

    // Format 2: OpenAI markdown headings
    if (filesMap.size === 0) {
      console.log('Trying OpenAI markdown headings format...');

      const headers: { path: string; start: number; contentStart: number }[] = [];
      const headerRegex = /(^|\n)(?:###\s*(?:File:\s*)?(?:[A-Za-z]+\s*\()?\s*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\)?|\*\*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\*\*)/gi;

      while ((match = headerRegex.exec(normalizedText)) !== null) {
        const fileName = (match[2] || match[3] || '').trim();
        if (!fileName) continue;

        const afterHeader = match.index + match[0].length;
        const lineBreak = normalizedText.indexOf('\n', afterHeader);
        const contentStart = lineBreak === -1 ? normalizedText.length : lineBreak + 1;

        headers.push({ path: fileName, start: match.index, contentStart });
      }

      for (let i = 0; i < headers.length; i++) {
        const start = headers[i].contentStart;
        const end = headers[i + 1]?.start ?? normalizedText.length;
        const chunk = normalizedText.slice(start, end);
        upsertFile(headers[i].path, chunk, 'format2');
      }
    }

    const files = Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));

    console.log(`📁 Total files parsed: ${files.length}`);

    if (files.length === 0) {
      console.error('No files parsed from response');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to parse generated files',
          rawResponse: rawText.substring(0, 500),
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
        fileList: files.map((f) => f.path),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating React website:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
