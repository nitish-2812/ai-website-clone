/**
 * Blueprint Generator Module
 * 
 * Combines vision analysis of screenshots with DOM/style extraction data
 * to produce a structured WebsiteBlueprint — the key intermediate representation
 * that decouples analysis from code generation.
 */

import { analyzeImage, generateText } from './llm-client.js';
import { AnalysisResult, WebsiteBlueprint } from '../types/blueprint.js';

const VISION_SYSTEM_PROMPT = `You are an expert UI/UX analyst and frontend architect.
Your job is to analyze screenshots of websites and produce a detailed, structured JSON blueprint 
that can be used to recreate the website's frontend from scratch.

You must output ONLY valid JSON — no markdown, no code fences, no explanation.

Focus on:
1. Identifying all major sections (hero, features, pricing, testimonials, footer, etc.)
2. The visual layout and structure of each section
3. Color palette (exact hex colors when possible)
4. Typography (font families, sizes, weights)
5. Spacing patterns
6. Component patterns (cards, buttons, navigation)
7. Responsive hints (how it might adapt to mobile)

Be thorough and precise. The generated blueprint will be used directly for code generation.`;

const BLUEPRINT_MERGE_SYSTEM_PROMPT = `You are an expert frontend architect.
You have two sources of information about a website:
1. A vision-based analysis of the website screenshots (visual truth)
2. Extracted DOM structure, styles, and text content (structural truth)

Merge these into a single comprehensive WebsiteBlueprint JSON.

Rules:
- Use the vision analysis for layout, section identification, colors, and visual structure
- Use the DOM data for exact text content, links, navigation items, and semantic structure
- Use the style extraction for exact color values, font families, and spacing values
- Resolve conflicts by trusting the DOM/style data for text & colors, and vision for layout
- Output ONLY valid JSON matching the WebsiteBlueprint schema
- Do NOT include any markdown, code fences, or explanation
- Every section must have a unique id (use kebab-case like "hero-section", "features-grid")`;

