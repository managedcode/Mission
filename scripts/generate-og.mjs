// scripts/generate-og.mjs
// Generates the 1200×630 Open Graph / social preview card for
// "ManagedCode · Mission" (mission.managed-code.com).
// Brand: open-source patronage — Renaissance patronage × 8-bit pixel-craft,
// built around the OFFICIAL ManagedCode `< >` code-bracket logo.
//
// Run: node scripts/generate-og.mjs   (wired to `npm run og`)

import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { statSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = join(ROOT, 'public');

// ---------------------------------------------------------------------------
// Fonts — absolute file:// URLs to the installed woff2 files.
// ---------------------------------------------------------------------------
const fontUrl = (rel) => pathToFileURL(resolve(ROOT, 'node_modules', rel)).href;

const FONTS = {
  pixel: fontUrl('@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2'),
  display: fontUrl(
    '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2'
  ),
  mono: fontUrl('@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'),
  serif: fontUrl('@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2'),
};

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const C = {
  parchment: '#f1ece0',
  raised: '#f8f4ea',
  ink: '#18170f',
  inkSoft: '#4a4536',
  brandInk: '#171920',
  green: '#1a9b4b',
  greenGlow: '#3de07a',
  amber: '#df5f27',
  gold: '#b08628',
};

// ---------------------------------------------------------------------------
// Official ManagedCode logo — load the canonical SVG and recolor on demand.
// The source paths are filled #171920; recolor by string-replacing it.
// ---------------------------------------------------------------------------
const LOGO_RAW = readFileSync(join(PUBLIC_DIR, 'managedcode-logo.svg'), 'utf8');

/**
 * Return the official logo as an inline SVG string at the requested pixel size
 * and color. Recolors by replacing the brand-ink hex.
 * @param {number} size  rendered square size in px
 * @param {string} color fill color for the mark
 */
function logoSvg(size, color = C.brandInk) {
  return LOGO_RAW.replace(/#171920/gi, color)
    .replace(/width="40"/, `width="${size}"`)
    .replace(/height="40"/, `height="${size}"`);
}

// A decorative pixel-square SVG, used as accents.
function pixelSquare(size, fill, hollow = false) {
  if (!hollow) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${fill}"/></svg>`;
  }
  const t = Math.max(2, Math.round(size / 4));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${fill}"/><rect x="${t}" y="${t}" width="${size - 2 * t}" height="${size - 2 * t}" fill="${C.parchment}"/></svg>`;
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------
function buildHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'PressStart';
    src: url('${FONTS.pixel}') format('woff2');
    font-weight: 400;
    font-display: block;
  }
  @font-face {
    font-family: 'SpaceGrotesk';
    src: url('${FONTS.display}') format('woff2');
    font-weight: 300 800;
    font-display: block;
  }
  @font-face {
    font-family: 'JetBrainsMono';
    src: url('${FONTS.mono}') format('woff2');
    font-weight: 400 700;
    font-display: block;
  }
  @font-face {
    font-family: 'Newsreader';
    src: url('${FONTS.serif}') format('woff2');
    font-weight: 300 600;
    font-display: block;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: 1200px;
    height: 630px;
  }

  body {
    font-family: 'SpaceGrotesk', sans-serif;
    background: ${C.parchment};
    color: ${C.ink};
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .card {
    position: relative;
    width: 1200px;
    height: 630px;
    overflow: hidden;
    /* faint pixel grid: 1px lines every 40px */
    background-color: ${C.parchment};
    background-image:
      linear-gradient(to right, rgba(24,23,15,0.045) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(24,23,15,0.045) 1px, transparent 1px);
    background-size: 40px 40px;
    background-position: -1px -1px;
  }

  /* warm vignette so the grid fades toward edges and content pops */
  .vignette {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(120% 90% at 24% 34%, rgba(248,244,234,0.88) 0%, rgba(248,244,234,0) 56%),
      radial-gradient(140% 120% at 100% 100%, rgba(24,23,15,0.05) 0%, rgba(24,23,15,0) 50%);
    pointer-events: none;
  }

  /* very subtle scanline overlay */
  .scanlines {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      to bottom,
      rgba(24,23,15,0.022) 0px,
      rgba(24,23,15,0.022) 1px,
      transparent 1px,
      transparent 3px
    );
    pointer-events: none;
    mix-blend-mode: multiply;
  }

  /* chunky 4px ink frame around the whole card */
  .frame {
    position: absolute;
    inset: 22px;
    border: 4px solid ${C.ink};
    pointer-events: none;
  }
  .frame::after {
    content: "";
    position: absolute;
    inset: 6px;
    border: 1px solid rgba(24,23,15,0.25);
  }

  /* decorative pixel squares */
  .deco { position: absolute; line-height: 0; z-index: 2; }
  .deco-tr { top: 44px; right: 44px; }
  .deco-bl { bottom: 44px; left: 44px; }

  .content {
    position: absolute;
    inset: 22px;
    padding: 54px 64px 50px 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    z-index: 3;
  }

  /* ---- Header: official logo + ManagedCode wordmark ---- */
  .head {
    display: flex;
    align-items: center;
    gap: 26px;
  }
  /* parchment tile behind the logo so the dark mark always reads */
  .logo-tile {
    line-height: 0;
    background: ${C.raised};
    border: 3px solid ${C.ink};
    padding: 14px;
    box-shadow: 6px 6px 0 ${C.ink};
  }
  .logo-tile svg { display: block; }
  .lockup {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .lockup .name {
    font-family: 'SpaceGrotesk', sans-serif;
    font-weight: 800;
    font-size: 52px;
    line-height: 0.9;
    letter-spacing: -1.5px;
    color: ${C.ink};
  }
  .lockup .tag {
    font-family: 'JetBrainsMono', monospace;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 3px;
    color: ${C.inkSoft};
    text-transform: uppercase;
  }
  .lockup .tag .sep { color: ${C.green}; padding: 0 6px; font-weight: 700; }

  /* small pixel eyebrow tag, pushed to the right of the header row */
  .eyebrow {
    margin-left: auto;
    align-self: flex-start;
    font-family: 'PressStart', monospace;
    font-size: 11px;
    line-height: 1;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${C.parchment};
    background: ${C.ink};
    padding: 11px 14px;
    box-shadow: 4px 4px 0 ${C.gold};
  }

  /* ---- Middle: hero copy ---- */
  .hero {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 1010px;
  }
  .tagline {
    font-family: 'SpaceGrotesk', sans-serif;
    font-weight: 800;
    font-size: 76px;
    line-height: 0.98;
    letter-spacing: -2.5px;
    color: ${C.ink};
  }
  .tagline .accent {
    color: ${C.green};
    position: relative;
  }
  .support {
    font-family: 'Newsreader', serif;
    font-size: 26px;
    line-height: 1.42;
    font-weight: 400;
    color: ${C.inkSoft};
    max-width: 900px;
  }
  .support b { color: ${C.ink}; font-weight: 600; }

  /* ---- Bottom strip ---- */
  .footer {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .url-chip {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    flex: 0 0 auto;
    white-space: nowrap;
    font-family: 'JetBrainsMono', monospace;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: ${C.parchment};
    background: ${C.green};
    padding: 14px 22px;
    box-shadow: 6px 6px 0 ${C.ink};
  }
  .url-chip .dot {
    width: 12px;
    height: 12px;
    background: ${C.greenGlow};
    box-shadow: 0 0 0 2px rgba(24,23,15,0.18);
  }
  .stat-chip {
    display: inline-flex;
    align-items: center;
    flex: 0 1 auto;
    white-space: nowrap;
    font-family: 'JetBrainsMono', monospace;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.1px;
    color: ${C.inkSoft};
    background: ${C.raised};
    border: 2px solid ${C.ink};
    padding: 11px 16px;
    box-shadow: 6px 6px 0 ${C.ink};
  }
  .stat-chip b { color: ${C.ink}; font-weight: 700; }
  .stat-chip .sep { color: ${C.amber}; padding: 0 9px; font-weight: 700; }
  .stat-chip .warn { color: ${C.amber}; font-weight: 700; }

  .pix-row {
    margin-left: auto;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .pix-row i {
    display: block;
    width: 14px;
    height: 14px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="vignette"></div>
    <div class="scanlines"></div>
    <div class="frame"></div>

    <div class="deco deco-tr">${pixelSquare(16, C.green)}</div>
    <div class="deco deco-bl">${pixelSquare(16, C.amber, true)}</div>

    <div class="content">

      <!-- HEADER -->
      <div class="head">
        <div class="logo-tile">${logoSvg(72, C.brandInk)}</div>
        <div class="lockup">
          <div class="name">ManagedCode</div>
          <div class="tag">Mission<span class="sep">·</span>Open-source&nbsp;patronage</div>
        </div>
        <div class="eyebrow">Patrons of<br/>the commons</div>
      </div>

      <!-- HERO -->
      <div class="hero">
        <div class="tagline">Fund the people who keep<br/>your open source <span class="accent">alive.</span></div>
        <div class="support">
          A team of maintainers, funded by patrons — so the <b>open source you depend on</b> keeps shipping.
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <span class="url-chip"><span class="dot"></span>mission.managed-code.com</span>
        <span class="stat-chip">
          <b>98%</b>&nbsp;of&nbsp;codebases&nbsp;run&nbsp;on&nbsp;open&nbsp;source<span class="sep">·</span><span class="warn">0%</span>&nbsp;has&nbsp;someone&nbsp;on&nbsp;call
        </span>
        <span class="pix-row">
          <i style="background:${C.green}"></i>
          <i style="background:${C.greenGlow}"></i>
          <i style="background:${C.gold}"></i>
          <i style="background:${C.amber}"></i>
        </span>
      </div>

    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
async function main() {
  const outPath = resolve(PUBLIC_DIR, 'og.png');
  const html = buildHtml();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 2,
    });

    await page.setContent(html, { waitUntil: 'networkidle' });

    // Make sure every @font-face is fully loaded before we snapshot.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(350);

    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });

    const { size } = statSync(outPath);
    const kb = (size / 1024).toFixed(1);
    console.log(`✓ OG image written: ${outPath}`);
    console.log(`  logical size : 1200 × 630 (CSS px)`);
    console.log(`  raster size  : 2400 × 1260 (deviceScaleFactor 2)`);
    console.log(`  file size    : ${size.toLocaleString()} bytes (${kb} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Failed to generate OG image:', err);
  process.exit(1);
});
