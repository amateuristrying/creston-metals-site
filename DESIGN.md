# Creston Metals — Design System

The system is built outward from the logo: a brushed-steel **C** on black, crossed by a ribbon of molten gold. Everything on the site is one of those three materials — **ink**, **steel** or **ember** — and nothing else.

Tokens live in [`src/styles/tokens.css`](src/styles/tokens.css). Change a value there and it changes everywhere.

---

## 1. Principles

1. **Material honesty.** Surfaces look like what the company sells. Steel is cool and neutral, never blue. Gold is light, not paint — use it where something is hot, moving or important.
2. **Weight, then air.** Heavy, wide, uppercase headlines sit in a lot of empty black. Density is reserved for specification data.
3. **Everything responds.** Every scroll, hover and press produces motion. Motion always has mass: it eases out, it never bounces like plastic.
4. **Spec-sheet precision.** Labels, numbers and grades are set in mono, small, tracked wide — the visual language of a mill test certificate.

---

## 2. Colour

| Role | Token | Hex | Use |
|---|---|---|---|
| Page | `--ink-900` | `#050506` | Default background |
| Raised | `--ink-800` | `#0b0c0e` | Alternate section background |
| Card | `--ink-700` | `#121316` | Cards, inputs |
| Hairline | `--line` | `rgba(255,255,255,.09)` | Borders, dividers |
| Text | `--steel-100` | `#e7e9ed` | Headlines and body |
| Text muted | `--steel-400` | `#8d929c` | Secondary copy |
| Text faint | `--steel-500` | `#6a6f78` | Labels, metadata |
| Accent | `--ember-400` | `#f7ad45` | Links, highlights, active states |
| Accent deep | `--ember-600` | `#d2761a` | Gradient ends, pressed states |

**Gradients**

- `--grad-steel` — white → steel → dark steel → steel. Display wordmarks only.
- `--grad-ember` — pale gold → ember → deep amber. Emphasis words and fills.
- `--glow-ember` — soft radial light. Placed *behind* objects, as in the logo.

**Rules**

- Ember never covers more than ~10% of a viewport, except a deliberate hover fill.
- Ember on ink and ink on ember both pass WCAG AA. Never put steel-400 text on ember. Text on an ember fill always uses `--on-accent`, which does not change with the theme.
- No blues, greens or reds anywhere in the UI.

**Themes**

The site has two themes, switched with the sun | moon control beside the logo. Day is the default; the choice is saved on the visitor's device.

| | Night | Day (default, `data-theme="light"` on `<html>`) |
|---|---|---|
| Page | `#050506` | `#f6f6f4` |
| Card | `#121316` | `#ffffff` |
| Text | `#e7e9ed` | `#121316` |
| Accent as text | `#f7ad45` | `#a9590b` (deeper, to hold contrast on paper) |

- The `--ink-*` and `--steel-*` scales swap ends between themes, so components are written once.
- The two 3D sequences follow the theme. By night they are a forge at dawn; by day the same scenes play on a white cyclorama — paper sky and ground, graphite steel, a graphite car on a grey road — so the page never cuts to black.
- `.theme-night` is available to pin a subtree to the night palette; nothing uses it at present.
- The logo mark has a cut for each theme: silver steel on ink by night (`logo-mark.webp`), graphite steel with the same gold ribbon on paper by day (`logo-mark-day.webp`). Neither sits on a plate.

---

## 3. Typography

| Family | Token | Role |
|---|---|---|
| **Archivo Variable** (wdth 62–125, wght 100–900) | `--font-display` | Headlines: width 118–125, weight 700–800, uppercase, tracking −0.02em, leading 0.92 |
| **Archivo Variable** | `--font-body` | Body: width 100, weight 400, leading 1.55 |
| **Instrument Serif Italic** | `--font-serif` | One emphasis word per headline, lowercase, ember gradient |
| **JetBrains Mono Variable** | `--font-mono` | Labels, numbers, grades: 11px, uppercase, tracking 0.14em |

**Scale** (fluid, `clamp()`)

| Token | Range | Use |
|---|---|---|
| `--fs-hero` | 44 → 148px | Hero headline |
| `--fs-h1` | 38 → 104px | Closing statement |
| `--fs-h2` | 32 → 72px | Section headlines |
| `--fs-h3` | 20 → 26px | Card and step titles |
| `--fs-lead` | 17 → 21px | Intro paragraphs |
| `--fs-body` | 15 → 17px | Body |
| `--fs-label` | 11px | Mono labels |

