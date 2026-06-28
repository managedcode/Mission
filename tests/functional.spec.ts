import { test, expect } from '@playwright/test';

// In-page anchors that should each resolve to an element on the home page.
const NAV_ANCHORS = ['#manifesto', '#how', '#maintainers', '#patronage', '#faq'];

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
  test('toggle opens/closes the menu and a link click closes it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const toggle = page.locator('[data-nav-toggle]');
    const menu = page.locator('[data-nav-menu]');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toHaveAttribute('data-open', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toHaveAttribute('data-open', 'true');

    // Clicking an in-menu link closes the menu (see initNav in app.ts).
    await menu.locator('ul a').first().click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toHaveAttribute('data-open', 'false');
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
  test('four salary-grade plans; Mid featured with badge; CTAs lead to the apply form', async ({
    page,
  }) => {
    await page.goto('/');

    const plans = page.locator('#patronage .tiers__plan');
    await expect(plans).toHaveCount(4);

    const featured = page.locator('#patronage [data-plan="mid"]');
    await expect(featured).toHaveCount(1);
    await expect(featured).toHaveClass(/is-featured/);

    const badge = featured.locator('.plan__badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/\S/);

    // Every plan CTA leads to the in-page application form.
    const ctas = page.locator('#patronage .plan__cta');
    await expect(ctas).toHaveCount(4);
    const ctaCount = await ctas.count();
    for (let i = 0; i < ctaCount; i++) {
      await expect(ctas.nth(i)).toHaveAttribute('href', /#apply$/);
    }
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
