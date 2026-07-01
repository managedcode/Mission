import { expect, type Page, test } from '@playwright/test';

test.describe('Apply form retry behaviour', () => {
  const missionEndpoint =
    'https://func-managed-code-form-crm.azurewebsites.net/api/managed-code/mission';
  const missionRecaptchaApi = 'https://www.google.com/recaptcha/api.js**';
  const missionSiteKey = '6LdrND8tAAAAAEEkXmLbIGEbv50_bb7DyKqEJ-X_';
  const crmCorsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, accept',
    'access-control-allow-methods': 'POST, OPTIONS',
  };

  const fillApplyForm = async (page: Page) => {
    await page.locator('#apply-company').fill('Example SaaS');
    await page.locator('#apply-email').fill('cto@example.com');
    await page.locator('#apply-name').fill('Alex CTO');
    await page.locator('#apply-grade').selectOption('Mid');
    await page.locator('#apply-stack').fill('ManagedCode.Storage and Orleans.SignalR');
    await page.locator('#apply-budget').selectOption('Recommended operating lane');
    await page.locator('#apply-timeline').selectOption('This quarter');
    await page.locator('#apply-notes').fill('We want a written SLA for the packages we depend on.');
  };

  test('loads and executes reCAPTCHA after submit before posting to the CRM', async ({ page }) => {
    let recaptchaApiRequests = 0;
    let capturedPayload: Record<string, unknown> | undefined;

    await page.route(missionRecaptchaApi, async (route) => {
      recaptchaApiRequests += 1;
      expect(route.request().url()).toContain(`render=${encodeURIComponent(missionSiteKey)}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          window.__missionRecaptchaExecuted = [];
          window.grecaptcha = {
            ready: function(cb) { cb(); },
            execute: async function(siteKey, options) {
              window.__missionRecaptchaExecuted.push({ siteKey: siteKey, action: options.action });
              return 'loaded-recaptcha-token';
            }
          };
        `,
      });
    });

    await page.route(missionEndpoint, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: crmCorsHeaders });
        return;
      }

      capturedPayload = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: crmCorsHeaders,
        body: JSON.stringify({ ok: true, submissionId: 'web_test' }),
      });
    });

    await page.goto('/');
    await expect(page.locator('[data-apply-form]')).toHaveAttribute(
      'data-recaptcha-site-key',
      missionSiteKey
    );
    await expect(page.locator('[data-apply-form]')).toHaveAttribute('data-recaptcha-state', 'idle');

    await fillApplyForm(page);
    await page.getByRole('button', { name: /send it to the maintainers/i }).click();

    await expect(page.locator('[data-apply-success]')).toBeVisible();
    await expect(page.locator('[data-apply-form]')).toHaveAttribute(
      'data-recaptcha-state',
      'ready'
    );

    const executeCalls = await page.evaluate(
      () =>
        (
          window as Window & {
            __missionRecaptchaExecuted?: Array<{ siteKey: string; action: string }>;
          }
        ).__missionRecaptchaExecuted ?? []
    );

    expect(recaptchaApiRequests).toBe(1);
    expect(executeCalls).toEqual([{ siteKey: missionSiteKey, action: 'mission_patronage' }]);
    expect(capturedPayload?.recaptchaToken).toBe('loaded-recaptcha-token');
    expect(capturedPayload?.recaptchaAction).toBe('mission_patronage');
  });

  test('retries reCAPTCHA script loading after a failed script request', async ({ page }) => {
    let recaptchaApiRequests = 0;

    await page.route(missionRecaptchaApi, async (route) => {
      recaptchaApiRequests += 1;
      if (recaptchaApiRequests === 1) {
        await route.abort('failed');
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          window.grecaptcha = {
            ready: function(cb) { cb(); },
            execute: async function() { return 'second-load-recaptcha-token'; }
          };
        `,
      });
    });

    await page.route(missionEndpoint, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: crmCorsHeaders });
        return;
      }

      const payload = JSON.parse(route.request().postData() ?? '{}') as {
        recaptchaToken?: string;
      };
      expect(payload.recaptchaToken).toBe('second-load-recaptcha-token');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: crmCorsHeaders,
        body: JSON.stringify({ ok: true, submissionId: 'web_test' }),
      });
    });

    await page.goto('/');
    await fillApplyForm(page);

    await page.getByRole('button', { name: /send it to the maintainers/i }).click();
    await expect(page.locator('[data-apply-form]')).toHaveAttribute(
      'data-recaptcha-state',
      'error'
    );
    await expect(page.locator('[data-apply-submit]')).toBeEnabled();

    await page.getByRole('button', { name: /send it to the maintainers/i }).click();
    await expect.poll(() => recaptchaApiRequests).toBe(2);
    await expect(page.locator('[data-apply-success]')).toBeVisible({ timeout: 15000 });

    expect(recaptchaApiRequests).toBe(2);
  });

  test('retries with a fresh reCAPTCHA token when the CRM reports browser-error', async ({
    page,
  }) => {
    const recaptchaCalls: Array<{ siteKey: string; action: string }> = [];
    const postTokens: string[] = [];
    let postCount = 0;

    await page.addInitScript(() => {
      const w = window as Window & {
        grecaptcha?: {
          ready(cb: () => void): void;
          execute(siteKey: string, options: { action: string }): Promise<string>;
        };
        __missionRecaptchaCalls?: Array<{ siteKey: string; action: string }>;
      };

      w.__missionRecaptchaCalls = [];
      w.grecaptcha = {
        ready(cb: () => void) {
          cb();
        },
        async execute(siteKey: string, options: { action: string }) {
          w.__missionRecaptchaCalls?.push({ siteKey, action: options.action });
          return `test-recaptcha-token-${w.__missionRecaptchaCalls?.length ?? 0}`;
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

      postCount += 1;
      const payload = JSON.parse(route.request().postData() ?? '{}') as {
        recaptchaToken?: string;
      };
      postTokens.push(payload.recaptchaToken ?? '');

      if (postCount === 1) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          headers,
          body: JSON.stringify({
            ok: false,
            errors: ['reCAPTCHA failed: browser-error.'],
            recaptchaErrorCodes: ['browser-error'],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers,
        body: JSON.stringify({ ok: true, submissionId: 'web_test' }),
      });
    });

    await page.goto('/');
    await fillApplyForm(page);

    await page.getByRole('button', { name: /send it to the maintainers/i }).click();

    await expect(page.locator('[data-apply-success]')).toBeVisible();

    recaptchaCalls.push(
      ...(await page.evaluate(
        () =>
          (
            window as Window & {
              __missionRecaptchaCalls?: Array<{ siteKey: string; action: string }>;
            }
          ).__missionRecaptchaCalls ?? []
      ))
    );

    expect(postCount).toBe(2);
    expect(postTokens).toEqual(['test-recaptcha-token-1', 'test-recaptcha-token-2']);
    expect(recaptchaCalls.map((call) => call.action)).toEqual([
      'mission_patronage',
      'mission_patronage',
    ]);
  });
});
