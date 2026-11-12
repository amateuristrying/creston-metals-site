# Creston Metals — landing page

Vite + GSAP (ScrollTrigger, SplitText) + Three.js + Lenis. Design system in [DESIGN.md](DESIGN.md).

## Develop

```bash
npm install
npm run dev
```

## Deploy to Cloudflare Pages

**Git integration (recommended).** In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git → pick this repository, then:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |

Node is pinned by `.node-version`; the output directory is also declared in `wrangler.toml`. Every push to `main` then deploys automatically.

**Direct upload.**

```bash
npm run deploy
```

## Content

Copy, metals, industries and the enquiry email live in `src/js/data.js` and `index.html`.
