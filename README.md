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

## Entrance

The home page opens with a compact logo. Clicking it reveals Our story, Our catalog, and Contact in one step. Story opens the homepage at the top; catalog opens the metals section; Contact opens `/contact/`. Direct section links bypass the entrance. Keyboard users can tab through the menu and press Escape to collapse it, then Escape again to enter the home page. The entrance follows the saved theme and disables transitions for reduced motion.

## Scroll stories

The building and car sections use six foreground process chapters over pinned Three.js backgrounds. Their shared scroll driver renders only when progress, viewport size or theme changes. Effects use scroll-derived time, so frames hold when scrolling stops and reverse without accumulating road travel.

Run `npm test` for the scroll-driver regression checks and `npm run build` for both pages.

## Quote page

`/contact/` is a separate page linked from the hero, navigation and shared footer. Its entry point is `src/quote.js`. Direct visits open Quick enquiry, which asks for a requirement, name, email and phone. The business and product links open Detailed enquiry directly. The corner selector switches between modes and preserves entered values. Hidden fields are excluded from validation and the email draft.

Detailed enquiry uses two columns on wider screens and one on phones. Material selection narrows the form and grade options. The form also captures dimensions, certification needs, an optional HSN code, quantity, delivery details and custom requirements. Submitting opens an email draft addressed to `sales@crestonmetals.com`.

Vite builds a standalone page at `/metals/<slug>/` for each entry in `METALS`. The pages use the catalogue data and manufacturing notes in `src/js/data.js` and `src/js/metal-production.js`. To add an approved photo to both the card and detail page, add its public URL as the metal’s `image` value.

The page embeds the supplied Google Maps pin at 20.2603662, 73.0114587. The shared footer is rendered by `src/js/footer.js`.

## Content

Copy, metals, industries and the enquiry email live in `src/js/data.js` and `index.html`.
