/**
 * Genera el set completo de iconos PWA + favicon a partir de un SVG inline.
 * Uso: pnpm tsx scripts/generate-icons.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ICONS_DIR = 'public/icons';
const ROOT_DIR = 'public';

const PURPLE = '#572364';
const PURPLE_LIGHT = '#7B3A8C';
const FOREGROUND = '#F4F1F5';

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PURPLE_LIGHT}"/>
      <stop offset="100%" stop-color="${PURPLE}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <g transform="translate(256 256)">
    <text x="0" y="40" text-anchor="middle"
      font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
      font-weight="800" font-size="220" fill="${FOREGROUND}"
      letter-spacing="-12">CF</text>
  </g>
</svg>`;

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${PURPLE}"/>
  <g transform="translate(256 256)">
    <text x="0" y="36" text-anchor="middle"
      font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
      font-weight="800" font-size="180" fill="${FOREGROUND}"
      letter-spacing="-10">CF</text>
  </g>
</svg>`;

async function ensure(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function emit(svg: string, outPath: string, size: number) {
  await ensure(dirname(outPath));
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
  console.info(`✓ ${outPath} (${size}×${size})`);
}

async function main() {
  await Promise.all([
    emit(logoSvg, join(ICONS_DIR, 'icon-192.png'), 192),
    emit(logoSvg, join(ICONS_DIR, 'icon-512.png'), 512),
    emit(maskableSvg, join(ICONS_DIR, 'icon-maskable-512.png'), 512),
    emit(logoSvg, join(ICONS_DIR, 'apple-icon-180.png'), 180),
    emit(logoSvg, join(ROOT_DIR, 'favicon-32.png'), 32),
    emit(logoSvg, join(ROOT_DIR, 'favicon-16.png'), 16),
    writeFile(join(ROOT_DIR, 'logo.svg'), logoSvg, 'utf8'),
  ]);
  console.info('Iconos generados.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
