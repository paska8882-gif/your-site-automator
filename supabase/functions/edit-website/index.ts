import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratedFile {
  path: string;
  content: string;
}

const EDIT_SYSTEM_PROMPT = `You are an expert website editor. Your job is to modify existing website files based on user requests.

CRITICAL RULES:
1. Make ONLY the specific change requested - NOTHING ELSE
2. DO NOT modify anything that wasn't explicitly asked to change
3. Keep ALL other content, styles, images, and structure EXACTLY as they are
4. Return ALL files (modified and unmodified) in exact same format

OUTPUT FORMAT:
<!-- FILE: filename.ext -->
<file content here>
<!-- FILE: another.ext -->
<content>

IMPORTANT:
- Return complete file contents, not snippets
- Do not use markdown code blocks
- Use ONLY the <!-- FILE: --> markers
- If user asks to change button color - change ONLY that button's color
- If user asks to change text - change ONLY that text
- DO NOT change images unless specifically asked
- DO NOT change layout unless specifically asked
- DO NOT add or remove features unless specifically asked`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { generationId, editRequest, currentFiles, aiModel, websiteType, originalPrompt } = body;

    if (!generationId || !editRequest || !currentFiles || currentFiles.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Edit request for generation ${generationId}: ${editRequest}`);
    console.log(`AI Model: ${aiModel}, Website Type: ${websiteType}`);
    console.log(`Current files: ${currentFiles.map((f: GeneratedFile) => f.path).join(", ")}`);

    // Build context with current files
    const filesContext = currentFiles
      .map((f: GeneratedFile) => `<!-- FILE: ${f.path} -->\n${f.content}`)
      .join("\n\n");

    // Simpler prompt focused ONLY on current edit request
    const editPrompt = `CURRENT WEBSITE FILES:
${filesContext}

USER REQUEST: ${editRequest}

IMPORTANT: Make ONLY this specific change. Do NOT modify anything else. Return all files.`;

    let response;
    
    if (aiModel === "senior") {
      // Use Lovable AI (Gemini)
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableApiKey) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

      console.log("Using Senior AI (Lovable/Gemini)");
      
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: EDIT_SYSTEM_PROMPT },
            { role: "user", content: editPrompt },
          ],
          max_tokens: 32000,
          temperature: 0.7,
        }),
      });
    } else {
      // Use OpenAI (Junior)
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      console.log("Using Junior AI (OpenAI)");

      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: EDIT_SYSTEM_PROMPT },
            { role: "user", content: editPrompt },
          ],
          max_tokens: 16000,
          temperature: 0.7,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response length:", content.length);

    // Parse files from response
    const fileMatches = content.matchAll(/<!--\s*FILE:\s*([^\s->]+)\s*-->([\s\S]*?)(?=<!--\s*FILE:|$)/gi);
    const updatedFiles: GeneratedFile[] = [];

    for (const match of fileMatches) {
      const path = match[1].trim();
      let fileContent = match[2].trim();

      // Clean up content
      fileContent = fileContent.replace(/^```[\w]*\n?/gm, "").replace(/\n?```$/gm, "").trim();

      if (path && fileContent) {
        updatedFiles.push({ path, content: fileContent });
        console.log(`Parsed file: ${path} (${fileContent.length} chars)`);
      }
    }

    if (updatedFiles.length === 0) {
      console.error("No files parsed from response. Content preview:", content.substring(0, 500));
      throw new Error("Failed to parse edited files from AI response");
    }

    // Create ZIP
    const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
    const zip = new JSZip();
    updatedFiles.forEach((file) => zip.file(file.path, file.content));
    const zipBase64 = await zip.generateAsync({ type: "base64" });

    // Update database
    const { error: updateError } = await supabase
      .from("generation_history")
      .update({
        files_data: updatedFiles,
        zip_data: zipBase64,
      })
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Failed to save changes");
    }

    console.log(`Successfully updated generation ${generationId} with ${updatedFiles.length} files`);

    return new Response(
      JSON.stringify({
        success: true,
        files: updatedFiles,
        message: `Застосовано зміни до ${updatedFiles.length} файлів`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edit error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
