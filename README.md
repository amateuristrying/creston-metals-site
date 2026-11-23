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

## Scroll stories

The building and car sections use six foreground process chapters over pinned Three.js backgrounds. Their shared scroll driver renders only when progress, viewport size or theme changes. Effects use scroll-derived time, so frames hold when scrolling stops and reverse without accumulating road travel.

Run `npm test` for the scroll-driver regression checks and `npm run build` for both pages.

## Quote page

`/contact/` is a separate page linked from the hero, navigation and shared footer. Its entry point is `src/quote.js`; Vite builds both HTML pages. The form validates required fields and opens a prefilled email draft addressed to `hello@crestonmetals.com`. It does not send or store enquiries on a server.

The page embeds the supplied Google Maps pin at 20.2603662, 73.0114587. The shared footer is rendered by `src/js/footer.js`.

## Content

Copy, metals, industries and the enquiry email live in `src/js/data.js` and `index.html`.
