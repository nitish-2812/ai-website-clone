/**
 * Asset Extractor Module
 * 
 * Extracts and optionally downloads images, identifies fonts,
 * and collects external resource references from the target website.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config.js';

export interface AssetExtractionResult {
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
    localPath?: string;
  }>;
  fonts: string[];
  externalStylesheets: string[];
  iconLibrary?: string;
  faviconUrl?: string;
  logoUrl?: string;
}

export async function extractAssets(
  url: string,
  downloadImages: boolean = true
): Promise<AssetExtractionResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const result = await page.evaluate((baseUrl: string) => {
      // ── Images ──
      const imgElements = document.querySelectorAll('img');
      const images = Array.from(imgElements)
        .map((img) => {
          const src = img.src || img.getAttribute('data-src') || '';
          let resolvedSrc = src;
          try {
            resolvedSrc = new URL(src, baseUrl).href;
          } catch {
            // keep original
          }
          return {
            src: resolvedSrc,
            alt: img.alt || '',
            width: img.naturalWidth || img.width || undefined,
            height: img.naturalHeight || img.height || undefined,
          };
        })
        .filter((img) => img.src && !img.src.startsWith('data:'))
        .slice(0, 30);

      // ── Background images ──
      const bgImages: Array<{ src: string; alt: string }> = [];
      document.querySelectorAll('*').forEach((el) => {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none') {
          const urlMatch = bgImage.match(/url\(["']?(.+?)["']?\)/);
          if (urlMatch && urlMatch[1]) {
            let resolvedSrc = urlMatch[1];
            try {
              resolvedSrc = new URL(urlMatch[1], baseUrl).href;
            } catch {
              // keep original
            }
            if (!resolvedSrc.startsWith('data:')) {
              bgImages.push({ src: resolvedSrc, alt: 'background-image' });
            }
          }
        }
      });

      // ── Fonts from @font-face and link tags ──
      const fonts: string[] = [];
      document.querySelectorAll('link[rel*="font"], link[href*="fonts"]').forEach((link) => {
        const href = link.getAttribute('href');
        if (href) fonts.push(href);
      });

      // Check Google Fonts links
      document.querySelectorAll('link[href*="googleapis.com/css"]').forEach((link) => {
        const href = link.getAttribute('href');
        if (href) fonts.push(href);
      });

      // ── External stylesheets ──
      const stylesheets: string[] = [];
      document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        const href = link.getAttribute('href');
        if (href) stylesheets.push(href);
      });

      // ── Detect icon library ──
      let iconLibrary: string | undefined;
      const htmlStr = document.documentElement.innerHTML;
      if (htmlStr.includes('lucide') || htmlStr.includes('lucide-react')) {
        iconLibrary = 'lucide';
      } else if (htmlStr.includes('heroicon') || htmlStr.includes('heroicons')) {
        iconLibrary = 'heroicons';
      } else if (htmlStr.includes('font-awesome') || htmlStr.includes('fa-')) {
        iconLibrary = 'font-awesome';
      } else if (htmlStr.includes('material-icons') || htmlStr.includes('material-symbols')) {
        iconLibrary = 'material-icons';
      }

      // ── Favicon ──
      const faviconLink = document.querySelector(
        'link[rel="icon"], link[rel="shortcut icon"]'
      );
      const faviconUrl = faviconLink?.getAttribute('href') || undefined;

      // ── Logo (heuristic: first img in header/nav) ──
      const logoEl = document.querySelector('header img, nav img, [class*="logo"] img');
      const logoUrl = logoEl?.getAttribute('src') || undefined;

      return {
        images: [...images, ...bgImages.slice(0, 10)],
        fonts,
        externalStylesheets: stylesheets,
        iconLibrary,
        faviconUrl,
        logoUrl,
      };
    }, url);

    // ── Download images locally ──
    if (downloadImages && result.images.length > 0) {
      const assetsDir = path.join(config.outputDir, '_assets', 'images');
      await fs.mkdir(assetsDir, { recursive: true });

      const downloadPromises = result.images.slice(0, 20).map(async (img, idx) => {
        try {
          const response = await page.request.get(img.src);
          if (response.ok()) {
            const buffer = await response.body();
            const ext = getExtFromUrl(img.src) || 'png';
            const filename = `img_${idx}.${ext}`;
            const localPath = path.join(assetsDir, filename);
            await fs.writeFile(localPath, buffer);
            (img as any).localPath = localPath;
          }
        } catch {
          // Failed to download, will use original URL as fallback
        }
      });

      await Promise.all(downloadPromises);
      console.log(`  ✓ Downloaded ${result.images.filter((i: any) => i.localPath).length} images`);
    }

    await context.close();

    console.log(`  ✓ Found ${result.images.length} images, ${result.fonts.length} font refs`);
    if (result.iconLibrary) {
      console.log(`  ✓ Detected icon library: ${result.iconLibrary}`);
    }

    return result as AssetExtractionResult;
  } finally {
    await browser.close();
  }
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace('.', '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'ico'].includes(ext)) {
      return ext;
    }
  } catch {
    // ignore
  }
  return 'png';
}
