/**
 * generate-icons.mjs — build the favicon / PWA icon set from the OFFICIAL
 * ManagedCode logo (public/managedcode-logo.svg): a clean geometric `< >`
 * code-bracket mark with two dots. We compose it onto a rounded-corner
 * parchment square so it reads on both light and dark browser chrome, then
 * rasterize with sharp.
 *
 * Run: node scripts/generate-icons.mjs
 * Idempotent — overwrites the generated files in public/ on every run.
 */
import { Buffer } from 'node:buffer';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const LOGO_PATH = join(PUBLIC_DIR, 'managedcode-logo.svg');

// Brand palette.
const PARCHMENT = '#f1ece0'; // rounded-square background (reads on light + dark chrome)
const LOGO_INK = '#171920'; // the official logo's dark color

/**
 * Pull the raw <path .../> elements out of the official logo SVG. The logo is
 * authored on a 40×40 viewBox, so we can place those paths inside a <g> with a
 * transform to scale + center them onto our parchment square.
 */
function extractLogoPaths(svgText) {
  const matches = svgText.match(/<path\b[^>]*\/>/g);
  if (!matches || matches.length === 0) {
    throw new Error('No <path> elements found in managedcode-logo.svg');
  }
  return matches.join('\n');
}

/**
 * Build the favicon SVG: the official logo centered on a rounded-corner
 * parchment square with a generous safe-area so the mark survives maskable
 * cropping.
 *
 * The logo's native viewBox is 40×40. We render onto a SIDE×SIDE canvas and
 * fit the 40-unit logo into the inner (1 − 2·PAD) safe area, centered.
 *
 * @param {string} logoPaths  the extracted <path/> markup (fill #171920)
 */
function buildFaviconSvg(logoPaths) {
  const SIDE = 512; // master canvas — rasterize down from here for crisp icons
  const PAD = 0.12; // margin around the GLYPH (not the viewBox) — still maskable-safe
  const radius = Math.round(SIDE * 0.18); // friendly rounded corners

  // The official logo sits on a 40×40 viewBox, but the < > glyph only fills the
  // central ~20 units (x,y ∈ [10,30]). Fitting the whole viewBox left the mark
  // looking tiny — so fit the GLYPH's bounding box instead and it fills the icon.
  const GLYPH = 20; // glyph bbox side within the 40 viewBox
  const GLYPH_MIN = 10; // glyph bbox top-left (it's centred at 20,20)
  const inner = SIDE * (1 - 2 * PAD); // content area side length
  const scale = inner / GLYPH; // 20 glyph-units → inner px
  const offset = SIDE * PAD; // top-left of the safe area
  const t = offset - scale * GLYPH_MIN; // map viewBox (10,10) → (offset, offset)

  // The extracted paths already carry fill="#171920"; keep the mark dark.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}" viewBox="0 0 ${SIDE} ${SIDE}">
  <rect x="0" y="0" width="${SIDE}" height="${SIDE}" rx="${radius}" ry="${radius}" fill="${PARCHMENT}"/>
  <g transform="translate(${t} ${t}) scale(${scale})">
    ${logoPaths}
  </g>
</svg>
`;
}

/**
 * Hand-build a PNG-in-ICO container around a 32×32 PNG. sharp can't write
 * .ico, but a single-image PNG-in-ICO is standard and widely supported.
 */
function buildIco(png32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved, always 0
  header.writeUInt16LE(1, 2); // image type: 1 = icon
  header.writeUInt16LE(1, 4); // number of images

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width  (32; 0 would mean 256)
  entry.writeUInt8(32, 1); // height (32)
  entry.writeUInt8(0, 2); // color count (0 = no palette)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png32.length, 8); // size of image data
  entry.writeUInt32LE(22, 12); // offset of image data (6 + 16)

  return Buffer.concat([header, entry, png32]);
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });

  const logoText = await readFile(LOGO_PATH, 'utf8');
  // Sanity check: the logo should be filled with the brand-ink color. If a
  // future logo uses a different token we still proceed (mark stays as-authored).
  if (!logoText.includes(LOGO_INK)) {
    console.warn(`  note: ${LOGO_INK} not found in logo — using paths as authored`);
  }
  const logoPaths = extractLogoPaths(logoText);

  const svg = buildFaviconSvg(logoPaths);
  const svgBuf = Buffer.from(svg, 'utf8');
  const written = [];

  // 1. Vector favicon — parchment rounded-square + official logo.
  const svgPath = join(PUBLIC_DIR, 'favicon.svg');
  await writeFile(svgPath, svgBuf);
  written.push(svgPath);

  // 2. Rasterize PNGs at the sizes browsers / PWAs ask for. The 192/512 keep
  //    the ~19% padding baked into the SVG so the mark survives maskable crop.
  const pngTargets = [
    { name: 'favicon-32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
  ];

  for (const { name, size } of pngTargets) {
    const buf = await sharp(svgBuf, { density: 384 }).resize(size, size).png().toBuffer();
    const p = join(PUBLIC_DIR, name);
    await writeFile(p, buf);
    written.push(p);
  }

  // 3. ICO — embeds a freshly rendered 32×32 PNG.
  const png32 = await sharp(svgBuf, { density: 384 }).resize(32, 32).png().toBuffer();
  const ico = buildIco(png32);
  const icoPath = join(PUBLIC_DIR, 'favicon.ico');
  await writeFile(icoPath, ico);
  written.push(icoPath);

  // Log every file written, with byte sizes.
  for (const p of written) {
    const { size } = await stat(p);
    console.log(`  wrote ${p}  (${size} bytes)`);
  }
  console.log(`\nDone. ${written.length} icon files written to public/.`);
}

main().catch((err) => {
  console.error('generate-icons failed:', err);
  process.exitCode = 1;
});
