import { test, expect } from '@playwright/test';
// In-page anchors that should each resolve to an element on the home page.
const NAV_ANCHORS = ['#manifesto', '#how', '#maintainers', '#patronage', '#faq'];
const MOBILE_WIDTHS = [320, 360, 375, 390, 414, 430] as const;
const MOBILE_PATHS = ['/', '/patrons', '/projects', '/team', '/404'] as const;
const MOBILE_AUDIT_HEIGHT = 844;
const DESKTOP_AUDIT_VIEWPORT = { width: 1440, height: 900 } as const;

async function useDesktopAuditViewport(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize(DESKTOP_AUDIT_VIEWPORT);
}

function rgb(color: string): [number, number, number] {
  const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
  expect(channels.length).toBeGreaterThanOrEqual(3);
  return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

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
          '.hero__marquee,.starfield,.hero__grid-bg,.scroll-progress,.cursor,.cursor__ring,.manifesto__ghost'
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

  test('hero terminal keeps its anchor when the typewriter clears text @desktop', async ({
    page,
  }) => {
    await page.goto('/');
    await prepareForResponsiveAudit(page);
    await page.locator('.crest__status').waitFor({ state: 'visible' });
    await page.waitForFunction(() =>
      document.querySelector<HTMLElement>('.crest__status')?.style.minBlockSize.endsWith('px')
    );

    const samples = await page.evaluate(async () => {
      (window as Window & { __finishTerminal?: () => void }).__finishTerminal?.();
      const crest = document.querySelector<HTMLElement>('.hero__crest');
      const status = document.querySelector<HTMLElement>('.crest__status');
      const code = document.querySelector<HTMLElement>('.terminal__body code');
      if (!crest || !status || !code) return null;

      const spans = Array.from(code.querySelectorAll<HTMLElement>('span'));
      const originalText = spans.map((span) => span.textContent ?? '');
      const measure = () => {
        const crestRect = crest.getBoundingClientRect();
        const statusRect = status.getBoundingClientRect();
        return {
          crestTop: crestRect.top,
          statusTop: statusRect.top,
          statusHeight: statusRect.height,
        };
      };

      const frames: Array<ReturnType<typeof measure> & { textLength: number }> = [];
      frames.push({ ...measure(), textLength: code.textContent?.length ?? 0 });

      spans.forEach((span) => {
        span.textContent = '';
        span.classList.remove('caret');
      });
      spans[0]?.classList.add('caret');
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      frames.push({ ...measure(), textLength: code.textContent?.length ?? 0 });

      if (spans[0]) spans[0].textContent = originalText[0]?.slice(0, 8) ?? '';
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      frames.push({ ...measure(), textLength: code.textContent?.length ?? 0 });

      spans.forEach((span, i) => {
        span.textContent = originalText[i] ?? '';
      });
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      frames.push({ ...measure(), textLength: code.textContent?.length ?? 0 });

      return frames;
    });

    expect(samples).not.toBeNull();
    const frames = samples ?? [];
    const heightDelta =
      Math.max(...frames.map((frame) => frame.statusHeight)) -
      Math.min(...frames.map((frame) => frame.statusHeight));
    const crestTopDelta =
      Math.max(...frames.map((frame) => frame.crestTop)) -
      Math.min(...frames.map((frame) => frame.crestTop));
    const statusTopDelta =
      Math.max(...frames.map((frame) => frame.statusTop)) -
      Math.min(...frames.map((frame) => frame.statusTop));
    const typedDelta =
      Math.max(...frames.map((frame) => frame.textLength)) -
      Math.min(...frames.map((frame) => frame.textLength));

    expect(heightDelta).toBeLessThanOrEqual(1);
    expect(crestTopDelta).toBeLessThanOrEqual(1);
    expect(statusTopDelta).toBeLessThanOrEqual(1);
    expect(typedDelta).toBeGreaterThan(10);
  });

  test('hero crest stays compact and fully typed on narrow phones @mobile-audit', async ({
    page,
  }) => {
    for (const width of [320, 360, 390, 414] as const) {
      await page.setViewportSize({ width, height: MOBILE_AUDIT_HEIGHT });
      await page.goto('/', { waitUntil: 'networkidle' });

      await page.locator('.hero__crest').scrollIntoViewIfNeeded();
      await expect(page.locator('.hero__crest'), `${width}px crest`).toBeVisible();
      await expect
        .poll(
          () =>
            page
              .locator('.hero__crest')
              .evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity)),
          { message: `${width}px crest should finish its reveal transition` }
        )
        .toBeGreaterThan(0.95);
      await expect(page.locator('.crest__status'), `${width}px mission status`).toContainText(
        'mission: we staff them'
      );

      const metrics = await page.evaluate(() => {
        const wrap = document.querySelector<HTMLElement>('.hero__crest');
        const crest = document.querySelector<HTMLElement>('.crest');
        const status = document.querySelector<HTMLElement>('.crest__status');
        const code = document.querySelector<HTMLElement>('.crest__status code');
        if (!wrap || !crest || !status || !code) return null;

        const wrapRect = wrap.getBoundingClientRect();
        const crestRect = crest.getBoundingClientRect();
        const statusRect = status.getBoundingClientRect();
        const wrapStyle = getComputedStyle(wrap);

        return {
          flexDirection: wrapStyle.flexDirection,
          wrapHeight: wrapRect.height,
          wrapLeft: wrapRect.left,
          wrapRight: wrapRect.right,
          crestRight: crestRect.right,
          crestBottom: crestRect.bottom,
          statusLeft: statusRect.left,
          statusTop: statusRect.top,
          statusRight: statusRect.right,
          text: code.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        };
      });

      expect(metrics, `${width}px metrics should exist`).not.toBeNull();
      if (!metrics) continue;

      expect(metrics.flexDirection, `${width}px crest/status should stay in one row`).toBe('row');
      expect(
        metrics.statusLeft,
        `${width}px status should sit to the right of the mark`
      ).toBeGreaterThan(metrics.crestRight);
      expect(
        metrics.statusTop,
        `${width}px status should vertically overlap the mark row`
      ).toBeLessThan(metrics.crestBottom);
      expect(metrics.wrapLeft, `${width}px crest should not overflow left`).toBeGreaterThanOrEqual(
        0
      );
      expect(metrics.wrapRight, `${width}px crest should not overflow right`).toBeLessThanOrEqual(
        width
      );
      expect(
        metrics.statusRight,
        `${width}px status should not overflow right`
      ).toBeLessThanOrEqual(width);
      expect(
        metrics.wrapHeight,
        `${width}px crest should not become a tall empty column`
      ).toBeLessThanOrEqual(96);
      expect(metrics.text, `${width}px terminal should not be caught mid-type`).toContain(
        '> open source in your stack: 98%'
      );
    }
  });

  test('Konami reveals the hero shader power-of-two easter egg @desktop', async ({ page }) => {
    await useDesktopAuditViewport(page);
    await page.goto('/');

    const crest = page.locator('[data-hero-field]');
    await expect(crest).toBeVisible();
    await expect(crest).not.toHaveAttribute('data-field-egg', '2^15');

    for (const key of [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'b',
      'a',
    ]) {
      await page.keyboard.press(key);
    }

    await expect(page.locator('html')).toHaveClass(/konami/);
    await expect(crest).toHaveAttribute('data-field-egg', '2^15');

    for (const key of [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'b',
      'a',
    ]) {
      await page.keyboard.press(key);
    }

    await expect(page.locator('html')).not.toHaveClass(/konami/);
    await expect(crest).not.toHaveAttribute('data-field-egg', '2^15');
  });

  test('hero emblem cursor parallax stays subtle on desktop @desktop', async ({ page }) => {
    await useDesktopAuditViewport(page);
    await page.goto('/');

    const mark = page.locator('.crest__mark');
    await expect(mark).toBeVisible();

    const sampleTransform = async (x: number, y: number) => {
      await page.mouse.move(x, y);
      await page.waitForTimeout(50);
      return await mark.evaluate((el) => (el as HTMLElement).style.transform);
    };

    const transforms = [
      await sampleTransform(128, 180),
      await sampleTransform(720, 360),
      await sampleTransform(1370, 540),
    ];

    for (const transform of transforms) {
      const offsets = Array.from(transform.matchAll(/([-+]?\d+(?:\.\d+)?)px/g)).map((match) =>
        Math.abs(Number(match[1]))
      );
      expect(offsets.length, transform).toBe(2);
      expect(Math.max(...offsets), transform).toBeLessThanOrEqual(3);
    }
  });

  test('tab-away title is human-readable and restores the SEO title', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
    });

    await page.goto('/');
    const originalTitle = await page.title();

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page).toHaveTitle('Come back — the commons needs you');
    expect(await page.title()).not.toContain('//');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page).toHaveTitle(originalTitle);
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
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const head = await page.evaluate(() => ({
      description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      ogImage: document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content,
      jsonLd: document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')
        ?.textContent,
    }));

    const description = head.description;
    expect(description?.trim().length ?? 0).toBeGreaterThan(0);

    expect(head.canonicalCount).toBe(1);

    const ogImage = head.ogImage;
    expect(ogImage?.trim().length ?? 0).toBeGreaterThan(0);

    const raw = head.jsonLd;
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

  test('sound toggle is available by default and enables the WebAudio bridge @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.addInitScript(() => {
      const w = window as Window & {
        AudioContext: unknown;
        __missionAudioStarts?: number;
      };
      class FakeAudioParam {
        setValueAtTime() {
          /* test double */
        }
        exponentialRampToValueAtTime() {
          /* test double */
        }
      }
      class FakeGainNode {
        gain = new FakeAudioParam();
        connect(node: unknown) {
          return node;
        }
      }
      class FakeOscillatorNode {
        frequency = new FakeAudioParam();
        type = 'square';
        connect(node: unknown) {
          return node;
        }
        start() {
          w.__missionAudioStarts = (w.__missionAudioStarts ?? 0) + 1;
        }
        stop() {
          /* test double */
        }
      }
      class FakeAudioContext {
        currentTime = 0;
        destination = {};
        state = 'running';
        createGain() {
          return new FakeGainNode();
        }
        createOscillator() {
          return new FakeOscillatorNode();
        }
        resume() {
          return Promise.resolve();
        }
      }
      w.__missionAudioStarts = 0;
      w.AudioContext = FakeAudioContext;
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    const toggle = page.locator('[data-sound-toggle]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Enable pixel sound effects');
    const toggleStyles = await toggle.evaluate((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
    expect(toggleStyles.width).toBeLessThanOrEqual(40);
    expect(toggleStyles.height).toBeLessThanOrEqual(40);
    expect(toggleStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(toggleStyles.borderColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(toggleStyles.boxShadow).not.toBe('none');
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(window.__missionSound && window.__missionSound.isOn() === false)
        )
      )
      .toBe(true);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Mute pixel sound effects');
    await expect.poll(() => page.evaluate(() => window.__missionSound?.isOn())).toBe(true);

    const startsAfterEnable = await page.evaluate(
      () => (window as Window & { __missionAudioStarts?: number }).__missionAudioStarts ?? 0
    );
    await page.evaluate(() => {
      document
        .querySelector('[data-mascot]')
        ?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __missionAudioStarts?: number }).__missionAudioStarts ?? 0
        )
      )
      .toBeGreaterThan(startsAfterEnable);
  });

  test('persisted sound preference does not start WebAudio before a gesture @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    const audioWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('AudioContext')) {
        audioWarnings.push(msg.text());
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('mission-sound', 'on');
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('[data-sound-toggle]')).toBeVisible();
    await expect(page.locator('.site-header .btn--accent')).toHaveCount(1);
    await page.locator('.site-header .btn--accent').hover();
    await page.waitForTimeout(50);
    expect(audioWarnings, `AudioContext warnings: ${audioWarnings.join(' | ')}`).toHaveLength(0);

    await page.locator('[data-theme-toggle]').click();
    await page.waitForTimeout(50);
    expect(audioWarnings, `AudioContext warnings: ${audioWarnings.join(' | ')}`).toHaveLength(0);
  });

  test('motto copy promises maintained open source instead of pass-it-on charity', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('.hero__marquee')).toContainText('RELY ON IT');
    await expect(page.locator('.hero__marquee')).toContainText('KEEP IT MAINTAINED');
    await expect(page.locator('.final-cta__marquee')).toContainText('RELY ON IT');
    await expect(page.locator('body')).not.toContainText('PASS IT ON');

    const html = await page.content();
    expect(html).not.toContain('Pass it on');
    expect(html).not.toContain('PASS IT ON');
  });

  test('does not render the CRT scanline overlay in the default page state', async ({ page }) => {
    await page.goto('/#apply');

    await expect(page.locator('.crt-overlay')).toHaveCSS('display', 'none');
  });

  test('light theme keeps non-inverted text crisp without text shadows', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mission-theme', 'light');
    });
    await page.goto('/');
    await prepareForResponsiveAudit(page);

    const offenders = await page.evaluate(() => {
      return Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => {
          if (element.closest('[hidden]')) return false;

          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (rect.width <= 0 || rect.height <= 0) return false;
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0
          ) {
            return false;
          }

          return style.textShadow !== 'none';
        })
        .map((element) => {
          const style = getComputedStyle(element);
          const label =
            element.className ||
            element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 48) ||
            element.tagName.toLowerCase();

          return `${element.tagName.toLowerCase()}.${String(label)} => ${style.textShadow}`;
        });
    });

    const pseudoOffenders = await page.evaluate(() => {
      const lead = document.querySelector<HTMLElement>('#manifesto .manifesto__p--lead');
      if (!lead) return ['manifesto lead paragraph missing'];

      const firstLetterShadow = getComputedStyle(lead, '::first-letter').textShadow;
      return firstLetterShadow === 'none' ? [] : [`manifesto first-letter => ${firstLetterShadow}`];
    });

    expect([...offenders, ...pseudoOffenders]).toEqual([]);
  });

  test('how-it-works cards align with the section text column on desktop @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/#how');
    await prepareForResponsiveAudit(page);
    await page.locator('#how').scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      const heading = document.querySelector<HTMLElement>('#how-h');
      const firstCard = document.querySelector<HTMLElement>('#how .how__card');
      const headingRect = heading?.getBoundingClientRect();
      const cardRect = firstCard?.getBoundingClientRect();

      return {
        headingLeft: Math.round(headingRect?.left ?? -1),
        cardLeft: Math.round(cardRect?.left ?? -1),
      };
    });

    expect(Math.abs(metrics.cardLeft - metrics.headingLeft)).toBeLessThanOrEqual(1);
  });

  test('manifesto keeps breathing room above the bottom pixel word @desktop', async ({ page }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/#manifesto');
    await prepareForResponsiveAudit(page);
    await page.locator('#manifesto').scrollIntoViewIfNeeded();

    const spacing = await page.evaluate(() => {
      const lastParagraph = document.querySelector<HTMLElement>(
        '#manifesto .manifesto__prose .manifesto__p:last-child'
      );
      const stamp = document.querySelector<HTMLElement>('#manifesto .manifesto__stamp');
      const ghost = document.querySelector<HTMLElement>('#manifesto .manifesto__ghost');

      const lastParagraphRect = lastParagraph?.getBoundingClientRect();
      const stampRect = stamp?.getBoundingClientRect();
      const ghostRect = ghost?.getBoundingClientRect();

      return {
        paragraphToGhost: Math.round((ghostRect?.top ?? 0) - (lastParagraphRect?.bottom ?? 0)),
        stampToGhost: Math.round((ghostRect?.top ?? 0) - (stampRect?.bottom ?? 0)),
      };
    });

    expect(spacing.paragraphToGhost).toBeGreaterThanOrEqual(240);
    expect(spacing.stampToGhost).toBeGreaterThanOrEqual(48);
  });

  test('mascot speech bubble and sprite keep readable contrast on inverted sections @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        el.classList.add('is-visible');
      });
      const manifesto = document.getElementById('manifesto');
      if (manifesto) {
        window.scrollTo(0, manifesto.getBoundingClientRect().top + window.scrollY + 340);
        window.dispatchEvent(new Event('scroll'));
      }
      const mascot = document.querySelector<HTMLElement>('[data-mascot]');
      const bubble = document.createElement('span');
      bubble.className = 'mascot__say font-pixel';
      bubble.dataset.show = 'true';
      bubble.textContent = 'closing as wontfix';
      mascot?.appendChild(bubble);
    });

    const mascot = page.locator('[data-mascot]');
    await expect(mascot).toHaveAttribute('data-over-invert', 'true');

    const bubble = page.locator('.mascot__say');
    await expect(bubble).toBeVisible();
    const bubbleBox = await bubble.boundingBox();
    const viewport = page.viewportSize();

    const styles = await bubble.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
      };
    });
    const spriteStyles = await page.evaluate(() => {
      const mascot = document.querySelector<HTMLElement>('[data-mascot]');
      const leg = mascot?.querySelector<SVGRectElement>('[data-part="leg"]');
      const surface = document.getElementById('manifesto');

      return {
        legColor: leg ? getComputedStyle(leg).fill : '',
        surfaceColor: surface ? getComputedStyle(surface).backgroundColor : '',
      };
    });

    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(contrastRatio(styles.color, styles.backgroundColor)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(spriteStyles.legColor, spriteStyles.surfaceColor)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(bubbleBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((bubbleBox?.x ?? 0) + (bubbleBox?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  });

  test('corner mascot has twenty-five rotating play prompts @desktop', async ({ page }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    const quips = await page.evaluate(() => {
      return (window as Window & { __missionMascotQuips?: string[] }).__missionMascotQuips ?? [];
    });

    expect(quips).toHaveLength(25);
    expect(new Set(quips).size).toBe(25);
    expect(quips).toContain('click me');
    expect(quips).toContain('click to play');
    expect(quips).toContain('play maintainer day');
  });

  test('corner mascot runs toward the mouse on desktop when roaming is enabled @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.addInitScript(() => {
      (
        window as Window & {
          __missionMascotRoamingTest?: boolean;
        }
      ).__missionMascotRoamingTest = true;
    });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));

    const mascot = page.locator('[data-mascot]');
    await expect(mascot).toHaveClass(/mascot--roaming/);

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            Number(
              getComputedStyle(document.querySelector<HTMLElement>('[data-mascot]')!)
                .getPropertyValue('--mx')
                .trim()
            )
          ),
        { timeout: 1000 }
      )
      .toBeGreaterThan(0);

    await page.mouse.move(640, 500);
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            Number(
              getComputedStyle(document.querySelector<HTMLElement>('[data-mascot]')!)
                .getPropertyValue('--mx')
                .trim()
            )
          ),
        { timeout: 3000 }
      )
      .toBeGreaterThan(120);

    await page.mouse.move(40, 500);
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            getComputedStyle(document.querySelector<HTMLElement>('.mascot__sprite')!)
              .getPropertyValue('--face')
              .trim()
          ),
        { timeout: 3000 }
      )
      .toBe('-1');
  });

  test('corner mascot shows the first quip even when roaming is disabled @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.addInitScript(() => {
      (
        window as Window & {
          __missionMascotQuipTest?: boolean;
        }
      ).__missionMascotQuipTest = true;
    });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));

    const mascot = page.locator('[data-mascot]');
    await expect(mascot).not.toHaveClass(/mascot--roaming/);

    const bubble = page.locator('.mascot__say');
    await expect(bubble).toHaveText('click me');
    await expect(bubble).toHaveAttribute('data-show', 'true');
    await expect(bubble).toBeVisible();
  });

  test('corner mascot keeps cycling quips after the first message @desktop', async ({ page }) => {
    await useDesktopAuditViewport(page);

    await page.addInitScript(() => {
      (
        window as Window & {
          __missionMascotQuipTest?: boolean;
        }
      ).__missionMascotQuipTest = true;
    });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));

    const bubble = page.locator('.mascot__say');
    await expect(bubble).toHaveText('click me');
    await expect(bubble).toHaveAttribute('data-show', 'true');

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const quip = document.querySelector<HTMLElement>('.mascot__say');
            const text = quip?.textContent?.trim() ?? '';
            return quip?.dataset.show === 'true' && text.length > 0 && text !== 'click me';
          }),
        { timeout: 3000 }
      )
      .toBe(true);
  });

  test('corner mascot opens with a visible maintainer quip when roaming is enabled @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.addInitScript(() => {
      (
        window as Window & {
          __missionMascotRoamingTest?: boolean;
        }
      ).__missionMascotRoamingTest = true;
    });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));

    const bubble = page.locator('.mascot__say');
    await expect(bubble).toHaveText('click me');
    await expect(bubble).toHaveAttribute('data-show', 'true');
    await expect(bubble).toBeVisible();
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
  test('applies stored dark theme-color before interaction', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mission-theme', 'dark');
    });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#131109');
    const htmlBackground = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor
    );
    expect(htmlBackground).toBe('rgb(19, 17, 9)');
  });

  test('flips html[data-theme], theme-color, and persists to localStorage', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    expect(before === 'light' || before === 'dark').toBe(true);
    const expectedBeforeColor = before === 'dark' ? '#131109' : '#f1ece0';
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      expectedBeforeColor
    );

    await page.locator('[data-theme-toggle]').first().click();

    const expectedAfter = before === 'dark' ? 'light' : 'dark';
    await expect(html).toHaveAttribute('data-theme', expectedAfter);
    const expectedAfterColor = expectedAfter === 'dark' ? '#131109' : '#f1ece0';
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      expectedAfterColor
    );

    const htmlBackground = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor
    );
    expect(htmlBackground).toBe(expectedAfter === 'dark' ? 'rgb(19, 17, 9)' : 'rgb(241, 236, 224)');

    const stored = await page.evaluate(() => localStorage.getItem('mission-theme'));
    expect(stored).toBe(expectedAfter);
  });
});

