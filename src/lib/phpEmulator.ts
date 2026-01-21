/**
 * PHP Emulator - client-side parsing of PHP files for preview
 * Supports: includes, config constants, echo, date(), loops, arrays, conditions
 */

import { GeneratedFile } from "./websiteGenerator";
import { processHtmlForPreview } from "@/lib/inlineAssets";

export interface PhpEmulatorContext {
  files: GeneratedFile[];
  currentPath: string;
  variables: Record<string, string | string[]>;
  constants: Record<string, string>;
  processedIncludes: Set<string>; // Prevent infinite recursion
}

export interface LinkCheckResult {
  href: string;
  exists: boolean;
  isExternal: boolean;
  sourceFile: string;
}

export interface PhpPreviewResult {
  html: string;
  pageTitle: string;
  brokenLinks: LinkCheckResult[];
  warnings: string[];
}

/** Parse config.php and extract constants and variables */
function parseConfig(content: string): { constants: Record<string, string>; variables: Record<string, string> } {
  const constants: Record<string, string> = {};
  const variables: Record<string, string> = {};
  
  // Match define('CONST_NAME', 'value'); or define("CONST_NAME", "value");
  const defineRegex = /define\s*\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g;
  let match;
  while ((match = defineRegex.exec(content)) !== null) {
    constants[match[1]] = match[2];
  }
  
  // Match $variable = 'value'; or $variable = "value";
  const varRegex = /\$(\w+)\s*=\s*['"]([^'"]*)['"]\s*;/g;
  while ((match = varRegex.exec(content)) !== null) {
    variables[match[1]] = match[2];
  }
  
  return { constants, variables };
}

/** Find a file by path (handles relative paths) */
function findFile(files: GeneratedFile[], relativePath: string, currentDir: string): GeneratedFile | null {
  // Normalize path
  let targetPath = relativePath.replace(/^\.\//, "").replace(/^\//, "");
  
  // Try direct match first
  let found = files.find(f => f.path === targetPath);
  if (found) return found;
  
  // Try with current directory prefix
  if (currentDir) {
    const fullPath = currentDir + "/" + targetPath;
    found = files.find(f => f.path === fullPath);
    if (found) return found;
  }
  
  // Try common prefixes
  const prefixes = ["includes/", "inc/", "partials/", ""];
  for (const prefix of prefixes) {
    found = files.find(f => f.path === prefix + targetPath);
    if (found) return found;
  }
  
  return null;
}

/** Process PHP date() function with full format support */
function processDateFunction(content: string): string {
  const now = new Date();
  
  return content.replace(/date\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (_, format: string) => {
    return format
      .replace(/Y/g, now.getFullYear().toString())
      .replace(/y/g, (now.getFullYear() % 100).toString().padStart(2, "0"))
      .replace(/m/g, (now.getMonth() + 1).toString().padStart(2, "0"))
      .replace(/n/g, (now.getMonth() + 1).toString())
      .replace(/d/g, now.getDate().toString().padStart(2, "0"))
      .replace(/j/g, now.getDate().toString())
      .replace(/D/g, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()])
      .replace(/l/g, ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()])
      .replace(/F/g, ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][now.getMonth()])
      .replace(/M/g, ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()])
      .replace(/H/g, now.getHours().toString().padStart(2, "0"))
      .replace(/G/g, now.getHours().toString())
      .replace(/i/g, now.getMinutes().toString().padStart(2, "0"))
      .replace(/s/g, now.getSeconds().toString().padStart(2, "0"))
      .replace(/A/g, now.getHours() >= 12 ? "PM" : "AM")
      .replace(/a/g, now.getHours() >= 12 ? "pm" : "am");
  });
}

/** Parse PHP array syntax and return as JS object/array */
function parsePhpArray(content: string): Record<string, string> | string[] | null {
  // Match array('key' => 'value', ...) or ['key' => 'value', ...]
  const arrayMatch = content.match(/(?:array\s*\(|\[)\s*([\s\S]*?)\s*(?:\)|\])/);
  if (!arrayMatch) return null;
  
  const inner = arrayMatch[1];
  const result: Record<string, string> = {};
  const items: string[] = [];
  
  // Try key => value pairs first
  const pairRegex = /['"]([^'"]+)['"]\s*=>\s*['"]([^'"]+)['"]/g;
  let match;
  let hasKeys = false;
  
  while ((match = pairRegex.exec(inner)) !== null) {
    result[match[1]] = match[2];
    hasKeys = true;
  }
  
  if (hasKeys) return result;
  
  // Try simple array values
  const valueRegex = /['"]([^'"]+)['"]/g;
  while ((match = valueRegex.exec(inner)) !== null) {
    items.push(match[1]);
  }
  
  return items.length > 0 ? items : null;
}

