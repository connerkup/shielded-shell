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

**Cloudflare Pages (production):** connect the repo root. Cloudflare sets `CF_PAGES=1`, so root `npm run build` builds only the Starlight site into `website/dist`. Set output directory to `website/dist` and Node 22. `wrangler.toml` pins the output path.

**Other hosts:** use `npm run website:build` and publish `website/dist`.

From monorepo root:

```bash
npm run website:build
```
