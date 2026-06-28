import { test, expect } from '@playwright/test';

/**
 * Lightweight cross-viewport "speed test".
 *
 * Runs on EVERY project in the matrix (phones / tablets / desktops) so a
 * regression that only shows up at a particular size is still caught. The
 * bounds are deliberately GENEROUS — this measures an un-throttled local Astro
 * preview, not a throttled field profile — but they still pin meaningful
 * ceilings (FCP, DOMContentLoaded, and a hard JS transfer budget).
 *
 * Robustness notes:
 *  - We wait for the `load` event before reading metrics.
 *  - Every Performance API read is guarded; missing entries degrade to `null`
 *    / `0` rather than throwing.
 *  - We never touch the LCP observer API (not available everywhere and racy);
 *    paint + navigation timing is enough for a smoke-level budget.
 */

/** Shape of the metrics we pull out of the page in one round-trip. */
interface PerfMetrics {
  fcp: number | null;
  domContentLoaded: number | null;
  loadEventEnd: number | null;
  scriptBytes: number;
  scriptResourceCount: number;
  stylesheetLinks: number;
}

/** Generous bounds suited to an un-throttled local preview. */
const FCP_BUDGET_MS = 3500;
const DCL_BUDGET_MS = 3000;
const SCRIPT_BYTE_BUDGET = 150_000;
/** CSS is inlined by the build, so we expect 0–1 render-blocking stylesheets. */
const MAX_BLOCKING_STYLESHEETS = 1;

/**
 * Collect paint + navigation timing and a script-transfer tally from inside the
 * page. All lookups are defensive so a browser missing a given entry yields a
 * null/zero rather than an exception.
 */
async function collectMetrics(page: import('@playwright/test').Page): Promise<PerfMetrics> {
  return page.evaluate(() => {
    // --- First Contentful Paint (paint timing) ---
    let fcp: number | null = null;
    try {
      const paints = performance.getEntriesByName('first-contentful-paint');
      if (paints.length > 0 && Number.isFinite(paints[0].startTime)) {
        fcp = paints[0].startTime;
      }
    } catch {
      fcp = null;
    }

    // --- Navigation timing (DOMContentLoaded / load) ---
    let domContentLoaded: number | null = null;
    let loadEventEnd: number | null = null;
    try {
      const navs = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const nav = navs[0];
      if (nav) {
        if (Number.isFinite(nav.domContentLoadedEventEnd)) {
          domContentLoaded = nav.domContentLoadedEventEnd;
        }
        if (Number.isFinite(nav.loadEventEnd)) {
          loadEventEnd = nav.loadEventEnd;
        }
      }
    } catch {
      domContentLoaded = null;
      loadEventEnd = null;
    }

    // --- Script transfer total ---
    let scriptBytes = 0;
    let scriptResourceCount = 0;
    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (const r of resources) {
        const isScript = r.initiatorType === 'script' || /\.js(\?|$)/i.test(r.name);
        if (isScript) {
          scriptResourceCount += 1;
          if (Number.isFinite(r.transferSize)) {
            scriptBytes += r.transferSize;
          }
        }
      }
    } catch {
      scriptBytes = 0;
      scriptResourceCount = 0;
    }

    // --- Render-blocking stylesheet links in <head> ---
    let stylesheetLinks = 0;
    try {
      stylesheetLinks = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    } catch {
      /* keep 0 */
    }

    return {
      fcp,
      domContentLoaded,
      loadEventEnd,
      scriptBytes,
      scriptResourceCount,
      stylesheetLinks,
    };
  });
}

test.describe('speed / performance budget', () => {
  test('home page meets timing and JS-size budgets', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'load' });
    // Ensure the load event has fully settled before reading timing entries.
    await page.waitForLoadState('load');

    const m = await collectMetrics(page);

    // Surface the numbers so the matrix output is actually useful.
    const summary =
      `[${testInfo.project.name}] ` +
      `FCP=${m.fcp == null ? 'n/a' : Math.round(m.fcp) + 'ms'} ` +
      `DCL=${m.domContentLoaded == null ? 'n/a' : Math.round(m.domContentLoaded) + 'ms'} ` +
      `load=${m.loadEventEnd == null ? 'n/a' : Math.round(m.loadEventEnd) + 'ms'} ` +
      `script=${m.scriptBytes}B across ${m.scriptResourceCount} file(s)`;
    console.log(summary);
    testInfo.annotations.push({ type: 'perf', description: summary });

    // Timing assertions are SOFT: a slow CI box reports rather than nuking the
    // whole matrix. Only assert when the metric was actually available.
    if (m.fcp != null) {
      expect.soft(m.fcp, 'First Contentful Paint').toBeLessThan(FCP_BUDGET_MS);
    }
    if (m.domContentLoaded != null) {
      expect.soft(m.domContentLoaded, 'DOMContentLoaded').toBeLessThan(DCL_BUDGET_MS);
    }

    // The JS-size budget is a HARD ceiling — bundle bloat should fail the run.
    expect(m.scriptBytes, `total script transfer (${m.scriptBytes} bytes)`).toBeLessThan(
      SCRIPT_BYTE_BUDGET
    );
  });

  test('home page has no excess render-blocking stylesheets', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForLoadState('load');

    const m = await collectMetrics(page);

    const summary = `[${testInfo.project.name}] head <link rel=stylesheet> count=${m.stylesheetLinks}`;
    console.log(summary);
    testInfo.annotations.push({ type: 'perf', description: summary });

    // CSS is inlined by the build, so we expect 0–1 blocking stylesheets.
    expect(
      m.stylesheetLinks,
      `render-blocking stylesheets in <head> (${m.stylesheetLinks})`
    ).toBeLessThanOrEqual(MAX_BLOCKING_STYLESHEETS);
  });
});
