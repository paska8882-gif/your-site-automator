/**
 * PHP Emulator - client-side parsing of PHP files for preview
 * Supports: includes, config constants, echo, date(), simple if conditions
 */

import { GeneratedFile } from "./websiteGenerator";

export interface PhpEmulatorContext {
  files: GeneratedFile[];
  currentPath: string;
  variables: Record<string, string>;
  constants: Record<string, string>;
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

/** Parse config.php and extract constants */
function parseConfig(content: string): Record<string, string> {
  const constants: Record<string, string> = {};
  
  // Match define('CONST_NAME', 'value'); or define("CONST_NAME", "value");
  const defineRegex = /define\s*\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g;
  let match;
  while ((match = defineRegex.exec(content)) !== null) {
    constants[match[1]] = match[2];
  }
  
  // Match $variable = 'value'; or $variable = "value";
  const varRegex = /\$(\w+)\s*=\s*['"]([^'"]*)['"]\s*;/g;
  while ((match = varRegex.exec(content)) !== null) {
    constants["$" + match[1]] = match[2];
  }
  
  return constants;
}

/** Find a file by path (handles relative paths) */
function findFile(files: GeneratedFile[], relativePath: string, currentDir: string): GeneratedFile | null {
  // Normalize path
  let targetPath = relativePath.replace(/^\.\//, "").replace(/^\//, "");
  
  // If relative path starts from current directory
  if (!targetPath.startsWith("includes/") && currentDir) {
    const fullPath = currentDir + "/" + targetPath;
    const found = files.find(f => f.path === fullPath || f.path === targetPath);
    if (found) return found;
  }
  
  return files.find(f => f.path === targetPath) || null;
}

/** Process PHP include/require statements */
function processIncludes(content: string, ctx: PhpEmulatorContext, depth = 0): string {
  if (depth > 10) return content; // Prevent infinite recursion
  
  // Match include/require/include_once/require_once anywhere in the file (even inside larger PHP blocks)
  // Example: $page_title = 'Home'; include 'includes/header.php';
  const includeRegex = /(include|require|include_once|require_once)\s*['"]([^'\"]+)['"]\s*;?/g;
  
  return content.replace(includeRegex, (_, type, path) => {
    const currentDir = ctx.currentPath.includes("/") 
      ? ctx.currentPath.substring(0, ctx.currentPath.lastIndexOf("/")) 
      : "";
    
    const file = findFile(ctx.files, path, currentDir);
    if (!file) {
      return `<!-- Missing file: ${path} -->`;
    }
    
    // Recursively process the included file
    let includedContent = file.content;
    
    // First extract config if it's config.php
    if (path.includes("config.php")) {
      const configConstants = parseConfig(includedContent);
      Object.assign(ctx.constants, configConstants);
      return ""; // config.php typically has no HTML output
    }
    
    // Process includes in the included file
    includedContent = processIncludes(includedContent, { ...ctx, currentPath: file.path }, depth + 1);
    
    // Remove <?php ?> tags
    includedContent = includedContent.replace(/<\?php/g, "").replace(/\?>/g, "");
    
    // Process variables and constants in included content
    includedContent = processPhpCode(includedContent, ctx);
    
    return includedContent;
  });
}

/** Process PHP date() function */
function processDateFunction(content: string): string {
  // Match date('Y') or date("Y") etc.
  return content.replace(/date\s*\(\s*['"]([^'"]+)['"]\s*\)/g, (_, format) => {
    const now = new Date();
    return format
      .replace(/Y/g, now.getFullYear().toString())
      .replace(/y/g, (now.getFullYear() % 100).toString().padStart(2, "0"))
      .replace(/m/g, (now.getMonth() + 1).toString().padStart(2, "0"))
      .replace(/n/g, (now.getMonth() + 1).toString())
      .replace(/d/g, now.getDate().toString().padStart(2, "0"))
      .replace(/j/g, now.getDate().toString())
      .replace(/H/g, now.getHours().toString().padStart(2, "0"))
      .replace(/i/g, now.getMinutes().toString().padStart(2, "0"))
      .replace(/s/g, now.getSeconds().toString().padStart(2, "0"));
  });
}

/** Process echo statements and PHP constants/variables */
function processPhpCode(content: string, ctx: PhpEmulatorContext): string {
  let result = content;
  
  // Process date() function first
  result = processDateFunction(result);
  
  // Replace echo CONSTANT_NAME with the constant value
  Object.entries(ctx.constants).forEach(([name, value]) => {
    if (name.startsWith("$")) {
      // Variable: echo $variable or <?php echo $variable; ?>
      const varName = name.substring(1);
      result = result.replace(new RegExp(`echo\\s+\\$${varName}\\s*;?`, "g"), value);
      result = result.replace(new RegExp(`\\$\\{?${varName}\\}?`, "g"), value);
    } else {
      // Constant: echo CONSTANT or <?php echo CONSTANT; ?>
      result = result.replace(new RegExp(`echo\\s+${name}\\s*;?`, "g"), value);
      result = result.replace(new RegExp(`\\b${name}\\b`, "g"), value);
    }
  });
  
  // Process simple echo with string concatenation
  // e.g., echo 'text' . CONST . 'more text';
  result = result.replace(/echo\s+['"]([^'"]*)['"]\s*;?/g, "$1");
  
  // Process isset($variable) ? value1 : value2 - simplified
  result = result.replace(/isset\s*\([^)]+\)\s*\?\s*([^:]+)\s*:\s*([^;]+);?/g, (_, truthy) => {
    return truthy.replace(/['"]([^'"]*)['"]/g, "$1").trim();
  });
  
  // Process simple if conditions (just remove PHP tags, show content)
  result = result.replace(/<\?php\s+if\s*\([^)]+\)\s*:\s*\?>/g, "");
  result = result.replace(/<\?php\s+endif\s*;\s*\?>/g, "");
  result = result.replace(/<\?php\s+else\s*:\s*\?>/g, "");
  
