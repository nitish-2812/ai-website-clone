/**
 * Style Extractor Module
 * 
 * Uses Playwright to extract computed styles from key elements on the page.
 * Identifies color palette, fonts, spacing patterns, and media queries.
 */

import { chromium } from 'playwright';

export interface StyleExtractionResult {
  computedStyles: Array<{
    selector: string;
    properties: Record<string, string>;
  }>;
  colorPalette: string[];
  fontFamilies: string[];
  backgroundColors: string[];
  textColors: string[];
  borderColors: string[];
  fontSizes: string[];
  spacingValues: string[];
  borderRadii: string[];
  mediaQueries: string[];
}

export async function extractStyles(url: string): Promise<StyleExtractionResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const allElements = document.querySelectorAll(
        'body, header, nav, main, section, footer, h1, h2, h3, h4, p, a, button, ' +
        'div[class], span[class], img, ul, li, input, form, ' +
        '[class*="hero"], [class*="card"], [class*="container"], [class*="wrapper"]'
      );

      const colorSet = new Set<string>();
      const bgColorSet = new Set<string>();
      const textColorSet = new Set<string>();
      const borderColorSet = new Set<string>();
      const fontSet = new Set<string>();
      const fontSizeSet = new Set<string>();
      const spacingSet = new Set<string>();
      const borderRadiusSet = new Set<string>();

      const computedStyles: Array<{
        selector: string;
        properties: Record<string, string>;
      }> = [];

      const elementsArray = Array.from(allElements).slice(0, 60);

      elementsArray.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const className = el.className
          ? `.${String(el.className).split(' ')[0]}`
          : '';
        const id = el.id ? `#${el.id}` : '';
        const selector = `${tag}${id}${className}`.substring(0, 100);

        const props: Record<string, string> = {};

        // Colors
        const color = styles.color;
        const bgColor = styles.backgroundColor;
        const borderColor = styles.borderColor;

        if (color && color !== 'rgb(0, 0, 0)') {
          textColorSet.add(color);
          colorSet.add(color);
        }
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          bgColorSet.add(bgColor);
          colorSet.add(bgColor);
        }
        if (borderColor && borderColor !== 'rgb(0, 0, 0)') {
          borderColorSet.add(borderColor);
          colorSet.add(borderColor);
        }

        // Fonts
        const fontFamily = styles.fontFamily;
        if (fontFamily) {
          fontSet.add(fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
        }

        const fontSize = styles.fontSize;
        if (fontSize) fontSizeSet.add(fontSize);

        // Spacing
        const padding = styles.padding;
        const margin = styles.margin;
        const gap = styles.gap;
        if (padding && padding !== '0px') spacingSet.add(`padding: ${padding}`);
        if (margin && margin !== '0px') spacingSet.add(`margin: ${margin}`);
        if (gap && gap !== 'normal') spacingSet.add(`gap: ${gap}`);

        // Border radius
        const radius = styles.borderRadius;
        if (radius && radius !== '0px') borderRadiusSet.add(radius);

        // Key properties for section elements
        if (['section', 'header', 'main', 'footer', 'nav', 'div'].includes(tag)) {
          props['backgroundColor'] = bgColor;
          props['color'] = color;
          props['padding'] = padding;
          props['maxWidth'] = styles.maxWidth;
          props['display'] = styles.display;
          props['flexDirection'] = styles.flexDirection;
          props['justifyContent'] = styles.justifyContent;
          props['alignItems'] = styles.alignItems;
          props['gap'] = gap;
          props['gridTemplateColumns'] = styles.gridTemplateColumns;
        }

        // Key properties for text elements
        if (['h1', 'h2', 'h3', 'h4', 'p', 'span', 'a'].includes(tag)) {
          props['color'] = color;
          props['fontSize'] = fontSize;
          props['fontWeight'] = styles.fontWeight;
          props['fontFamily'] = fontFamily;
          props['lineHeight'] = styles.lineHeight;
          props['letterSpacing'] = styles.letterSpacing;
          props['textAlign'] = styles.textAlign;
        }

        // Key properties for buttons
        if (tag === 'button' || tag === 'a') {
          props['backgroundColor'] = bgColor;
          props['color'] = color;
          props['padding'] = padding;
          props['borderRadius'] = radius;
          props['border'] = styles.border;
          props['fontSize'] = fontSize;
          props['fontWeight'] = styles.fontWeight;
        }

        if (Object.keys(props).length > 0) {
          computedStyles.push({ selector, properties: props });
        }
      });

      // ── Media queries from stylesheets ──
      const mediaQueries: string[] = [];
      try {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules || [])) {
              if (rule instanceof CSSMediaRule) {
                const mq = rule.conditionText || rule.media.mediaText;
                if (mq && !mediaQueries.includes(mq)) {
                  mediaQueries.push(mq);
                }
              }
            }
          } catch {
            // CORS — skip external stylesheets
          }
        }
      } catch {
        // ignore
      }

      return {
        computedStyles,
        colorPalette: Array.from(colorSet).slice(0, 30),
        fontFamilies: Array.from(fontSet).slice(0, 10),
        backgroundColors: Array.from(bgColorSet).slice(0, 15),
        textColors: Array.from(textColorSet).slice(0, 15),
        borderColors: Array.from(borderColorSet).slice(0, 10),
        fontSizes: Array.from(fontSizeSet).slice(0, 15),
        spacingValues: Array.from(spacingSet).slice(0, 20),
        borderRadii: Array.from(borderRadiusSet).slice(0, 10),
        mediaQueries: mediaQueries.slice(0, 10),
      };
    });

    await context.close();

    console.log(`  ✓ Extracted ${result.colorPalette.length} colors, ${result.fontFamilies.length} fonts`);
    console.log(`  ✓ Found ${result.computedStyles.length} computed style sets`);

    return result;
  } finally {
    await browser.close();
  }
}
