import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for "Mission by Managed Code".
 *
 * Visual regression baselines are PLATFORM-SUFFIXED via `snapshotPathTemplate`
 * (see `{platform}` below). That means macOS dev baselines (`-darwin`) and
 * Linux CI baselines (`-linux`) live side by side and never clobber each other.
 * Locally on macOS you generate `-darwin` snapshots. Linux snapshots are
 * committed deliberately by humans. `.github/workflows/deploy.yml` compares
 * them before publishing, and `.github/workflows/playwright.yml` only uploads
 * generated `-linux` snapshots as a manual artifact when requested.
 */
// Dedicated port so the suite never reuses an unrelated dev server that may
// already hold the local dev port (4323). Override with PORT if needed.
const PORT = Number(process.env.PORT ?? 4333);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DESKTOP_ONLY = /@desktop/;
const MOBILE_AUDIT_ONLY = /@mobile-audit/;
const NON_TARGETED_MOBILE_TESTS = /@desktop|@mobile-audit/;

export default defineConfig({
  testDir: './tests',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry everywhere: the tallest full-page captures (home, desktop/-xl) are
  // occasionally marginal on Chromium's stable-frame pre-check; a single retry
  // self-heals that without masking real content diffs (the diff threshold is
  // unchanged below).
  retries: 1,

  reporter: [['html', { open: 'never' }], ['list']],

  // Build the static site and serve it with Astro's preview server on our port.
  webServer: {
    command: `npm run build && npm run preview:test -- --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
  },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      // per-pixel YIQ tolerance — absorbs sub-pixel font anti-aliasing noise on
      // the very tall full-page captures (real text/layout changes still exceed it)
      threshold: 0.25,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  // Platform suffix keeps macOS-dev and Linux-CI baselines from colliding.
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',

  // Full device matrix: small/medium/large phones, tablets, and desktops.
  // Names are lowercase/hyphenated because they feed `{projectName}` in the
  // platform-suffixed snapshot path template above.
  projects: [
    {
      // Small Android phone — no built-in descriptor, so a custom viewport with
      // mobile emulation flags set explicitly.
      name: 'phone-sm',
      grepInvert: DESKTOP_ONLY,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'phone-md',
      grepInvert: NON_TARGETED_MOBILE_TESTS,
      use: { ...devices['iPhone 13'] }, // 390x844
    },
    {
      name: 'phone-lg',
      grepInvert: NON_TARGETED_MOBILE_TESTS,
      use: { ...devices['iPhone 14 Pro Max'] }, // 430x932
    },
    {
      name: 'tablet',
      grepInvert: NON_TARGETED_MOBILE_TESTS,
      use: { ...devices['iPad Mini'] }, // 768x1024
    },
    {
      name: 'tablet-lg',
      grepInvert: NON_TARGETED_MOBILE_TESTS,
      use: { ...devices['iPad Pro 11'] }, // 834x1194
    },
    {
      name: 'desktop',
      grepInvert: MOBILE_AUDIT_ONLY,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'desktop-xl',
      grepInvert: MOBILE_AUDIT_ONLY,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
});
