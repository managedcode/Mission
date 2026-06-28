import { test, expect } from '@playwright/test';

// In-page anchors that should each resolve to an element on the home page.
const NAV_ANCHORS = ['#manifesto', '#how', '#maintainers', '#patronage', '#faq'];
const MOBILE_WIDTHS = [320, 360, 375, 390, 414, 430] as const;
const MOBILE_PATHS = ['/', '/patrons', '/projects', '/team', '/404'] as const;
const MOBILE_AUDIT_HEIGHT = 844;

async function prepareForResponsiveAudit(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible');
    });

    const style = document.createElement('style');
    style.setAttribute('data-responsive-audit', '');
    style.textContent =
      '*,*::before,*::after{animation:none!important;transition:none!important;}' +
      '.cursor,.cursor__ring,.scroll-progress,.crt-overlay,.sound-toggle,.mascot,.intro,.mgame{display:none!important;}';
    document.head.appendChild(style);
  });
}

async function collectMobileLayoutIssues(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const pageScrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    );
    const issues: string[] = [];

    if (pageScrollWidth - viewportWidth > 1) {
      issues.push(`document overflows horizontally by ${pageScrollWidth - viewportWidth}px`);
    }

    const visibleElements = Array.from(document.querySelectorAll<HTMLElement>('body *'));
    for (const el of visibleElements) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0
      ) {
        continue;
      }
      if (rect.bottom < 0 || rect.top > viewportHeight * 4) continue;
      if (
        el.closest(
          '.hero__marquee,.starfield,.hero__grid-bg,.scroll-progress,.cursor,.cursor__ring'
        )
      ) {
        continue;
      }

      const overflowLeft = Math.max(0, -rect.left);
      const overflowRight = Math.max(0, rect.right - viewportWidth);
      if (overflowLeft <= 1 && overflowRight <= 1) continue;

      const label =
        el.getAttribute('aria-label') ||
        el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 72) ||
        el.tagName.toLowerCase();
      issues.push(
        `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(/\s+/)[0]}` : ''} (${label}) overflows viewport`
      );
      if (issues.length >= 8) break;
    }

    const criticalText = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1,h2,h3,.btn,.chip,.field__label,.field__input,.repo__name,.repo__downloads,.plan__amount,.funding__label,.patrons__meter-text,.team__pct,.team__caption,.site-footer a'
      )
    );
    for (const el of criticalText) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!text || rect.width <= 0 || rect.height <= 0) continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      if (rect.left < -1 || rect.right > viewportWidth + 1) {
        issues.push(`critical text clipped: "${text.slice(0, 72)}"`);
      }
      if (Number.parseFloat(style.fontSize) < 10) {
        issues.push(`critical text below 10px: "${text.slice(0, 72)}"`);
      }
      if (issues.length >= 12) break;
    }

    return issues;
  });
}

test.describe('Home page · structure & SEO', () => {
  test('returns 200 with a ManagedCode title and a single visible h1', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/ManagedCode/);

    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toBeVisible();

    await expect(page.locator('#hero-heading')).toBeVisible();
  });

  test('primary nav anchors resolve to existing in-page targets', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('[data-nav-menu] ul a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href, `nav link ${i} should have an href`).toBeTruthy();
      if (href && href.includes('#')) {
        // Accept both '#id' and '/#id' (absolute-to-home) — the id must exist.
        const id = '#' + href.split('#').pop();
        await expect(page.locator(id)).toHaveCount(1);
      }
    }

    // Sanity check: the well-known section ids are present.
    for (const anchor of NAV_ANCHORS) {
      await expect(page.locator(anchor)).toHaveCount(1);
    }
  });

  test('SEO meta + JSON-LD structured data are present and well-formed', async ({ page }) => {
    await page.goto('/');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.trim().length ?? 0).toBeGreaterThan(0);

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage?.trim().length ?? 0).toBeGreaterThan(0);

    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(raw, 'JSON-LD script should have content').toBeTruthy();

    const data = JSON.parse(raw as string);
    const graph: Array<{ '@type'?: string }> = data['@graph'];
    expect(Array.isArray(graph)).toBe(true);

    const types = graph.map((node) => node['@type']);
    for (const expected of ['Organization', 'WebSite', 'FAQPage', 'Service']) {
      expect(types).toContain(expected);
    }
  });

  test('no severe console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/', { waitUntil: 'networkidle' });

    expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  });
});

test.describe('Agent accessibility files', () => {
  test('llms.txt is Markdown with a heading and crawlable links', async ({ page }) => {
    const response = await page.goto('/llms.txt');
    expect(response?.status()).toBe(200);

    const body = await response?.text();
    expect(body, 'llms.txt should be served').toBeTruthy();
    expect(body).toMatch(/^#\s+\S/m);
    expect(body).toMatch(/\[[^\]\n]+\]\(https:\/\/[^)\s]+\)/);
  });
});

test.describe('Theme toggle', () => {
  test('flips html[data-theme] and persists to localStorage', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    expect(before === 'light' || before === 'dark').toBe(true);

    await page.locator('[data-theme-toggle]').first().click();

    const expectedAfter = before === 'dark' ? 'light' : 'dark';
    await expect(html).toHaveAttribute('data-theme', expectedAfter);

    const stored = await page.evaluate(() => localStorage.getItem('mission-theme'));
    expect(stored).toBe(expectedAfter);
  });
});

test.describe('Mobile navigation', () => {
  test('toggle opens/closes the menu and a link click closes it across phone widths', async ({
    page,
  }) => {
    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: MOBILE_AUDIT_HEIGHT });
      await page.goto('/');

      const toggle = page.locator('[data-nav-toggle]');
      const menu = page.locator('[data-nav-menu]');

      await expect(toggle, `${width}px menu toggle starts closed`).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      await expect(menu, `${width}px menu starts closed`).toHaveAttribute('data-open', 'false');

      await toggle.click();
      await expect(toggle, `${width}px menu toggle opens`).toHaveAttribute('aria-expanded', 'true');
      await expect(menu, `${width}px menu opens`).toHaveAttribute('data-open', 'true');

      const menuBox = await menu.boundingBox();
      expect(menuBox, `${width}px menu should have a visible box`).toBeTruthy();
      expect(
        menuBox?.x ?? 0,
        `${width}px menu should start inside viewport`
      ).toBeGreaterThanOrEqual(-1);
      expect(
        (menuBox?.x ?? 0) + (menuBox?.width ?? 0),
        `${width}px menu should fit viewport width`
      ).toBeLessThanOrEqual(width + 1);

      // Clicking an in-menu link closes the menu (see initNav in app.ts).
      await menu.locator('ul a').first().click();
      await expect(toggle, `${width}px menu toggle closes after link`).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      await expect(menu, `${width}px menu closes after link`).toHaveAttribute('data-open', 'false');
    }
  });
});

test.describe('Mobile viewport coverage', () => {
  test('key pages stay readable from 320px through large-phone widths', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Runs once with explicit viewport sizes; visual/perf specs cover the full device matrix.'
    );

    for (const path of MOBILE_PATHS) {
      for (const width of MOBILE_WIDTHS) {
        await page.setViewportSize({ width, height: MOBILE_AUDIT_HEIGHT });
        await page.goto(path);
        await prepareForResponsiveAudit(page);

        await expect(page.locator('[data-header]'), `${path} ${width}px header`).toBeVisible();
        await expect(page.locator('main'), `${path} ${width}px main`).toBeVisible();
        await expect(page.locator('h1'), `${path} ${width}px h1 count`).toHaveCount(1);
        await expect(page.locator('h1'), `${path} ${width}px h1 visible`).toBeVisible();

        const issues = await collectMobileLayoutIssues(page);
        expect(issues, `${path} at ${width}px should not clip or overflow`).toEqual([]);
      }
    }
  });
});

test.describe('Mission Run mini-game', () => {
  test('holding Space extends one jump without auto-jumping on landing', async ({ page }) => {
    test.skip(!test.info().project.name.startsWith('desktop'), 'keyboard-only game path');

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => { y: number; onGround: boolean; state: string };
          }
        ).__mgame?.();
        return state ?? null;
      });

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      (
        window as Window & {
          __mgameSpaceRepeat?: number;
        }
      ).__mgameSpaceRepeat = window.setInterval(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true })
        );
      }, 30);
    });

    await page.waitForTimeout(1500);

    const samples: Array<{ y: number; onGround: boolean }> = [];
    for (let i = 0; i < 4; i++) {
      const state = await readGame();
      expect(state?.state).toBe('play');
      samples.push({ y: state?.y ?? -1, onGround: state?.onGround ?? false });
      await page.waitForTimeout(80);
    }

    await page.evaluate(() => {
      const w = window as Window & { __mgameSpaceRepeat?: number };
      if (w.__mgameSpaceRepeat) window.clearInterval(w.__mgameSpaceRepeat);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    });

    expect(samples).toEqual(samples.map((sample) => ({ ...sample, onGround: true })));
    const restingY = samples[0]?.y;
    expect(new Set(samples.map((sample) => sample.y))).toEqual(new Set([restingY]));

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true }));
    });
    await page.waitForTimeout(240);

    const repeatOnlyState = await readGame();
    expect(repeatOnlyState?.onGround).toBe(true);
    expect(repeatOnlyState?.y).toBe(restingY);

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    });
  });
});

test.describe('FAQ disclosure', () => {
  test('first item starts open; a closed item opens on summary click', async ({ page }) => {
    await page.goto('/');

    const items = page.locator('#faq .faq__item');
    expect(await items.count()).toBeGreaterThan(1);

    // Native <details> semantics: first item is open by default.
    await expect(items.first()).toHaveAttribute('open', '');

    const second = items.nth(1);
    await expect(second).not.toHaveAttribute('open', /.*/);

    await second.locator('summary').click();
    await expect(second).toHaveAttribute('open', '');
  });
});

test.describe('Patronage tiers', () => {
  test('three salary-grade plans; Mid featured with badge; CTAs lead to the apply form', async ({
    page,
  }) => {
    await page.goto('/');

    const plans = page.locator('#patronage .tiers__plan');
    await expect(plans).toHaveCount(3);
    // Trainee was retired — only Junior / Mid / Senior remain.
    await expect(page.locator('#patronage [data-plan="trainee"]')).toHaveCount(0);

    const featured = page.locator('#patronage [data-plan="mid"]');
    await expect(featured).toHaveCount(1);
    await expect(featured).toHaveClass(/is-featured/);

    const badge = featured.locator('.plan__badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/\S/);

    // Each plan visualizes its reserved capacity as a pixel meter.
    await expect(page.locator('#patronage .plan__meter-bar')).toHaveCount(3);

    // Every plan CTA leads to the in-page application form.
    const ctas = page.locator('#patronage .plan__cta');
    await expect(ctas).toHaveCount(3);
    const ctaCount = await ctas.count();
    for (let i = 0; i < ctaCount; i++) {
      await expect(ctas.nth(i)).toHaveAttribute('href', /#apply$/);
    }
  });
});

test.describe('Apply form', () => {
  const missionEndpoint =
    'https://func-managed-code-form-crm.azurewebsites.net/api/managed-code/mission';

  test('is wired to the ManagedCode Mission CRM endpoint with reCAPTCHA metadata', async ({
    page,
  }) => {
    await page.goto('/');

    const form = page.locator('[data-apply-form]');
    await expect(form).toHaveAttribute('data-endpoint', missionEndpoint);
    await expect(form).toHaveAttribute('action', missionEndpoint);
    await expect(form).toHaveAttribute('data-recaptcha-action', 'mission_patronage');
    await expect(form).toHaveAttribute('data-form-type', 'mission_patronage');
    await expect(page.locator('[data-apply-submit]')).toBeEnabled();
    await expect(page.locator('.apply__recaptcha')).toContainText(/protected by reCAPTCHA/i);
  });

  test('submits enriched open-source patronage payload with a reCAPTCHA token', async ({
    page,
  }) => {
    let capturedPayload: Record<string, unknown> | undefined;

    await page.addInitScript(() => {
      const w = window as Window & {
        grecaptcha?: {
          ready(cb: () => void): void;
          execute(siteKey: string, options: { action: string }): Promise<string>;
        };
        __missionRecaptchaCall?: { siteKey: string; action: string };
      };
      w.grecaptcha = {
        ready(cb: () => void) {
          cb();
        },
        async execute(siteKey: string, options: { action: string }) {
          w.__missionRecaptchaCall = { siteKey, action: options.action };
          return 'test-recaptcha-token';
        },
      };
    });

    await page.route(missionEndpoint, async (route) => {
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type, accept',
        'access-control-allow-methods': 'POST, OPTIONS',
      };

      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }

      capturedPayload = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers,
        body: JSON.stringify({ ok: true, submissionId: 'web_test' }),
      });
    });

    await page.goto('/');
    await page.locator('#apply-company').fill('Example SaaS');
    await page.locator('#apply-email').fill('cto@example.com');
    await page.locator('#apply-name').fill('Alex CTO');
    await page.locator('#apply-grade').selectOption('Mid');
    await page.locator('#apply-stack').fill('ManagedCode.Storage and Orleans.SignalR');
    await page.locator('#apply-budget').selectOption('Recommended operating lane');
    await page.locator('#apply-timeline').selectOption('This quarter');
    await page.locator('#apply-notes').fill('We want a written SLA for the packages we depend on.');

    await page.getByRole('button', { name: /send it to the maintainers/i }).click();

    await expect(page.locator('[data-apply-success]')).toBeVisible();
    expect(capturedPayload?.email).toBe('cto@example.com');
    expect(capturedPayload?.companyName).toBe('Example SaaS');
    expect(capturedPayload?.currentStack).toBe('ManagedCode.Storage and Orleans.SignalR');
    expect(capturedPayload?.managedCodeFormType).toBe('mission_patronage');
    expect(capturedPayload?.serviceInterest).toBe('Open-source patronage');
    expect(capturedPayload?.recaptchaToken).toBe('test-recaptcha-token');
    expect(capturedPayload?.recaptchaAction).toBe('mission_patronage');
    expect(capturedPayload?.message).toContain('ManagedCode.Storage and Orleans.SignalR');

    const metadata = capturedPayload?.metadata as Record<string, string | undefined>;
    expect(metadata.initiative).toBe('open_source_patronage');
    expect(metadata.openSource).toBe('true');
    expect(metadata.patronageGrade).toBe('Mid');
    expect(metadata.fundingShape).toBe('Recommended operating lane');

    const recaptchaCall = await page.evaluate(
      () =>
        (
          window as Window & {
            __missionRecaptchaCall?: { siteKey: string; action: string };
          }
        ).__missionRecaptchaCall
    );
    expect(recaptchaCall?.action).toBe('mission_patronage');
    expect(recaptchaCall?.siteKey.length ?? 0).toBeGreaterThan(0);
  });
});

test.describe('Animated counters', () => {
  test('a counter settles on its expected formatted value once in view', async ({ page }) => {
    await page.goto('/');

    const counters = page.locator('[data-count]');
    expect(await counters.count()).toBeGreaterThan(0);

    const first = counters.first();
    await first.scrollIntoViewIfNeeded();

    // Compute the expected final string the same way app.ts does.
    const expected = await first.evaluate((el) => {
      const e = el as HTMLElement;
      const prefix = e.dataset.prefix ?? '';
      const suffix = e.dataset.suffix ?? '';
      const target = Number(e.dataset.count ?? '0');
      return prefix + target.toLocaleString('en-US') + suffix;
    });

    await expect(async () => {
      expect((await first.textContent())?.trim()).toBe(expected);
    }).toPass({ timeout: 5000 });
  });
});

test.describe('Accessibility-lite', () => {
  test('skip link targets #main', async ({ page }) => {
    await page.goto('/');

    const skip = page.locator('a.skip-link');
    await expect(skip).toHaveAttribute('href', '#main');
    await expect(page.locator('#main')).toHaveCount(1);
  });

  test('every link has discernible text or an aria-label', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const accessibleName = await link.evaluate((el) => {
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        const aria = el.getAttribute('aria-label')?.trim() ?? '';
        const title = el.getAttribute('title')?.trim() ?? '';
        // An <a> wrapping an aria-labelled/imaged child still counts.
        const labelledChild = el.querySelector('[aria-label],img[alt]');
        return text || aria || title || (labelledChild ? 'child' : '');
      });
      const href = await link.getAttribute('href');
      expect(accessibleName, `link ${i} (href=${href}) needs an accessible name`).not.toBe('');
    }
  });

  test('images and role=img svgs expose an accessible name', async ({ page }) => {
    await page.goto('/');

    // <img> elements must have non-empty alt (or be aria-hidden).
    const imgs = page.locator('img');
    const imgCount = await imgs.count();
    for (let i = 0; i < imgCount; i++) {
      const img = imgs.nth(i);
      const hidden = await img.getAttribute('aria-hidden');
      if (hidden === 'true') continue;
      const alt = await img.getAttribute('alt');
      expect(alt, `img ${i} needs alt text`).not.toBeNull();
      expect((alt ?? '').length).toBeGreaterThan(0);
    }

    // Any svg with role="img" must carry a name (aria-label / <title>).
    const svgImgs = page.locator('svg[role="img"]');
    const svgCount = await svgImgs.count();
    for (let i = 0; i < svgCount; i++) {
      const svg = svgImgs.nth(i);
      const name = await svg.evaluate((el) => {
        const aria = el.getAttribute('aria-label')?.trim() ?? '';
        const titleEl = el.querySelector('title');
        const title = titleEl?.textContent?.trim() ?? '';
        return aria || title;
      });
      expect(name, `svg[role=img] ${i} needs an accessible name`).not.toBe('');
    }
  });
});

test.describe('404 page', () => {
  test('renders the "never merged" heading with noindex and a home link', async ({ page }) => {
    await page.goto('/404');

    await expect(page.locator('h1')).toContainText(/never merged/i);

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);

    const returnLink = page.getByRole('link', { name: /return to the mission/i });
    await expect(returnLink).toHaveAttribute('href', '/');
  });
});

test.describe('Secondary pages', () => {
  for (const path of ['/patrons', '/projects', '/team']) {
    test(`${path} loads: 200, one h1, noindex, header+footer, link home`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();

      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveAttribute('content', /noindex/);

      await expect(page.locator('[data-header]')).toBeVisible();
      await expect(page.locator('.site-footer')).toBeVisible();

      // a link back to the home page exists
      expect(await page.locator('a[href="/"]').count()).toBeGreaterThan(0);
    });
  }

  test('footer links to /patrons, /projects and /team from the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-footer a[href="/patrons"]')).toHaveCount(1);
    await expect(page.locator('.site-footer a[href="/projects"]')).toHaveCount(1);
    await expect(page.locator('.site-footer a[href="/team"]')).toHaveCount(1);
  });
});