test.describe('Mobile navigation', () => {
  test('compact header wordmark aligns with the hero content edge @mobile-audit', async ({
    page,
  }) => {
    for (const width of [360, 430, 600, 900, 1024, 1200] as const) {
      await page.setViewportSize({ width, height: MOBILE_AUDIT_HEIGHT });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await prepareForResponsiveAudit(page);

      const metrics = await page.evaluate(() => {
        const name = document.querySelector<HTMLElement>('.site-header .brand__name');
        const logo = document.querySelector<HTMLElement>('.site-header .brand__logo');
        const headline = document.querySelector<HTMLElement>('.hero__headline');
        const nameRect = name?.getBoundingClientRect();
        const headlineRect = headline?.getBoundingClientRect();
        return {
          nameLeft: nameRect?.left ?? null,
          headlineLeft: headlineRect?.left ?? null,
          logoDisplay: logo ? getComputedStyle(logo).display : null,
        };
      });

      expect(metrics.nameLeft, `${width}px wordmark left edge`).not.toBeNull();
      expect(metrics.headlineLeft, `${width}px hero left edge`).not.toBeNull();
      expect(
        Math.abs((metrics.nameLeft ?? 0) - (metrics.headlineLeft ?? 0)),
        `${width}px ManagedCode text should align with hero content`
      ).toBeLessThanOrEqual(1);
      expect(metrics.logoDisplay, `${width}px compact logo should not offset wordmark`).toBe(
        'none'
      );
    }
  });

  test('toggle opens/closes the menu and a link click closes it across phone widths @mobile-audit', async ({
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
      await expect(toggle, `${width}px menu toggle starts labelled to open`).toHaveAttribute(
        'aria-label',
        'Open menu'
      );
      await expect(menu, `${width}px menu starts closed`).toHaveAttribute('data-open', 'false');

      await toggle.click();
      await expect(toggle, `${width}px menu toggle opens`).toHaveAttribute('aria-expanded', 'true');
      await expect(toggle, `${width}px menu toggle relabels to close`).toHaveAttribute(
        'aria-label',
        'Close menu'
      );
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
      await expect(toggle, `${width}px menu toggle relabels after link`).toHaveAttribute(
        'aria-label',
        'Open menu'
      );
      await expect(menu, `${width}px menu closes after link`).toHaveAttribute('data-open', 'false');
    }
  });
});

