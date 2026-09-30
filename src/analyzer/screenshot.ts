/**
 * Screenshot Capture Module
 * 
 * Uses Playwright to capture full-page and viewport screenshots
 * of the target website. Also captures a mobile viewport version.
 */

import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config.js';

export interface ScreenshotResult {
  fullPage: string;
  viewport: string;
  mobile?: string;
}

export async function captureScreenshots(url: string): Promise<ScreenshotResult> {
  // Ensure screenshot directory exists
  await fs.mkdir(config.screenshotDir, { recursive: true });

  const timestamp = Date.now();
  const browser = await chromium.launch({ headless: true });

  try {
    // ── Desktop Full-Page Screenshot ──
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const desktopPage = await desktopContext.newPage();
    
    await navigateAndWait(desktopPage, url);

    const fullPagePath = path.join(config.screenshotDir, `fullpage_${timestamp}.png`);
    await desktopPage.screenshot({
      path: fullPagePath,
      fullPage: true,
    });

    const viewportPath = path.join(config.screenshotDir, `viewport_${timestamp}.png`);
    await desktopPage.screenshot({
      path: viewportPath,
      fullPage: false,
    });

    // ── Mobile Screenshot ──
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isMobile: true,
    });
    const mobilePage = await mobileContext.newPage();

    await navigateAndWait(mobilePage, url);

    const mobilePath = path.join(config.screenshotDir, `mobile_${timestamp}.png`);
    await mobilePage.screenshot({
      path: mobilePath,
      fullPage: true,
    });

    await desktopContext.close();
    await mobileContext.close();

    console.log('  ✓ Captured desktop full-page screenshot');
    console.log('  ✓ Captured desktop viewport screenshot');
    console.log('  ✓ Captured mobile screenshot');

    return {
      fullPage: fullPagePath,
      viewport: viewportPath,
      mobile: mobilePath,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Navigate to URL and wait for full page load including lazy content
 */
async function navigateAndWait(page: Page, url: string): Promise<void> {
  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  // Scroll down to trigger lazy-loaded content
  await autoScroll(page);

  // Wait a bit for animations to settle
  await page.waitForTimeout(1500);
}

/**
 * Auto-scroll the page to trigger lazy loading
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0); // scroll back to top
          resolve();
        }
      }, 100);
    });
  });
}
