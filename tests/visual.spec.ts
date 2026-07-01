import { test, expect } from '@playwright/test';
import { prepareForVisual, setTheme, waitForStableLocatorBox } from './helpers';

/**
 * Pixel-by-pixel visual regression.
 *
 * Each test loads a page, calls prepareForVisual() to make it deterministic
 * (reveal everything, settle counters, freeze motion), waits a beat for layout
 * to stabilise, then snapshots. Snapshots are platform- and project-suffixed
 * via snapshotPathTemplate, so the `desktop` and `mobile` projects each get
 * their own baseline automatically — never hardcode a viewport here.
 */

const SETTLE_MS = 300;
const SECTION_SCREENSHOT_TIMEOUT_MS = 20_000;

test.describe('Home · full page', () => {
  test('light theme', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    // Longer stability budget: the home page is the tallest capture, so Chromium
    // needs more attempts to produce two identical consecutive frames.
    await expect(page).toHaveScreenshot('home-full-light.png', {
      fullPage: true,
      timeout: 20_000,
    });
  });

  test('dark theme', async ({ page }) => {
    await setTheme(page, 'dark');
    await page.goto('/');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page).toHaveScreenshot('home-full-dark.png', {
      fullPage: true,
      timeout: 20_000,
    });
  });
});

test.describe('Home · hero region', () => {
  test('light theme', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    const hero = page.locator('section.hero');
    await waitForStableLocatorBox(page, hero);
    await expect(hero).toHaveScreenshot('hero-light.png', {
      timeout: SECTION_SCREENSHOT_TIMEOUT_MS,
    });
  });

  test('dark theme', async ({ page }) => {
    await setTheme(page, 'dark');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    const hero = page.locator('section.hero');
    await waitForStableLocatorBox(page, hero);
    await expect(hero).toHaveScreenshot('hero-dark.png', {
      timeout: SECTION_SCREENSHOT_TIMEOUT_MS,
    });
  });
});

test.describe('Home · sections', () => {
  test('patronage tiers', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    const patronage = page.locator('#patronage');
    await waitForStableLocatorBox(page, patronage);
    await expect(patronage).toHaveScreenshot('tiers-light.png', {
      timeout: SECTION_SCREENSHOT_TIMEOUT_MS,
    });
  });

  test('manifesto', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    const manifesto = page.locator('#manifesto');
    await waitForStableLocatorBox(page, manifesto);
    await expect(manifesto).toHaveScreenshot('manifesto-light.png', {
      timeout: SECTION_SCREENSHOT_TIMEOUT_MS,
    });
  });
});

test.describe('404 · full page', () => {
  test('light theme', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/404');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page).toHaveScreenshot('not-found-full-light.png', { fullPage: true });
  });
});

test.describe('Secondary pages · full page', () => {
  test('patrons', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/patrons');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page).toHaveScreenshot('patrons-full-light.png', { fullPage: true });
  });

  test('projects', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/projects');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page).toHaveScreenshot('projects-full-light.png', { fullPage: true });
  });

  test('team', async ({ page }) => {
    await setTheme(page, 'light');
    await page.goto('/team');
    await prepareForVisual(page);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page).toHaveScreenshot('team-full-light.png', { fullPage: true });
  });
});