test.describe('Mobile viewport coverage', () => {
  for (const path of MOBILE_PATHS) {
    test(`${path} stays readable from 320px through large-phone widths @mobile-audit`, async ({
      page,
    }) => {
      for (const width of MOBILE_WIDTHS) {
        await page.setViewportSize({ width, height: MOBILE_AUDIT_HEIGHT });
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await prepareForResponsiveAudit(page);

        await expect(page.locator('[data-header]'), `${path} ${width}px header`).toBeVisible();
        await expect(page.locator('main'), `${path} ${width}px main`).toBeVisible();
        await expect(page.locator('h1'), `${path} ${width}px h1 count`).toHaveCount(1);
        await expect(page.locator('h1'), `${path} ${width}px h1 visible`).toBeVisible();

        const issues = await collectMobileLayoutIssues(page);
        expect(issues, `${path} at ${width}px should not clip or overflow`).toEqual([]);
      }
    });
  }
});

test.describe('Pixel label alignment', () => {
  for (const path of MOBILE_PATHS) {
    test(`${path} kicker flags align to the first pixel-text row @desktop`, async ({ page }) => {
      await useDesktopAuditViewport(page);
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prepareForResponsiveAudit(page);

      const issues = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLElement>('.kicker')).flatMap((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const firstTextLine = Array.from(range.getClientRects()).find(
            (rect) => rect.width > 0 && rect.height > 0
          );
          if (!firstTextLine) return [];

          const elementRect = element.getBoundingClientRect();
          const before = getComputedStyle(element, '::before');
          const flagHeight = Number.parseFloat(before.height);
          const flagMarginTop = Number.parseFloat(before.marginTop);
          const flagCenter = elementRect.top + flagMarginTop + flagHeight / 2;
          const textCenter = firstTextLine.top + firstTextLine.height / 2;
          const delta = Math.abs(flagCenter - textCenter);

          if (delta <= 1) return [];
          return [
            `${element.textContent?.trim().replace(/\s+/g, ' ') || 'kicker'} flag is ${delta.toFixed(2)}px off center`,
          ];
        });
      });

      expect(issues).toEqual([]);
    });
  }
});

