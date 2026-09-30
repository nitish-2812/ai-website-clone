/**
 * DOM Extractor Module
 * 
 * Uses Playwright to extract structural DOM information from the target website.
 * Captures headings, sections, navigation, links, and semantic structure.
 */

import { chromium } from 'playwright';

export interface DOMExtractionResult {
  html: string;
  title: string;
  metaDescription: string;
  headings: string[];
  links: Array<{ text: string; href: string }>;
  sections: Array<{
    tag: string;
    id?: string;
    className?: string;
    textContent: string;
    childCount: number;
  }>;
  navItems: Array<{ text: string; href: string }>;
  textBlocks: string[];
}

export async function extractDOM(url: string): Promise<DOMExtractionResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      // ── Title & Meta ──
      const title = document.title || '';
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      // ── Headings ──
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
        (h) => `${h.tagName}: ${h.textContent?.trim().substring(0, 200) || ''}`
      );

      // ── Links ──
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({
          text: a.textContent?.trim().substring(0, 100) || '',
          href: a.getAttribute('href') || '',
        }))
        .filter((l) => l.text && l.href)
        .slice(0, 50);

      // ── Navigation items ──
      const navElements = document.querySelectorAll('nav a, header a, [role="navigation"] a');
      const navItems = Array.from(navElements)
        .map((a) => ({
          text: a.textContent?.trim().substring(0, 100) || '',
          href: a.getAttribute('href') || '',
        }))
        .filter((item) => item.text);

      // ── Major sections ──
      const sectionSelectors = [
        'header', 'nav', 'main', 'section', 'article', 'aside', 'footer',
        '[class*="hero"]', '[class*="feature"]', '[class*="pricing"]',
        '[class*="testimonial"]', '[class*="cta"]', '[class*="about"]',
        '[class*="contact"]', '[class*="faq"]',
      ];

      const sections = Array.from(
        document.querySelectorAll(sectionSelectors.join(', '))
      )
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className
            ? String(el.className).substring(0, 200)
            : undefined,
          textContent: el.textContent?.trim().substring(0, 500) || '',
          childCount: el.children.length,
        }))
        .slice(0, 30);

      // ── Text blocks (significant paragraphs) ──
      const textBlocks = Array.from(document.querySelectorAll('p, li'))
        .map((el) => el.textContent?.trim() || '')
        .filter((text) => text.length > 20)
        .slice(0, 50);

      // ── Simplified HTML (cleaned) ──
      const bodyClone = document.body.cloneNode(true) as HTMLElement;
      // Remove scripts, styles, noscript, svg contents
      bodyClone.querySelectorAll('script, style, noscript, svg, iframe').forEach((el) => el.remove());
      // Simplify: strip data attributes, event handlers
      bodyClone.querySelectorAll('*').forEach((el) => {
        const attrs = Array.from(el.attributes);
        attrs.forEach((attr) => {
          if (
            attr.name.startsWith('data-') ||
            attr.name.startsWith('on') ||
            attr.name === 'jsaction' ||
            attr.name === 'jscontroller'
          ) {
            el.removeAttribute(attr.name);
          }
        });
      });

      const html = bodyClone.innerHTML.substring(0, 15000); // cap at 15KB

      return {
        html,
        title,
        metaDescription: metaDesc,
        headings,
        links,
        sections,
        navItems,
        textBlocks,
      };
    });

    await context.close();

    console.log(`  ✓ Extracted DOM: ${result.headings.length} headings, ${result.sections.length} sections`);
    console.log(`  ✓ Found ${result.navItems.length} nav items, ${result.links.length} links`);

    return result;
  } finally {
    await browser.close();
  }
}