**The headline pattern.** Section headlines are wide uppercase sans, with exactly one word in serif italic ember: `FROM STOCKYARD TO *skyline.*` The serif word is the soft thing the hard thing makes possible.

**The hero tagline is the exception:** `THE METAL BEHIND INDIA'S DREAMS.` is set in one face and one colour, with no serif word.

**Section labels** follow `(03) — What metal becomes`, in mono.

---

## 4. Layout

- Container: `min(100% − 2 × gutter, 1560px)`; gutter `clamp(20px, 4vw, 64px)`.
- Section rhythm: `--section` = `clamp(96px, 14vw, 208px)` top and bottom.
- Corners are square, with one **chamfer** — a diagonal cut (11px on buttons, 26px on cards) borrowed from the terminals of the C in the logo. Metal is cut, not moulded; nothing is rounded except the cursor and the back-to-top control.
- Dividers are 1px hairlines. No drop shadows — depth comes from light, not shadow.
- Breakpoints: `≤ 640` phone, `≤ 960` tablet, `> 960` desktop. Pinned horizontal scrolling is desktop-only; phones get native swipe.

---

## 5. Components

| Component | Notes |
|---|---|
| **Button — primary** | Ember fill, ink text, mono uppercase, chamfered top-right and bottom-left. Hover: a steel-white disc floods from the pointer's entry point; the button is magnetic. |
| **Button — ghost** | Hairline border, steel text. Hover floods ember. |
| **Section label** | Mono, faint, with a 24px ember rule that draws in. |
| **Metal tile** | Chamfered periodic-table card: number, symbol, name, forms, grade. 3D tilt and a sheen that follows the pointer. |
| **Row link** | Full-width list row. Hover wipes ember from the edge the pointer came in on. |
| **Field** | Underline-only input, floating mono label, ember underline on focus. |
| **HUD readout** | Mono key/value pairs beneath a six-stage process timeline, over the 3D background. |

---

## 6. Motion

Built on **GSAP** (ScrollTrigger, SplitText) with **Lenis** smooth scrolling, and **Three.js** for the two 3D scenes.

| Token / ease | Value | Use |
|---|---|---|
| Reveal | `expo.out`, 1.0–1.4s | Text lines, cards entering |
| Wipe | `expo.inOut`, 0.9–1.2s | Preloader, menu, fills |
| Follow | `power3.out`, 0.4–0.6s | Cursor, tilt, magnetic |
| Scrub | `none`, linked to scroll | Anything pinned |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | CSS transitions |

**Rules**

- Text enters by rising out of a mask, line by line (stagger 0.08s). It never fades in flat.
- Scroll-linked motion is scrubbed — the user's hand is the timeline. Building and car sequences are full-section backgrounds beneath six foreground process chapters. Geometry, camera, road, sparks, chapter transitions and stage progress all seek to the same scroll position. No autoplay or pointer drift; stopping scroll holds the frame, and reversing scroll restores the earlier state.
- Hover feedback starts within 100ms and follows the pointer's position.
- `prefers-reduced-motion`: smooth scroll, cursor, preloader and reveals are disabled; content is simply there.

**Signature moments**

1. **Hero** — the logo rebuilt in Three.js: a brushed-steel C traced from the mark (flat top and base, diagonal cuts, offset bowl) with two gold swooshes that draw themselves in, cross the bowl and sweep round on scroll.
2. **Stockyard → Skyline** — a pinned, scroll-scrubbed Three.js sequence. 560 steel members leave a stockpile, heat to ember in flight, and cool into a 14-storey frame; glass rises; dawn breaks; the lights come on.
3. **Coil → Open road** — the sequence that follows it. A glowing hot-rolled coil pays out along a roller table; a press cuts blanks that form in flight into 15 body panels; wheels roll in, glass is set, the steel is finished and the lamps come on; the car then drives into first light, its travel tied to scroll.
4. **Theme switch** — the new theme opens as a circle growing out of the sun | moon control.

---

## 7. Voice

Short. Declarative. Concrete nouns — *billets, bridges, weighment* — over abstractions. Confident, never boastful: no superlatives, no invented statistics. Indian English spelling (*aluminium*, *tonne*).

---

## 8. Logo

- Files: `public/logo-mark.png` / `.webp` (transparent, for dark surfaces), `public/logo-mark-day.webp` (transparent, graphite steel, for light surfaces), `public/logo-full.webp` (original, on black), `public/favicon.png`.
- The silver mark only ever on ink; the graphite mark only ever on paper. Clear space = half the mark's width on every side.
- The wordmark is **CRESTON** in Archivo, width 125, weight 700, tracking 0.22em, with **METALS** beneath in mono.