test.describe('Mission Run mini-game', () => {
  type MissionRunState = {
    x: number;
    y: number;
    vx?: number;
    stars?: number;
    w: number;
    h: number;
    lives: number;
    onGround: boolean;
    state: string;
    jumpHeld: boolean;
    projectScale: number;
    blocks?: Array<{ tx: number; ty: number; kind: string; used: boolean }>;
    usedBlocks?: Array<{ tx: number; ty: number; kind: string }>;
    brickBumps?: string[];
    brokenBricks?: string[];
    particles?: Array<{ text: string; x: number; y: number }>;
    enemies?: Array<{ t: string; x: number; y?: number; label?: string; tone?: string }>;
    pipeBills?: Array<{
      x: number;
      y: number;
      pipeX: number;
      label?: string;
      tone?: string;
      emerged: number;
      visible: boolean;
      dangerous: boolean;
      blocked: boolean;
    }>;
    pose?: string;
    poseT?: number;
    endingT?: number;
    overT?: number;
    pipeT?: number;
    activePipe?: { px: number; ph: number } | null;
    pipeX?: number | null;
    pipeTop?: number | null;
    pipeOccluded?: boolean;
    camX?: number;
    voidT?: number;
    voidTitle?: string;
    voidSubtitle?: string;
    voidWarning?: string;
    voidSignLines?: readonly string[];
    voidPressureBursts?: readonly string[];
    voidCommentsCount?: number;
    voidCommentSpeed?: number;
    visibleVoidComments?: Array<{ slot: number; text: string; x: number; y: number }>;
    voidSeconds?: number;
    voidDragonX?: number;
    voidGap?: number;
    deathScene?: string;
    transition?: string;
    transitionLabel?: string | null;
    transitionT?: number;
    transitionDuration?: number;
    messageVisible?: boolean;
    finaleCount?: number;
    finaleIndex?: number;
    messageText?: string;
  };

  test('expense enemies are household bills and regular bricks can be bumped @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });
    await expect(page.locator('.mgame__title')).toHaveText('MAINTAINER DAY');
    await expect(page.locator('.mgame')).toHaveAttribute(
      'aria-label',
      'Maintainer Day - mini game'
    );

    const state = await page.evaluate(() => {
      return (
        window as Window & {
          __mgame?: () => MissionRunState;
        }
      ).__mgame?.();
    });

    const labels = new Set(state?.enemies?.map((enemy) => enemy.label).filter(Boolean));
    for (const label of ['RENT', 'TAX', 'ELECTRIC', 'WATER', 'MOBILE', 'SUBS', 'LOAN']) {
      expect(labels.has(label), `${label} should be present as an expense monster`).toBe(true);
    }
    for (const banned of ['POWER', 'ISP', 'OFFICE', 'SAAS', 'CLOUD']) {
      expect(labels.has(banned), `${banned} should not be user-facing in the mini-game`).toBe(
        false
      );
    }

    expect(state?.blocks).toContainEqual({ tx: 32, ty: 5, kind: 'coin', used: false });
    await expect(page.locator('.mgame__heart')).toHaveCount(3);
    const heartBox = await page.locator('.mgame__heart').first().boundingBox();
    expect(heartBox?.width ?? 0).toBeGreaterThan(12);

    const bumpedBlock = await page.evaluate(() => {
      const w = window as Window & {
        __mgame?: () => MissionRunState;
        __mgameBumpBlock?: (tx?: number, ty?: number) => void;
      };
      w.__mgameBumpBlock?.(32, 5);
      return w.__mgame?.();
    });
    expect(bumpedBlock?.usedBlocks).toContainEqual({ tx: 32, ty: 5, kind: 'coin' });
    expect(bumpedBlock?.particles?.some((particle) => particle.text === 'NO REPRO?')).toBe(true);

    const bumped = await page.evaluate(() => {
      const w = window as Window & {
        __mgame?: () => MissionRunState;
        __mgameBumpBrick?: (tx?: number, ty?: number) => void;
      };
      w.__mgameBumpBrick?.(13, 5);
      return w.__mgame?.();
    });
    expect(bumped?.brokenBricks).toContain('13:5');
  });

  test('pipe bill stays readable near the player and hides its tag only inside the pipe @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => MissionRunState;
          }
        ).__mgame?.();
        return state ?? null;
      });

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);

    await page.evaluate(() => {
      const w = window as Window & {
        __mgameWarpNearPipeBill?: () => void;
        __mgameAdvancePlay?: (frames?: number) => void;
      };
      w.__mgameWarpNearPipeBill?.();
      w.__mgameAdvancePlay?.(24);
    });

    const nearPipe = await readGame();
    const mobileBill = nearPipe?.pipeBills?.find((bill) => bill.label === 'MOBILE');
    expect(mobileBill?.blocked).toBe(false);
    expect(mobileBill?.visible).toBe(true);
    expect(mobileBill?.emerged ?? 0).toBeGreaterThan(0.35);

    await page.evaluate(() => {
      const w = window as Window & {
        __mgameEnterPipe?: () => void;
        __mgameAdvancePipe?: (frames?: number) => void;
      };
      w.__mgameEnterPipe?.();
      w.__mgameAdvancePipe?.(24);
    });

    const enteringPipe = await readGame();
    const hiddenMobileBill = enteringPipe?.pipeBills?.find((bill) => bill.label === 'MOBILE');
    expect(hiddenMobileBill?.blocked).toBe(true);
    expect(hiddenMobileBill?.visible).toBe(false);
    expect(hiddenMobileBill?.dangerous).toBe(false);
  });

  test('pipe bills can be stomped when they emerge from pipes @desktop', async ({ page }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => MissionRunState;
          }
        ).__mgame?.();
        return state ?? null;
      });

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);

    const before = await readGame();
    const beforePipeBills = before?.pipeBills ?? [];
    const beforeStars = before?.stars ?? 0;
    expect(beforePipeBills.some((bill) => bill.label === 'MOBILE')).toBe(true);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameStompPipeBill?: () => void;
        }
      ).__mgameStompPipeBill?.();
    });

    const after = await readGame();
    expect(after?.pipeBills?.some((bill) => bill.label === 'MOBILE')).toBe(false);
    expect(after?.pipeBills?.length).toBe(beforePipeBills.length - 1);
    expect(after?.stars).toBe(beforeStars + 1);
    expect(after?.lives).toBe(before?.lives);
    expect(after?.pose).toBe('stomp');
    expect(after?.poseT).toBeGreaterThan(0);
  });

  test('pipe descent crossfades into a burnout chase with grounded pressure labels @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => MissionRunState;
          }
        ).__mgame?.();
        return state ?? null;
      });

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameForceFinale?: (index?: number | null) => void;
          __mgameEnterPipe?: () => void;
        }
      ).__mgameForceFinale?.(0);
      (
        window as Window & {
          __mgameEnterPipe?: () => void;
        }
      ).__mgameEnterPipe?.();
    });

    await expect.poll(async () => (await readGame())?.state, { timeout: 1000 }).toBe('pipe');

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvancePipe?: (frames?: number) => void;
        }
      ).__mgameAdvancePipe?.(18);
    });
    const pipeMid = await readGame();
    expect(pipeMid?.state).toBe('pipe');
    expect(pipeMid?.pipeOccluded).toBe(true);
    expect(pipeMid?.transition).toBe('pipe');
    expect(pipeMid?.transitionLabel).toBe('DOWN PIPE');
    expect(pipeMid?.activePipe).toEqual({ px: 24, ph: 2 });
    expect(pipeMid?.y ?? 0).toBeGreaterThan(pipeMid?.pipeTop ?? Number.POSITIVE_INFINITY);

    const pipeMouthPixel = await page.evaluate(() => {
      const state = (
        window as Window & {
          __mgame?: () => MissionRunState;
        }
      ).__mgame?.();
      const canvas = document.querySelector<HTMLCanvasElement>('[data-mgame-canvas]');
      const context = canvas?.getContext('2d');
      const pipeX = state?.pipeX;
      const pipeTop = state?.pipeTop;
      if (!context || pipeX == null || pipeTop == null) return null;
      const x = Math.round(pipeX - (state?.camX ?? 0) + 16);
      const y = Math.round(pipeTop + 8);
      return Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3));
    });
    expect(pipeMouthPixel).not.toBeNull();
    const [pipeMouthR, pipeMouthG, pipeMouthB] = pipeMouthPixel ?? [0, 0, 0];
    expect(pipeMouthR).toBeLessThanOrEqual(12);
    expect(pipeMouthG).toBeGreaterThanOrEqual(38);
    expect(pipeMouthG).toBeLessThanOrEqual(60);
    expect(pipeMouthB).toBeGreaterThanOrEqual(18);
    expect(pipeMouthB).toBeLessThanOrEqual(32);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvancePipe?: (frames?: number) => void;
        }
      ).__mgameAdvancePipe?.();
    });
    await expect.poll(async () => (await readGame())?.state, { timeout: 3000 }).toBe('void');

    const voidStart = await readGame();
    expect(voidStart?.deathScene).toBe('void');
    expect(voidStart?.transition).toBe('pipe');
    expect(voidStart?.transitionLabel).toBe('DOWN PIPE');
    expect(voidStart?.transitionT ?? 0).toBeGreaterThan(0);
    expect(voidStart?.transitionDuration ?? 0).toBeGreaterThan(voidStart?.transitionT ?? 0);
    expect(voidStart?.voidTitle).toBe('BURNOUT');
    expect(voidStart?.voidTitle).not.toBe('MAINTENANCE DEBT');
    expect(voidStart?.voidSubtitle).toBe('unpaid urgency / no backup / no rest');
    expect(voidStart?.voidWarning).toBe('burnout is catching up. keep moving.');
    expect(voidStart?.voidSignLines).toEqual([
      'FREE SLA',
      '4:59 CVE',
      'PR FLOOD',
      'NO BACKUP',
      'HARD DEADLINE',
      'WEEKEND PAGE',
      'DM PING',
      'NO REST',
    ]);
    expect(voidStart?.voidPressureBursts).toEqual([
      'ONE MORE?',
      'URGENT?',
      'JUST FIX',
      'ANY UPDATE?',
      'WHY SLOW?',
      'NO OWNER',
    ]);
    expect(voidStart?.voidCommentsCount ?? 0).toBeGreaterThanOrEqual(20);
    expect(voidStart?.voidCommentsCount ?? 0).toBeLessThanOrEqual(40);
    expect(voidStart?.voidCommentSpeed ?? 0).toBeGreaterThan(0);
    expect(voidStart?.voidCommentSpeed ?? 0).toBeLessThan(0.5);
    expect(voidStart?.visibleVoidComments?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(voidStart?.voidGap ?? 0).toBeGreaterThan(120);

    await page.evaluate(() => {
      const w = window as Window & {
        __mgameAdvanceVoid?: (frames?: number) => void;
        __mgameHoldVoidDirection?: (dir?: -1 | 0 | 1) => void;
      };
      w.__mgameHoldVoidDirection?.(1);
      w.__mgameAdvanceVoid?.(106);
    });

    const afterFirstPressureBurst = await readGame();
    expect(
      afterFirstPressureBurst?.particles?.some((particle) => particle.text === 'URGENT?')
    ).toBe(true);

    await page.evaluate(() => {
      const w = window as Window & {
        __mgameAdvanceVoid?: (frames?: number) => void;
        __mgameHoldVoidDirection?: (dir?: -1 | 0 | 1) => void;
      };
      w.__mgameHoldVoidDirection?.(1);
      w.__mgameAdvanceVoid?.(20 * 60);
    });

    const afterTwentySeconds = await readGame();
    expect(afterTwentySeconds?.state).toBe('void');
    expect(afterTwentySeconds?.voidSeconds ?? 0).toBeGreaterThanOrEqual(20);
    expect(afterTwentySeconds?.x ?? 0).toBeGreaterThan((voidStart?.x ?? 0) + 100);
    expect(afterTwentySeconds?.voidGap ?? 0).toBeGreaterThan(26);
    expect(afterTwentySeconds?.visibleVoidComments?.length ?? 0).toBeGreaterThanOrEqual(2);
    const smoothComment = afterTwentySeconds?.visibleVoidComments?.find(
      (comment) => comment.x > 60 && comment.x < 240
    );
    expect(
      smoothComment,
      'expected a readable mid-screen burnout comment after 20 seconds'
    ).toBeTruthy();

    await page.evaluate(() => {
      const w = window as Window & {
        __mgameAdvanceVoid?: (frames?: number) => void;
      };
      w.__mgameAdvanceVoid?.(30);
    });

    const afterSmoothMove = await readGame();
    const sameComment = afterSmoothMove?.visibleVoidComments?.find(
      (comment) => comment.slot === smoothComment?.slot
    );
    expect(sameComment, 'expected the same comment to remain visible while moving').toBeTruthy();
    const movedPx = (smoothComment?.x ?? 0) - (sameComment?.x ?? 0);
    expect(movedPx).toBeGreaterThanOrEqual(3);
    expect(movedPx).toBeLessThanOrEqual(12);

    await page.evaluate(() => {
      const w = window as Window & {
        __mgameAdvanceVoid?: (frames?: number) => void;
        __mgameHoldVoidDirection?: (dir?: -1 | 0 | 1) => void;
      };
      w.__mgameHoldVoidDirection?.(-1);
      w.__mgameAdvanceVoid?.(45);
      w.__mgameHoldVoidDirection?.(1);
    });

    const afterBackpedal = await readGame();
    expect(afterBackpedal?.state).toBe('void');
    expect(afterBackpedal?.vx ?? 0).toBeLessThan(afterTwentySeconds?.vx ?? 0);

    await page.evaluate(() => {
      const w = window as Window & {
        __mgameAdvanceVoid?: (frames?: number) => void;
      };
      w.__mgameAdvanceVoid?.();
    });

    await expect.poll(async () => (await readGame())?.state, { timeout: 1000 }).toBe('dying');
    const caught = await readGame();
    expect(caught?.transition).toBe('none');
    expect(caught?.particles?.some((particle) => particle.text === 'BURNOUT')).toBe(false);
    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvanceGameOver?: (frames?: number) => void;
        }
      ).__mgameAdvanceGameOver?.();
    });
    await expect.poll(async () => (await readGame())?.state, { timeout: 5000 }).toBe('over');
    await expect(page.locator('[data-mgame-msgtext]')).toContainText('BURNOUT CAUGHT UP');
    await expect(page.locator('[data-mgame-msgtext]')).toContainText('ARCHIVED REPO');
    await expect(page.locator('[data-mgame-msgtext]')).toContainText('you lasted');
    await expect(page.locator('[data-mgame-msgtext]')).toContainText(
      'you stopped before the repo did'
    );
  });

  test('loss card can render ten distinct maintainer-burnout finales @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => MissionRunState;
          }
        ).__mgame?.();
        return state ?? null;
      });

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);
    await expect.poll(async () => (await readGame())?.finaleCount, { timeout: 1000 }).toBe(10);
    const finaleCount = (await readGame())?.finaleCount ?? 0;

    const seen = new Set<string>();
    for (let index = 0; index < finaleCount; index++) {
      await page.evaluate((finaleIndex) => {
        const w = window as Window & {
          __mgameForceFinale?: (index?: number | null) => void;
          __mgameTriggerGameOver?: () => void;
          __mgameAdvanceGameOver?: (frames?: number) => void;
        };
        w.__mgameForceFinale?.(finaleIndex);
        w.__mgameTriggerGameOver?.();
        w.__mgameAdvanceGameOver?.();
      }, index);

      await expect.poll(async () => (await readGame())?.state, { timeout: 1000 }).toBe('over');
      await expect
        .poll(async () => (await readGame())?.messageVisible, { timeout: 1000 })
        .toBe(true);

      const message = (await page.locator('[data-mgame-msgtext]').innerText())
        .replace(/\s+/g, ' ')
        .trim();
      expect(message.length).toBeGreaterThan(40);
      expect(seen.has(message), `finale ${index} repeated: ${message}`).toBe(false);
      seen.add(message);

      if (index < finaleCount - 1) {
        await page.locator('[data-mgame-again]').click();
        await expect.poll(async () => (await readGame())?.state, { timeout: 1000 }).toBe('play');
        await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);
      }
    }

    expect(seen.size).toBe(10);
  });

  test('holding Space extends one jump without auto-jumping on landing @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => MissionRunState;
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

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 1000 }).toBe(false);
    await expect
      .poll(
        async () => {
          const state = await readGame();
          return state?.state === 'play' && state.onGround && state.jumpHeld;
        },
        { timeout: 5000 }
      )
      .toBe(true);

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
    expect(repeatOnlyState?.jumpHeld).toBe(false);

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    });
  });

  test('NEW PROJECT IDEA doubles the maintainer; contact shrinks before losing a life @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => MissionRunState;
          }
        ).__mgame?.();
        return state ?? null;
      });

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);

    const before = await readGame();
    expect(before?.projectScale).toBe(1);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameDropNewProject?: () => void;
        }
      ).__mgameDropNewProject?.();
    });

    await expect.poll(async () => (await readGame())?.projectScale, { timeout: 1000 }).toBe(2);

    const after = await readGame();
    expect(after?.w).toBe((before?.w ?? 0) * 2);
    expect(after?.h).toBe((before?.h ?? 0) * 2);
    expect(after?.lives).toBe(before?.lives);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameSpawnExpense?: () => void;
        }
      ).__mgameSpawnExpense?.();
    });

    await expect.poll(async () => (await readGame())?.projectScale, { timeout: 1000 }).toBe(1);

    const afterContact = await readGame();
    expect(afterContact?.w).toBe(before?.w);
    expect(afterContact?.h).toBe(before?.h);
    expect(afterContact?.lives).toBe(before?.lives);
    expect(afterContact?.pose).toBe('shrink');
    expect(afterContact?.poseT).toBeGreaterThan(0);
  });

  test('win and loss finales wait for a visible beat before showing the card @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('mascot-ready'));
    await page.locator('[data-mascot]').click({ force: true });

    const readGame = () =>
      page.evaluate(() => {
        const state = (
          window as Window & {
            __mgame?: () => MissionRunState;
          }
        ).__mgame?.();
        return state ?? null;
      });

    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameTriggerWin?: () => void;
        }
      ).__mgameTriggerWin?.();
    });

    await expect.poll(async () => (await readGame())?.state, { timeout: 1000 }).toBe('ending');
    expect((await readGame())?.messageVisible).toBe(false);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvanceEnding?: (frames?: number) => void;
        }
      ).__mgameAdvanceEnding?.(54);
    });
    const midWin = await readGame();
    expect(midWin?.state).toBe('ending');
    expect(midWin?.messageVisible).toBe(false);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvanceEnding?: (frames?: number) => void;
        }
      ).__mgameAdvanceEnding?.(100);
    });

    await expect
      .poll(
        async () => {
          const state = await readGame();
          return `${state?.state}:${state?.messageVisible}`;
        },
        { timeout: 5000 }
      )
      .toBe('win:true');
    const winText = (await readGame())?.messageText ?? '';
    const winLines = winText.split('\n').filter((line) => line.trim().length > 0);
    expect(winLines).toHaveLength(4);
    expect(winText).toMatch(/WORK FUNDED/i);
    expect(winText).toMatch(/A maintainer is on call/i);
    expect(winText).toMatch(/Triage, fixes, releases/i);
    expect(winText).toMatch(/A written SLA backs it/i);
    expect(winText).not.toMatch(/MAINTAINERS PAID/i);
    expect(winText).not.toMatch(/WELCOME TO MANAGEDCODE/i);
    expect(winText).not.toMatch(/YOU KEPT IT ALIVE/i);
    expect(winText).not.toMatch(/STARS ARE APPLAUSE/i);
    expect(winText).not.toMatch(/PATRONAGE PAYS/i);

    await page.locator('[data-mgame-again]').click();
    await expect.poll(async () => (await readGame())?.state, { timeout: 1000 }).toBe('play');
    await expect.poll(async () => (await readGame())?.onGround, { timeout: 3000 }).toBe(true);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameTriggerGameOver?: () => void;
        }
      ).__mgameTriggerGameOver?.();
    });

    await expect.poll(async () => (await readGame())?.state, { timeout: 1000 }).toBe('dying');
    const lossStart = await readGame();
    expect(lossStart?.messageVisible).toBe(false);
    expect(lossStart?.pose).toBe('death-squash');
    expect(lossStart?.transition).toBe('none');

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvanceGameOver?: (frames?: number) => void;
        }
      ).__mgameAdvanceGameOver?.(14);
    });

    await expect
      .poll(
        async () => {
          const state = await readGame();
          return `${state?.state}:${state?.pose}:${state?.messageVisible}`;
        },
        { timeout: 2000 }
      )
      .toBe('dying:death:false');

    const lossFlight = await readGame();
    expect(lossFlight?.y ?? Infinity).toBeLessThan(lossStart?.y ?? 0);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvanceGameOver?: (frames?: number) => void;
        }
      ).__mgameAdvanceGameOver?.(60);
    });
    const midLoss = await readGame();
    expect(midLoss?.state).toBe('dying');
    expect(midLoss?.messageVisible).toBe(false);

    await page.evaluate(() => {
      (
        window as Window & {
          __mgameAdvanceGameOver?: (frames?: number) => void;
        }
      ).__mgameAdvanceGameOver?.();
    });

    await expect
      .poll(
        async () => {
          const state = await readGame();
          return `${state?.state}:${state?.messageVisible}`;
        },
        { timeout: 5000 }
      )
      .toBe('over:true');
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