/** Process foreach loops and generate HTML */
function processForeachLoops(content: string, ctx: PhpEmulatorContext): string {
  // Match foreach($array as $key => $value) or foreach($array as $item)
  const foreachRegex = /<\?php\s*foreach\s*\(\s*\$(\w+)\s+as\s+(?:\$(\w+)\s*=>\s*)?\$(\w+)\s*\)\s*:\s*\?>([\s\S]*?)<\?php\s*endforeach\s*;?\s*\?>/gi;
  
  return content.replace(foreachRegex, (_, arrayName, keyVar, valueVar, body) => {
    const array = ctx.variables[arrayName];
    if (!array) return ""; // Array not found
    
    let output = "";
    
    if (Array.isArray(array)) {
      array.forEach((value, index) => {
        let itemHtml = body;
        if (keyVar) {
          itemHtml = itemHtml.replace(new RegExp(`\\$${keyVar}`, "g"), index.toString());
        }
        itemHtml = itemHtml.replace(new RegExp(`\\$${valueVar}`, "g"), value);
        output += itemHtml;
      });
    } else if (typeof array === "object") {
      Object.entries(array).forEach(([key, value]) => {
        let itemHtml = body;
        if (keyVar) {
          itemHtml = itemHtml.replace(new RegExp(`\\$${keyVar}`, "g"), key);
        }
        itemHtml = itemHtml.replace(new RegExp(`\\$${valueVar}`, "g"), value as string);
        output += itemHtml;
      });
    }
    
    return output;
  });
}

/** Process if/else conditions (simplified - always shows truthy branch for preview) */
function processConditions(content: string): string {
  let result = content;
  
  // Remove if/endif blocks - show content (for preview, assume conditions are true)
  result = result.replace(/<\?php\s+if\s*\([^)]+\)\s*:\s*\?>/gi, "");
  result = result.replace(/<\?php\s+endif\s*;?\s*\?>/gi, "");
  result = result.replace(/<\?php\s+else\s*:\s*\?>/gi, "<!-- else branch hidden -->");
  result = result.replace(/<\?php\s+elseif\s*\([^)]+\)\s*:\s*\?>/gi, "");
  
  return result;
}

/** Process echo statements and variable substitutions */
function processEchoAndVariables(content: string, ctx: PhpEmulatorContext): string {
  let result = content;
  
  // Process date() first
  result = processDateFunction(result);
  
  // Replace constants in echo statements
  Object.entries(ctx.constants).forEach(([name, value]) => {
    // echo CONSTANT
    result = result.replace(new RegExp(`echo\\s+${name}\\s*;?`, "g"), value);
    // Direct constant reference
    result = result.replace(new RegExp(`(?<!\\w)${name}(?!\\w)`, "g"), value);
  });
  
  // Replace variables
  Object.entries(ctx.variables).forEach(([name, value]) => {
    if (typeof value === "string") {
      // echo $variable
      result = result.replace(new RegExp(`echo\\s+\\$${name}\\s*;?`, "g"), value);
      // $variable in strings
      result = result.replace(new RegExp(`\\$\\{?${name}\\}?`, "g"), value);
    }
  });
  
  // Process simple echo with string literals
  result = result.replace(/echo\s+['"]([^'"]*)['"]\s*;?/g, "$1");
  
  // Process echo with concatenation: echo 'text' . $var . 'more';
  result = result.replace(/echo\s+([^;]+);/g, (_, expr: string) => {
    // Simple concatenation handling
    return expr
      .split(/\s*\.\s*/)
      .map(part => {
        part = part.trim();
        if (part.startsWith("'") || part.startsWith('"')) {
          return part.slice(1, -1);
        }
        if (part.startsWith("$")) {
          const varName = part.slice(1);
          const val = ctx.variables[varName];
          return typeof val === "string" ? val : "";
        }
        // Could be a constant
        return ctx.constants[part] || "";
      })
      .join("");
  });
  
  // Process isset() ternary - for preview, assume isset returns true
  result = result.replace(/isset\s*\([^)]+\)\s*\?\s*['"]?([^:'"]+)['"]?\s*:\s*['"]?([^;'"]+)['"]?/g, "$1");
  
  // Process empty() checks - for preview, assume not empty
  result = result.replace(/!?\s*empty\s*\([^)]+\)/g, "true");
  
  // Clean remaining echo statements
  result = result.replace(/echo\s+[^;]+;?/g, "");
  
  return result;
}

