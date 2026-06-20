/**
 * Regenerate ShieldedShell logo SVGs (header, hero mark, favicon).
 * Requires: npm install fontkit opentype.js (dev-only, run from repo root).
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const root = path.resolve(import.meta.dirname, '..');
const assetsDir = path.join(root, 'src', 'assets');
const publicDir = path.join(root, 'public');

const FONTS = {
	jakarta:
		'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0nNSg.ttf',
	mono: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf',
};

function fetch(url) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					fetch(res.headers.location).then(resolve).catch(reject);
					return;
				}
				const chunks = [];
				res.on('data', (chunk) => chunks.push(chunk));
				res.on('end', () => resolve(Buffer.concat(chunks)));
			})
			.on('error', reject);
	});
}

function pathFor(font, text, x, y, size) {
	const run = font.layout(text);
	const scale = size / font.unitsPerEm;
	let cx = x;
	const parts = [];
	for (let i = 0; i < run.glyphs.length; i++) {
		const glyph = run.glyphs[i];
		const pos = run.positions[i];
		if (glyph.path) {
			const p = glyph.path
				.scale(scale)
				.translate(cx + (pos?.xOffset || 0) * scale, y + (pos?.yOffset || 0) * scale);
			parts.push(p.toSVG());
		}
		cx += (pos?.xAdvance || glyph.advanceWidth) * scale;
	}
	return { d: parts.join(' '), width: cx - x };
}

function logomark(theme) {
	const isLight = theme === 'light';
	const outer = isLight ? '#0f766e' : '#14b8a6';
	const outerMid = isLight ? '#115e59' : '#0d9488';
	const inner = isLight ? '#ecfdf5' : '#042f2e';
	const prompt = isLight ? '#ecfdf5' : '#ccfbf1';
	const ring = isLight ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)';

	return `
  <defs>
    <linearGradient id="shield-body" x1="8" y1="2" x2="24" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${outer}"/>
      <stop offset="1" stop-color="${outerMid}"/>
    </linearGradient>
  </defs>
  <path d="M18 2.5c5.8 0 10.8 1.8 12.6 3.2v11.4c0 7.4-5.2 13.8-12.6 15.9C10.6 30.8 5.4 24.4 5.4 17.1V5.7C7.2 4.3 12.2 2.5 18 2.5Z" fill="url(#shield-body)"/>
  <path d="M18 6.2c4.6 0 8.6 1.3 9.9 2.1v9.1c0 5.6-3.9 10.4-9.9 12.1-6-1.7-9.9-6.5-9.9-12.1V8.3c1.3-.8 5.3-2.1 9.9-2.1Z" fill="none" stroke="${ring}" stroke-width="1"/>
  <path d="M12.8 16.1 16.4 18.6 12.8 21.1" fill="none" stroke="${prompt}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="17.1" y="19.6" width="7.2" height="2" rx="1" fill="${inner}"/>
  <path d="M11.2 24.8c2.2 1.1 4.4 1.6 6.8 1.6s4.6-.5 6.8-1.6" fill="none" stroke="${ring}" stroke-width="1.1" stroke-linecap="round"/>
  `.trim();
}

function wordmark(theme, jakarta, mono) {
	const isLight = theme === 'light';
	const shieldedColor = isLight ? '#0f172a' : '#f8fafc';
	const shellColor = isLight ? '#0f766e' : '#2dd4bf';
	const shieldedSize = 15.5;
	const shellSize = 14.5;
	const x = 44;
	const y = 23.5;
	const shielded = pathFor(jakarta, 'Shielded', x, y, shieldedSize);
	const shell = pathFor(mono, 'Shell', x + shielded.width + 2, y, shellSize);
	const width = Math.ceil(x + shielded.width + 2 + shell.width + 4);

	return {
		width,
		svg: `
  <path fill="${shieldedColor}" d="${shielded.d}"/>
  <path fill="${shellColor}" d="${shell.d}"/>
    `.trim(),
	};
}

function horizontalLogo(theme, jakarta, mono) {
	const mark = logomark(theme);
	const text = wordmark(theme, jakarta, mono);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${text.width} 36" fill="none" aria-hidden="true">
  <g transform="translate(0,1)">${mark}</g>
  ${text.svg}
</svg>
`;
}

function squareMark(theme) {
	const mark = logomark(theme);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" aria-hidden="true">
  ${mark}
</svg>
`;
}

function favicon() {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <defs>
    <linearGradient id="fav-body" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#14b8a6"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <path d="M16 2.2c5.2 0 9.7 1.6 11.3 2.9v10.2c0 6.6-4.6 12.3-11.3 14.2-6.7-1.9-11.3-7.6-11.3-14.2V5.1C7.3 3.8 11.8 2.2 16 2.2Z" fill="url(#fav-body)"/>
  <path d="M11.4 14.3 14.6 16.5 11.4 18.7" fill="none" stroke="#ecfdf5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="15.2" y="17.4" width="6.4" height="1.8" rx="0.9" fill="#ecfdf5"/>
</svg>
`;
}

const [jakartaBuf, monoBuf] = await Promise.all([
	fetch(FONTS.jakarta),
	fetch(FONTS.mono),
]);
const jakarta = fontkit.create(jakartaBuf);
const mono = fontkit.create(monoBuf);

fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const files = [
	[path.join(assetsDir, 'logo-light.svg'), horizontalLogo('light', jakarta, mono)],
	[path.join(assetsDir, 'logo-dark.svg'), horizontalLogo('dark', jakarta, mono)],
	[path.join(assetsDir, 'logo-mark-light.svg'), squareMark('light')],
	[path.join(assetsDir, 'logo-mark-dark.svg'), squareMark('dark')],
	[path.join(publicDir, 'favicon.svg'), favicon()],
];

for (const [file, content] of files) {
	fs.writeFileSync(file, content.trim() + '\n');
}

console.log('Wrote', files.length, 'logo files');