test.describe('CTA interactions', () => {
  test('hash anchor settling stops after manual scroll input @desktop', async ({ page }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await page.evaluate(() => {
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, document.documentElement.scrollHeight);
      root.style.scrollBehavior = previous;
    });

    await page.evaluate(() => {
      window.location.hash = 'apply';
    });
    await expect(page).toHaveURL(/#apply$/);

    await page.waitForTimeout(120);
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(50);
    const afterWheel = await page.evaluate(() => Math.round(window.scrollY));

    await page.waitForTimeout(1800);
    const afterSettleWindow = await page.evaluate(() => Math.round(window.scrollY));

    expect(afterSettleWindow).toBeGreaterThanOrEqual(afterWheel - 4);
  });

  test('join cards keep equal desktop geometry without a featured card @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/#join');
    await prepareForResponsiveAudit(page);
    await page.locator('#join').scrollIntoViewIfNeeded();

    const cards = await page.locator('#join .join__card').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const cta = node.querySelector<HTMLElement>('.join__card-cta')?.getBoundingClientRect();

        return {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          ctaTop: cta?.top ?? 0,
          ctaWidth: cta?.width ?? 0,
        };
      })
    );

    expect(cards).toHaveLength(3);

    const [first] = cards;
    for (const card of cards) {
      expect(Math.abs(card.width - first.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.height - first.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.top - first.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.ctaTop - first.ctaTop)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.ctaWidth - first.ctaWidth)).toBeLessThanOrEqual(1);
    }
  });

  test('join cards and final contact CTA reveal a visible contact subject', async ({ page }) => {
    await page.goto('/');

    const status = page.locator('[data-join-contact-status]');
    await expect(status).toContainText('Choose a path above');

    const paths = [
      { label: /apply to maintain/i, subject: 'Joining the team — Maintainers' },
      { label: /talk to us/i, subject: 'Joining the team — Burnout' },
      { label: /apply to learn/i, subject: 'Joining the team — Juniors' },
    ];

    for (const path of paths) {
      const cta = page.locator('#join [data-join-contact-cta]', { hasText: path.label });
      await expect(cta).toHaveCount(1);
      await expect(cta).toHaveAttribute('href', '#join-contact');
      await cta.click();
      await expect(page).toHaveURL(/#join-contact$/);
      await expect(status).toContainText(path.subject);
    }

    const finalTalk = page.locator('.final-cta [data-join-contact-cta]');
    await expect(finalTalk).toHaveCount(1);
    await expect(finalTalk).toHaveAttribute('href', '#join-contact');
    await finalTalk.click();
    await expect(page).toHaveURL(/#join-contact$/);
    await expect(status).toContainText('Joining the team');
  });

  test('home button-style links have concrete on-page, page, external, or email targets', async ({
    page,
  }) => {
    await page.goto('/');

    const badTargets = await page.locator('a.btn').evaluateAll((links) =>
      links
        .map((link) => {
          const href = link.getAttribute('href')?.trim() ?? '';
          const text = (link.textContent ?? '').replace(/\s+/g, ' ').trim();
          return { href, text };
        })
        .filter(({ href }) => !href || href === '#')
    );

    expect(badTargets).toEqual([]);
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
    const siteKey = await form.getAttribute('data-recaptcha-site-key');
    expect(siteKey?.length ?? 0).toBeGreaterThan(0);
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

test.describe('Rendered copy guardrails', () => {
  for (const path of ['/', '/404', '/patrons', '/projects', '/team']) {
    test(`${path} does not render decorative double slashes`, async ({ page }) => {
      await page.goto(path);

      const visibleText = await page.evaluate(() => document.body.innerText);
      expect(visibleText).not.toContain('//');
    });
  }
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
    await expect(page.locator('.site-footer__copyright')).toContainText(/© 2026 Managed Code\./);
    await expect(page.locator('.site-footer__legal-links')).toContainText(
      /CC BY 4\.0 · Terms of Use · Privacy Policy/
    );
  });

  test('footer keeps desktop utility columns readable without forced wraps @desktop', async ({
    page,
  }) => {
    await useDesktopAuditViewport(page);

    await page.goto('/');
    await prepareForResponsiveAudit(page);
    await page.locator('.site-footer').scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      const selectors = {
        email: '.site-footer__nav a[href^="mailto:"]',
        site: '.site-footer__nav a[href="https://www.managed-code.com"]',
        copyright: '.site-footer__copyright',
        legal: '.site-footer__legal-links',
      } as const;

      return Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector<HTMLElement>(selector);
        const style = element ? getComputedStyle(element) : null;
        const fontSize = style ? Number.parseFloat(style.fontSize) : 0;
        const lineHeight = style ? Number.parseFloat(style.lineHeight) || fontSize * 1.3 : 0;
        const rect = element?.getBoundingClientRect();
        const visibleLineBoxes = element
          ? Array.from(element.getClientRects()).filter(
              (lineBox) => lineBox.width > 0 && lineBox.height > 0
            ).length
          : 0;

        return {
          name,
          found: Boolean(element),
          height: rect?.height ?? 0,
          lineHeight,
          lineBoxes: visibleLineBoxes,
          overflow: element
            ? element.clientWidth > 0 && element.scrollWidth - element.clientWidth > 1
            : false,
        };
      });
    });
    const navOverflow = await page.locator('.site-footer__nav').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));

    for (const metric of metrics) {
      expect(metric.found, `${metric.name} exists`).toBe(true);
      expect(metric.height, `${metric.name} stays on one line`).toBeLessThanOrEqual(
        metric.lineHeight * 1.45
      );
      expect(metric.lineBoxes, `${metric.name} has one visible line box`).toBe(1);
      expect(metric.overflow, `${metric.name} does not overflow its column`).toBe(false);
    }
    expect(
      navOverflow.scrollWidth - navOverflow.clientWidth,
      'footer nav does not overflow its grid column'
    ).toBeLessThanOrEqual(1);
  });
});