  // Clean remaining echo statements
  result = result.replace(/echo\s+[^;]+;?/g, "");
  
  return result;
}

/** Extract page title from PHP page variable */
function extractPageTitle(content: string, ctx: PhpEmulatorContext): string {
  // Look for $page_title = 'Something';
  const match = content.match(/\$page_title\s*=\s*['"]([^'"]+)['"]/);
  if (match) return match[1];
  
  // Fallback to SITE_NAME constant
  return ctx.constants["SITE_NAME"] || "PHP Preview";
}

/** Check all links in HTML and verify if target files exist */
function checkLinks(html: string, files: GeneratedFile[], currentFile: string): LinkCheckResult[] {
  const results: LinkCheckResult[] = [];
  const hrefRegex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1].trim();
    
    // Skip external links, javascript:, mailto:, tel:
    if (href.startsWith("http://") || href.startsWith("https://") || 
        href.startsWith("javascript:") || href.startsWith("mailto:") || 
        href.startsWith("tel:") || href === "#") {
      results.push({ href, exists: true, isExternal: true, sourceFile: currentFile });
      continue;
    }
    
    // Check if file exists
    const normalizedHref = href.replace(/^\.\//, "").replace(/^\//, "");
    const exists = files.some(f => f.path === normalizedHref);
    
    // Avoid duplicates
    if (!results.some(r => r.href === href && r.sourceFile === currentFile)) {
      results.push({ href, exists, isExternal: false, sourceFile: currentFile });
    }
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
      html: `<html><body><h1>404 - File Not Found</h1><p>Cannot find: ${pagePath}</p></body></html>`,
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
    constants: {}
  };
  
  // First, look for and parse config.php
  const configFile = files.find(f => f.path.includes("config.php"));
  if (configFile) {
    ctx.constants = parseConfig(configFile.content);
  }
  
  // Extract page title before processing
  const pageTitle = extractPageTitle(pageFile.content, ctx);
  
  // Process the page
  let html = pageFile.content;
  
  // Process all includes
  html = processIncludes(html, ctx);
  
  // Remove remaining PHP tags and process code
  html = html.replace(/<\?php[\s\S]*?\?>/g, (match) => {
    // Try to extract meaningful content
    const processed = processPhpCode(match.replace(/<\?php/g, "").replace(/\?>/g, ""), ctx);
    return processed.trim();
  });
  
  // Clean up any remaining PHP artifacts
  html = html.replace(/<\?php/g, "").replace(/\?>/g, "");
  html = processPhpCode(html, ctx);
  
  // Check for broken links
  const brokenLinks = checkLinks(html, files, pagePath);
  const broken = brokenLinks.filter(l => !l.exists && !l.isExternal);
  if (broken.length > 0) {
    warnings.push(`${broken.length} broken link(s) found`);
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