/** Process PHP include/require statements */
function processIncludes(content: string, ctx: PhpEmulatorContext, depth = 0): string {
  if (depth > 10) return content; // Prevent infinite recursion
  
  const currentDir = ctx.currentPath.includes("/") 
    ? ctx.currentPath.substring(0, ctx.currentPath.lastIndexOf("/")) 
    : "";
  
  // Match standalone <?php include ... ?> blocks
  const phpIncludeBlockRegex = /<\?php\s*(include|require|include_once|require_once)\s+['"]([^'"]+)['"]\s*;?\s*\?>/gi;
  
  let result = content.replace(phpIncludeBlockRegex, (_, type, path) => {
    // Prevent circular includes
    if (ctx.processedIncludes.has(path)) {
      return `<!-- Already included: ${path} -->`;
    }
    
    const file = findFile(ctx.files, path, currentDir);
    if (!file) {
      return `<!-- Missing file: ${path} -->`;
    }
    
    // Config files - extract constants, no output
    if (path.includes("config.php")) {
      const { constants, variables } = parseConfig(file.content);
      Object.assign(ctx.constants, constants);
      Object.assign(ctx.variables, variables);
      return "";
    }
    
    ctx.processedIncludes.add(path);
    
    // Recursively process the included file
    let includedContent = file.content;
    const subCtx = { ...ctx, currentPath: file.path };
    
    includedContent = processIncludes(includedContent, subCtx, depth + 1);
    includedContent = processForeachLoops(includedContent, subCtx);
    includedContent = processConditions(includedContent);
    
    // Clean PHP tags and process
    includedContent = includedContent.replace(/<\?php/g, "").replace(/\?>/g, "");
    includedContent = processEchoAndVariables(includedContent, subCtx);
    
    return includedContent;
  });
  
  // Handle inline includes within larger PHP blocks
  const inlineIncludeRegex = /(include|require|include_once|require_once)\s+['"]([^'"]+)['"]\s*;/gi;
  
  result = result.replace(inlineIncludeRegex, (_, type, path) => {
    if (ctx.processedIncludes.has(path)) {
      return "";
    }
    
    const file = findFile(ctx.files, path, currentDir);
    if (!file) {
      return `<!-- Missing: ${path} -->`;
    }
    
    if (path.includes("config.php")) {
      const { constants, variables } = parseConfig(file.content);
      Object.assign(ctx.constants, constants);
      Object.assign(ctx.variables, variables);
      return "";
    }
    
    ctx.processedIncludes.add(path);
    
    let includedContent = file.content;
    const subCtx = { ...ctx, currentPath: file.path };
    
    includedContent = processIncludes(includedContent, subCtx, depth + 1);
    includedContent = processForeachLoops(includedContent, subCtx);
    includedContent = processConditions(includedContent);
    includedContent = includedContent.replace(/<\?php/g, "").replace(/\?>/g, "");
    includedContent = processEchoAndVariables(includedContent, subCtx);
    
    return includedContent;
  });
  
  return result;
}

/** Extract page title from PHP page variable */
function extractPageTitle(content: string, ctx: PhpEmulatorContext): string {
  // Look for $page_title = 'Something';
  const match = content.match(/\$(?:page_title|title|pageTitle)\s*=\s*['"]([^'"]+)['"]/i);
  if (match) return match[1];
  
  // Look for <title> tag
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].replace(/\$\w+/g, "").trim() || "Preview";
  
  // Fallback to SITE_NAME constant
  return ctx.constants["SITE_NAME"] || ctx.constants["SITE_TITLE"] || "PHP Preview";
}

/** Check all links in HTML and verify if target files exist */
function checkLinks(html: string, files: GeneratedFile[], currentFile: string): LinkCheckResult[] {
  const results: LinkCheckResult[] = [];
  const hrefRegex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  const seen = new Set<string>();
  
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1].trim();
    
    // Skip duplicates
    const key = `${href}:${currentFile}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    // Skip external links, javascript:, mailto:, tel:
    if (
      href.startsWith("http://") || 
      href.startsWith("https://") ||
      href.startsWith("javascript:") || 
      href.startsWith("mailto:") ||
      href.startsWith("tel:") || 
      href === "#"
    ) {
      results.push({ href, exists: true, isExternal: true, sourceFile: currentFile });
      continue;
    }
    
    // Check if file exists
    const normalizedHref = href.replace(/^\.\//, "").replace(/^\//, "");
    const exists = files.some(f => f.path === normalizedHref);
    results.push({ href, exists, isExternal: false, sourceFile: currentFile });
  }
  
  return results;
}

/** Main function: emulate a PHP page and return HTML */
export function emulatePhpPage(
  pagePath: string,
  files: GeneratedFile[]
): PhpPreviewResult {
  const warnings: string[] = [];
  
  // Find the requested page
  const pageFile = files.find(f => f.path === pagePath);
  if (!pageFile) {
    return {
      html: `<!DOCTYPE html>
