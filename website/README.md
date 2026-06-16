# ShieldedShell docs site

Astro + [Starlight](https://starlight.astro.build/) documentation for [shieldedshell.com](https://shieldedshell.com).

## Develop

```bash
npm install
npm run dev
```

Open [localhost:4321](http://localhost:4321).

## Build

```bash
npm run build
npm run preview
```

Output: `dist/`.

## Deploy

Static site suitable for Vercel, Netlify, Cloudflare Pages, or GitHub Pages. Set build command to `npm run build` and output directory to `dist`.

From monorepo root:

```bash
npm run website:build
```
