# AGENTS.md — ManagedCode · Mission

Project rules and context for Codex (and humans). Read this before working in the repo.

## What this is

A static **Astro 5** landing page for **ManagedCode**'s open-source **patronage initiative** ("Mission"),
served at **`mission.managed-code.com`**. Companies become patrons; their monthly fee funds a team of
maintainers who keep the patrons' open-source dependencies healthy (real maintainer-hours + a written SLA) and
train juniors in the open. The page is a manifesto/demo. Audience: engineering managers & technical
founders (~born 1985–1990). Aiming for Awwwards-grade polish. **All copy is English.**

- **Brand / masthead:** lead with **ManagedCode** (the org). "Mission" is the initiative name, shown as a
  small tag. Official logo lives at `public/managedcode-logo.svg` (the `< >` code-bracket mark) and is
  rendered via `src/components/Logo.astro` with `fill="currentColor"` (theme-aware). Do NOT reintroduce the
  old pixel-flame mark.
- **Concept:** "Patrons of the digital commons" — Renaissance patronage × tasteful 8-bit pixel-craft, clean
  & editorial. Light + dark themes.
- **Model:** it's a **subscription to a team of maintainers, not buying a developer**. There is **NO fixed
  price** — patrons fund a maintainer at a developer **grade** (Trainee / Junior / Mid ★ / Senior ≈ that
  engineer's salary), each with maintainer-hours (~6/20/50/120/mo) + a response window (72/24/8/4 h). The **only** dollar
  figure on the page is the launch **funding goal: $32,768/mo, $8k committed** (the $32,768 goal is a
  2¹⁵ dev Easter egg — keep that exact power of two; committed is shown as **$8k**, deliberately _not_
  $8,192, which reads as too-obviously-fake; `funding` in `site.ts`,
  rendered by `Funding.astro`). Grades, windows and funding figures are **illustrative** (footer disclaimer
  says so) — keep that framing; don't reintroduce per-tier sticker prices.
- **Vocabulary (IMPORTANT — de-guilded 2026-06):** the word **"guild" is banned from user-facing copy**.
  The audience is CTOs / engineering managers; "guild" reads as fantasy-game cringe to them. Use "a funded
  **team** of maintainers", "**maintainer-hours**", "we adopt your stack" instead. "Guild" may survive ONLY
  as light easter-egg flavor in playful corners (console egg, konami, source comments) — never in nav,
  headings, tiers, SLA, FAQ or value prop. The maintainers section anchor is `#maintainers` (the component is
  still `Maintainers.astro` internally). The "Become a patron" CTAs all lead to the patron application form at
  **`#apply`** (`Apply.astro`), which POSTs JSON to `site.formEndpoint` and is **inert until that endpoint is
  set — no mailto fallback by design**. The `guild.projects` list in `site.ts` is curated to **active** repos;
  don't reintroduce abandoned ones (e.g. `Database`, last pushed 2023).

## Golden rules

1. **All copy + real facts live in `src/data/site.ts`** — the single source of truth. Never hardcode copy in
   components; import from `site.ts`. The managedcode repo stats there are real (as of mid-2026) and
   conservative — don't inflate them.
2. **Design tokens only.** Use the CSS custom properties and utility classes in `src/styles/global.css`
   (`--bg/--fg/--accent/...`, `--font-display/-serif/-mono/-pixel`, `--step-*`, `--space-*`, `.wrap`,
   `.section`, `.kicker`, `.card`, `.btn`, `.chip`, `[data-reveal]`, `.invert`). Don't hardcode hex unless
   it matches a token.
3. **Progressive enhancement.** Scroll-reveal hidden states are gated on `:root.js` (set by the inline
   script in `BaseLayout.astro`). The page must be fully visible and usable **without JS** (crawlers / fast
   first paint). Don't hide content behind JS-only reveals.
4. **Reduced motion + test determinism.** Every animation must have a `@media (prefers-reduced-motion:
reduce)` fallback. New animations must settle to a deterministic final state (the visual test helper
   disables animations and force-finishes the terminal typewriter / hides the scroll bar).
5. **Accessibility is AA.** Keep contrast ≥ 4.5:1 for text (the `--fg-faint` token is tuned for this — re-check
   if you change it), decorative SVGs `aria-hidden`, semantic headings, focus-visible, labelled controls.
6. **Astro compiler gotcha:** inlining a `.map()` that returns JSX _adjacent to another element_, or deeply
   nested `.map`-returning-JSX, can make the compiler emit an unterminated `$$render` template literal
   (esbuild then fails with a misleading `Expected ")"`). Fix by precomputing a trusted HTML string in
   frontmatter and rendering with `set:html` — and style those nodes with `:global(...)` (set:html content
   doesn't get scoped-style attributes). See the hero headline/terminal in `Hero.astro`.

## Commands

```bash
npm install            # deps (Node 20+; built on Node 25)

# Dev / build
npm run dev            # astro dev → http://localhost:4321
npm run build          # regenerates favicons, then astro build → dist/
npm run preview        # serve dist/  (Playwright/Lighthouse use port 4333, see below)

# Assets (regenerate after changing the logo/brand)
npm run icons          # scripts/generate-icons.mjs — favicons from public/managedcode-logo.svg (sharp)
npm run og             # scripts/generate-og.mjs — public/og.png 1200×630 social card (playwright + real fonts)

# Static analysis (run before committing)
npm run check          # astro check — TypeScript / .astro type-checking (must be 0 errors)
npm run lint           # eslint . (astro + ts)         npm run lint:fix
npm run format         # prettier --write .            npm run format:check
npm run validate       # astro check && eslint .

# Tests (Playwright: functional + pixel visual regression)
npm test               # build + serve on :4333 + run all tests (desktop + mobile)
npm run test:update    # regenerate visual baselines after an intentional UI change
npm run test:ui        # interactive
```

### PageSpeed / Lighthouse

The site targets green Core Web Vitals. CSS is inlined (`build.inlineStylesheets: 'always'`) to remove the
render-blocking request. To measure locally, build, preview on :4333, then run Lighthouse against the
Playwright-bundled Chromium:

```bash
npm run build && npm run preview -- --host 127.0.0.1 --port 4333 &
CHROME_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")" \
  npx lighthouse http://127.0.0.1:4333/ \
  --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new --no-sandbox" --quiet --view
```

Last local run: **Performance 97 · Accessibility 100 · Best-Practices 100 · SEO 100** (TBT 0ms, CLS 0.002).
FCP/LCP on the uncompressed local preview run ~2s; on production (CDN + Brotli + HTTP/2) expect ~1s and
~99–100 performance. Don't regress: no render-blocking resources, no layout shift, keep client JS tiny.

## Testing rules (Playwright)

- The dev/test server runs on **port 4333** (not Astro's 4321) and `reuseExistingServer: false`, because
  other local Astro projects may hold 4321 — never test the wrong site. Config: `playwright.config.ts`.
- **7-device matrix**: `phone-sm` (360), `phone-md` (iPhone 13), `phone-lg` (iPhone 14 Pro Max), `tablet`
  (iPad Mini), `tablet-lg` (iPad Pro 11), `desktop` (1440), `desktop-xl` (1920). Visual baselines are
  **platform-suffixed** (`-darwin` local, `-linux` CI) under `tests/__screenshots__/` and committed —
  regenerating them produces ~49 images, so only run `test:update` for intentional UI changes.
- `tests/functional.spec.ts` — behaviour/SEO/a11y. `tests/visual.spec.ts` — `toHaveScreenshot` pixel diffs
  (`maxDiffPixelRatio: 0.02`). `tests/perf.spec.ts` — cross-viewport **speed test** (FCP / DCL / JS-budget
  ≤150KB / no render-blocking CSS) on every project. `tests/helpers.ts` — `prepareForVisual()` makes frames
  deterministic (reveals shown, counters settled, terminal typewriter finished, animations disabled, and the
  JS-driven decorative chrome hidden — cursor, scroll bar, CRT, the generative `<canvas>` crest, the mascot,
  the sound toggle and the intro loader — so diffs track content, not sprites). The intro loader is also
  `navigator.webdriver`-gated, so it never runs under Playwright/Lighthouse.
- After any intentional visual change: `npm run test:update`, then a clean `npm test` to confirm stability,
  and commit the new baselines yourself. For Linux baselines, use the manual Playwright workflow artifact or
  run the update inside the pinned Playwright container; CI must not commit back to `main`.
- CI: `.github/workflows/deploy.yml` runs the full Playwright matrix in the official Playwright container
  before build/deploy. `.github/workflows/playwright.yml` is manual-only for Linux baseline artifacts and
  never pushes.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`
(Pages → Source must be "GitHub Actions"). `public/CNAME` = `mission.managed-code.com`, so once the DNS is
pointed the site serves at the custom domain (base `/`). The full Playwright matrix is part of this deploy
pipeline and gates publishing.

## SEO / AEO / GEO

`BaseLayout.astro` emits full OG/Twitter/canonical + JSON-LD (Organization, WebSite, WebPage); `index.astro`
adds FAQPage + Service with per-grade `Offer`s (no price — salary-grade model; `availability` + `url`). Keep
`public/robots.txt` (welcomes AI crawlers), `public/llms.txt` (answer-engine summary), and the sitemap
(`@astrojs/sitemap`, emits `lastmod`) in sync with `site.ts`. Meta description should stay ~150–160 chars.

## Layout

```
src/
  data/site.ts             single source of truth — copy, real facts, tiers, faq, seo, brand
  styles/global.css        design system (tokens, utilities, themes, animations)
  layouts/BaseLayout.astro head/SEO/JSON-LD, no-flash theme + `.js` PE flag, scroll bar + CRT
  scripts/app.ts           reveals, counters, theme, nav (focus-managed), terminal typewriter,
                           scroll-progress, konami (↑↑↓↓←→←→BA → CRT payoff)
  components/              Logo, Header, Hero, Problem, Manifesto, HowItWorks, Maintainers, Sla, Tiers,
                           Join, Faq, FinalCta, Footer
  pages/index.astro        landing page         pages/404.astro  "never merged" story (noindex)
scripts/                   generate-icons.mjs (sharp) · generate-og.mjs (playwright)
tests/                     functional.spec.ts · visual.spec.ts · helpers.ts
```