<html><head><title>404</title></head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
<h1>404 - File Not Found</h1>
<p>Cannot find: ${pagePath}</p>
</body></html>`,
      pageTitle: "404 Not Found",
      brokenLinks: [],
      warnings: [`File not found: ${pagePath}`]
    };
  }
  
  // Initialize context
  const ctx: PhpEmulatorContext = {
    files,
    currentPath: pagePath,
    variables: {},
    constants: {},
    processedIncludes: new Set()
  };
  
  // First, look for and parse config.php
  const configFile = files.find(f => f.path.includes("config.php"));
  if (configFile) {
    const { constants, variables } = parseConfig(configFile.content);
    ctx.constants = constants;
    ctx.variables = variables;
  }
  
  // Extract page-specific variables before processing
  const pageVarMatch = pageFile.content.match(/\$(\w+)\s*=\s*['"]([^'"]+)['"]\s*;/g);
  if (pageVarMatch) {
    pageVarMatch.forEach(m => {
      const [, name, value] = m.match(/\$(\w+)\s*=\s*['"]([^'"]+)['"]/) || [];
      if (name && value) {
        ctx.variables[name] = value;
      }
    });
  }
  
  // Extract page title before processing
  const pageTitle = extractPageTitle(pageFile.content, ctx);
  
  // Process the page
  let html = pageFile.content;
  
  // Process all includes first
  html = processIncludes(html, ctx);
  
  // Process foreach loops
  html = processForeachLoops(html, ctx);
  
  // Process conditions
  html = processConditions(html);
  
  // Process PHP blocks more carefully - preserve HTML content!
  // Only process actual PHP code, don't remove content
  html = html.replace(/<\?php([\s\S]*?)\?>/g, (match, inner: string) => {
    const trimmed = inner.trim();
    
    // Empty block - remove
    if (!trimmed) return "";
    
    // Pure variable declaration - remove (already extracted)
    if (/^\$\w+\s*=\s*['"][^'"]*['"]\s*;?\s*$/.test(trimmed)) {
      return "";
    }
    
    // Array declarations - remove
    if (/^\$\w+\s*=\s*(?:array\s*\(|\[)/.test(trimmed)) {
      return "";
    }
    
    // Check for echo statements and process them
    if (trimmed.includes("echo")) {
      return processEchoAndVariables(trimmed, ctx);
    }
    
    // Include statements should be already processed
    if (/^(include|require|include_once|require_once)/.test(trimmed)) {
      return "";
    }
    
    // For other PHP code, try to extract any output
    const processed = processEchoAndVariables(trimmed, ctx);
    // If processing produced meaningful output, return it
    if (processed.trim() && processed !== trimmed) {
      return processed;
    }
    
    // Otherwise remove the PHP block (server-side only logic)
    return "";
  });
  
  // Process any inline PHP echo shorthand: <?= $var ?> 
  html = html.replace(/<\?=\s*([^?]+)\s*\?>/g, (_, expr: string) => {
    const varMatch = expr.match(/\$(\w+)/);
    if (varMatch) {
      const value = ctx.variables[varMatch[1]];
      return typeof value === "string" ? value : "";
    }
    const constValue = ctx.constants[expr.trim()];
    if (constValue) return constValue;
    return processDateFunction(expr);
  });
  
  // Final cleanup of any unclosed PHP tags (shouldn't happen but safety)
  html = html.replace(/<\?php/g, "").replace(/\?>/g, "");
  
  // Process remaining echo/variable references in the HTML
  html = processEchoAndVariables(html, ctx);
  
  // Apply full HTML processing (CSS inlining, image fixes, external resources)
  html = processHtmlForPreview(html, files);
  
  // Check for broken links
  const brokenLinks = checkLinks(html, files, pagePath);
  const broken = brokenLinks.filter(l => !l.exists && !l.isExternal);
  if (broken.length > 0) {
    warnings.push(`${broken.length} broken internal link(s) found`);
  }
  
  return {
    html,
    pageTitle,
    brokenLinks,
    warnings
  };
}

/** Get all PHP pages from files (excluding includes) */
export function getPhpPages(files: GeneratedFile[]): GeneratedFile[] {
  return files.filter(f => 
    f.path.endsWith(".php") && 
    !f.path.startsWith("includes/") && 
    !f.path.includes("/includes/") &&
    !f.path.includes("config.php") &&
    f.path !== "form-handler.php"
  );
}

/** Check all links across all PHP pages */
export function checkAllLinks(files: GeneratedFile[]): LinkCheckResult[] {
  const allLinks: LinkCheckResult[] = [];
  const pages = getPhpPages(files);
  
  pages.forEach(page => {
    const result = emulatePhpPage(page.path, files);
    allLinks.push(...result.brokenLinks);
  });
  
  // Deduplicate
  const seen = new Set<string>();
  return allLinks.filter(link => {
    const key = `${link.href}:${link.sourceFile}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
