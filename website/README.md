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

**Cloudflare Pages (production):** connect the repo root, set build command to `npm run build`, output directory to `website/dist`, and Node 22. `wrangler.toml` pins the output dir; root `npm run build` includes the Starlight site.

**Other hosts:** use `npm run website:build` and publish `website/dist`.

From monorepo root:

```bash
npm run website:build
```
