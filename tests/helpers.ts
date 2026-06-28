import type { Page } from '@playwright/test';

export type Theme = 'light' | 'dark';

/**
 * Make a loaded page deterministic for pixel-by-pixel screenshots:
 *  - force every `[data-reveal]` element into its revealed state (`is-visible`)
 *  - fill every `[data-count]` element with its final formatted value, so the
 *    IntersectionObserver-driven counter animation can't leave a partial number
 *  - kill all animations/transitions and hide the CRT overlay
 *
 * Call AFTER the page has loaded (the elements must exist in the DOM).
 */
export async function prepareForVisual(page: Page): Promise<void> {
  await page.evaluate(() => {
    // 1. Reveal everything.
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible');
    });

    // 2. Settle the animated counters on their final value.
    //    Matches the reduced-motion branch in src/scripts/app.ts exactly:
    //    prefix + Number(count).toLocaleString('en-US') + suffix.
    document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
      const prefix = el.dataset.prefix ?? '';
      const suffix = el.dataset.suffix ?? '';
      const target = Number(el.dataset.count ?? '0');
      el.textContent = prefix + target.toLocaleString('en-US') + suffix;
    });

    // 3. Finish the hero terminal typewriter instantly (deterministic frames).
    const w = window as Window & { __finishTerminal?: () => void };
    if (typeof w.__finishTerminal === 'function') w.__finishTerminal();

    // 4. Freeze motion and remove the overlay so frames are stable.
    const style = document.createElement('style');
    style.setAttribute('data-test-freeze', '');
    style.textContent =
      '*,*::before,*::after{animation:none!important;transition:none!important;}' +
      '.crt-overlay{display:none!important;}' +
      // mix-blend-mode grain overlays are GPU-composited and vary sub-pixel
      // between captures (Playwright "screenshot not stable") — drop them
      'body::after,.grain::before{display:none!important;}' +
      '.scroll-progress{display:none!important;}' +
      '.cursor,.cursor__ring{display:none!important;}' +
      // the generative crest (canvas + its glow/idle shimmer) is non-deterministic
      // pixel-to-pixel — keep its reserved box for layout, hide it for stable diffs
      'canvas,.crest{visibility:hidden!important;}' +
      // decorative JS-driven chrome — hide so diffs track content, not sprites
      '.mascot,[data-mascot],.sound-toggle,.intro,[data-intro],.mgame{display:none!important;}' +
      // Un-stick the header so it never floats over section-locator screenshots
      // (its overlap otherwise depends on exact scroll offset → flaky diffs).
      '[data-header]{position:static!important;}';
    document.head.appendChild(style);
  });
}

/**
 * Persist a theme to localStorage BEFORE navigation, so the no-flash inline
 * script in BaseLayout picks it up on first paint. Must be called before
 * `page.goto(...)`.
 */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('mission-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}
