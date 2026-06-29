import { expect, test } from '@playwright/test';

test.describe('Apply form retry behaviour', () => {
  const missionEndpoint =
    'https://func-managed-code-form-crm.azurewebsites.net/api/managed-code/mission';

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