export async function generateBlueprint(
  analysis: AnalysisResult
): Promise<WebsiteBlueprint> {
  console.log('\n🧠 Stage 2: AI Understanding & Blueprint Generation');
  console.log('  ⏳ Sending screenshots to vision model...');

  // Step 1: Vision analysis of screenshots
  const screenshotPaths = [analysis.screenshot.viewport];
  if (analysis.screenshot.fullPage !== analysis.screenshot.viewport) {
    screenshotPaths.push(analysis.screenshot.fullPage);
  }

  const visionAnalysis = await analyzeImage(
    VISION_SYSTEM_PROMPT,
    `Analyze this website screenshot(s) and produce a detailed JSON blueprint.
    
The website title is: "${analysis.dom.title}"

Identify each visual section from top to bottom and describe:
- Section type (hero, features, pricing, testimonials, cta, footer, etc.)
- Layout pattern (full-width, contained, two-column, grid, etc.)
- Visual style (background color, text colors, spacing)
- Components within (headings, text, buttons, cards, images)
- Approximate responsive behavior

Return a JSON object with this structure:
{
  "sections": [
    {
      "type": "hero|features|pricing|...",
      "layout": "full-width|contained|two-column|grid|split",
      "backgroundColor": "#hex",
      "textColor": "#hex",
      "components": [
        { "type": "heading|paragraph|button|image|card|list", "content": "..." }
      ],
      "description": "brief description of section purpose and visual style"
    }
  ],
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex"
  },
  "typography": {
    "headingFont": "font name",
    "bodyFont": "font name"
  },
  "overallStyle": "description of the overall design style (modern, minimal, corporate, playful, etc.)"
}`,
    screenshotPaths,
    {
      maxTokens: 4096,
      jsonMode: true,
    }
  );

  console.log('  ✓ Vision analysis complete');

  // Step 2: Merge vision analysis with DOM/style data into full blueprint
  console.log('  ⏳ Merging vision + DOM data into blueprint...');

  const mergePrompt = `Merge the following data sources into a complete WebsiteBlueprint JSON.

=== VISION ANALYSIS (from screenshot) ===
${visionAnalysis}

=== DOM STRUCTURE ===
Title: ${analysis.dom.title}
Description: ${analysis.dom.metaDescription}
Headings: ${JSON.stringify(analysis.dom.headings.slice(0, 20))}
Navigation items: ${JSON.stringify(analysis.dom.navItems?.slice(0, 15) || analysis.dom.links.slice(0, 15))}
Text blocks: ${JSON.stringify(analysis.dom.textBlocks?.slice(0, 30) || [])}
Sections found: ${JSON.stringify(analysis.dom.sections.slice(0, 15))}

=== EXTRACTED STYLES ===
Colors: ${JSON.stringify(analysis.styles.colorPalette.slice(0, 20))}
Background colors: ${JSON.stringify((analysis.styles as any).backgroundColors?.slice(0, 10) || [])}
Text colors: ${JSON.stringify((analysis.styles as any).textColors?.slice(0, 10) || [])}
Fonts: ${JSON.stringify(analysis.styles.fontFamilies)}
Font sizes: ${JSON.stringify((analysis.styles as any).fontSizes?.slice(0, 10) || [])}
Computed styles on key elements: ${JSON.stringify(analysis.styles.computedStyles.slice(0, 15))}

=== ASSETS ===
Images found: ${analysis.assets.images.length}
Image details: ${JSON.stringify(analysis.assets.images.slice(0, 10).map((i) => ({ src: i.src, alt: i.alt })))}
Fonts: ${JSON.stringify(analysis.assets.fonts)}
Icon library: ${(analysis.assets as any).iconLibrary || 'none detected'}

Produce the full WebsiteBlueprint JSON with this structure:
{
  "metadata": {
    "sourceUrl": "the original URL",
    "title": "page title",
    "description": "meta description",
    "language": "en",
    "analyzedAt": "ISO date"
  },
  "designTokens": {
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "surface": "#hex",
      "text": { "primary": "#hex", "secondary": "#hex", "muted": "#hex" },
      "border": "#hex",
      "additionalColors": []
    },
    "typography": {
      "fontFamily": { "heading": "font", "body": "font" },
      "fontSize": { "xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.125rem", "xl": "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem" },
      "fontWeight": { "normal": 400, "medium": 500, "semibold": 600, "bold": 700 },
      "lineHeight": { "tight": "1.25", "normal": "1.5", "relaxed": "1.75" }
    },
    "spacing": { "unit": 4, "xs": "0.25rem", "sm": "0.5rem", "md": "1rem", "lg": "1.5rem", "xl": "2rem", "2xl": "3rem" },
    "layout": { "maxWidth": "1200px", "containerPadding": "1rem" },
    "borderRadius": { "sm": "0.25rem", "md": "0.5rem", "lg": "1rem", "full": "9999px" },
    "shadows": { "sm": "0 1px 2px rgba(0,0,0,0.05)", "md": "0 4px 6px rgba(0,0,0,0.1)", "lg": "0 10px 15px rgba(0,0,0,0.1)" }
  },
  "sections": [
    {
      "id": "unique-kebab-id",
      "type": "hero|features|pricing|testimonials|cta|footer|navbar|stats|faq|team|gallery|contact|content-section|card-grid|banner|custom",
      "order": 0,
      "layout": {
        "type": "full-width|contained|two-column|three-column|grid|split",
        "alignment": "left|center|right",
        "direction": "row|column"
      },
      "style": {
        "backgroundColor": "#hex",
        "textColor": "#hex",
        "paddingY": "4rem"
      },
      "content": {
        "texts": [{ "type": "heading|subheading|paragraph|label|caption", "text": "actual text", "level": 1 }],
        "buttons": [{ "text": "Button Text", "variant": "primary|secondary|outline", "href": "/" }],
        "images": [{ "src": "url", "alt": "description" }],
        "cards": [{ "title": "...", "description": "..." }],
        "navItems": [{ "text": "...", "href": "..." }]
      },
      "responsive": { "mobile": { "hidden": false } }
    }
  ],
  "assets": {
    "images": [],
    "fonts": ["Google Fonts URL or font name"],
    "iconLibrary": "lucide|heroicons|font-awesome|none"
  },
  "navigation": {
    "type": "fixed|sticky|static",
    "items": [{ "text": "...", "href": "..." }],
    "ctaButton": { "text": "...", "variant": "primary" }
  }
}

Use the ACTUAL text content from the DOM data, not placeholder text.
Use the ACTUAL colors from the style extraction when available.
Ensure every section from the vision analysis has a corresponding entry.`;

  const blueprintJson = await generateText(
    BLUEPRINT_MERGE_SYSTEM_PROMPT,
    mergePrompt,
    {
      maxTokens: 8192,
      temperature: 0.1,
      jsonMode: true,
    }
  );

  console.log('  ✓ Blueprint generated');

  // Parse and validate
  let blueprint: WebsiteBlueprint;
  try {
    blueprint = JSON.parse(blueprintJson);
  } catch (e) {
    console.log('  ⚠ Blueprint JSON parse failed, attempting repair...');
    blueprint = await repairBlueprintJson(blueprintJson);
  }

  // Validate required fields
  if (!blueprint.sections || blueprint.sections.length === 0) {
    throw new Error('Blueprint has no sections — analysis may have failed');
  }

  console.log(`  ✓ Blueprint contains ${blueprint.sections.length} sections`);
  return blueprint;
}

/**
 * Attempt to repair malformed JSON from LLM output
 */
async function repairBlueprintJson(malformedJson: string): Promise<WebsiteBlueprint> {
  const repaired = await generateText(
    'You are a JSON repair tool. Fix the following malformed JSON and return ONLY valid JSON. No explanation.',
    `Fix this JSON:\n${malformedJson.substring(0, 10000)}`,
    { maxTokens: 8192, temperature: 0, jsonMode: true }
  );

  return JSON.parse(repaired);
}
