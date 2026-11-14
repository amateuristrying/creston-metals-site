import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import 'lenis/dist/lenis.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

import { createHeroScene } from './js/hero-scene.js';
import { createBuildScene } from './js/build-scene.js';
import { createAutoScene } from './js/auto-scene.js';
import {
  renderContent,
  initTheme,
  initCursor,
  initMagnetic,
  initButtons,
  initRollLinks,
  initNav,
  initTilt,
  initIndustryRows,
  initForm,
} from './js/ui.js';
import {
  initReveals,
  initHero,
  initTicker,
  initAbout,
  initMetals,
  initBuild,
  initDrive,
  initIndustries,
  initProcess,
  initOutro,
} from './js/sections.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// always start at the top so the intro plays over the hero
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

renderContent();

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

/* ---------- WebGL (optional: the page works without it) ---------- */
function safely(create, canvas) {
  try {
    return create(canvas);
  } catch (error) {
    console.warn('[creston] WebGL scene unavailable:', error);
    canvas.style.display = 'none';
    return null;
  }
}
const hero = safely(createHeroScene, document.querySelector('.hero__canvas'));
const build = safely(createBuildScene, document.querySelector('#build [data-seq-canvas]'));
const drive = safely(createAutoScene, document.querySelector('#drive [data-seq-canvas]'));
gsap.ticker.add(() => {
  const now = performance.now();
  hero?.frame(now);
  build?.frame(now);
  drive?.frame(now);
});

/* ---------- preloader → hero ---------- */
function runPreloader(onDone) {
  const root = document.querySelector('.preloader');
  const count = document.querySelector('[data-preloader-count]');
  const counter = { v: 0 };

  if (reducedMotion) {
    root.remove();
    onDone();
    return;
  }

  gsap
    .timeline()
    .from('.preloader__mark', { scale: 0.6, rotation: -30, opacity: 0, duration: 1.4, ease: 'expo.out' }, 0)
    .from('.preloader__row, .preloader__bar', { opacity: 0, y: 12, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, 0.2)
    .to(
      counter,
      {
        v: 100,
        duration: 1.9,
        ease: 'power2.inOut',
        onUpdate: () => (count.textContent = String(Math.round(counter.v)).padStart(3, '0')),
      },
      0.2
    )
    .to('.preloader__bar span', { scaleX: 1, duration: 1.9, ease: 'power2.inOut' }, 0.2)
    .to('.preloader__inner', { y: -40, opacity: 0, duration: 0.55, ease: 'power2.in' })
    .add(onDone)
    .to(root, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '<')
    .add(() => root.remove());
}

async function start() {
  // split text needs final glyph metrics
  await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2500))]);

  initTheme((theme) => [hero, build, drive].forEach((scene) => scene?.setTheme(theme)));
  initRollLinks();
  initButtons();
  initMagnetic();
  initCursor();
  initNav(lenis);
  initForm();

  if (reducedMotion) {
    // no choreography: content is simply there; only the pinned sequences remain scroll-linked
    if (hero) hero.state.intro = 1;
    initMetals();
    initBuild(build);
    initDrive(drive);
    initProcess();
    document.body.classList.remove('is-loading');
    runPreloader(() => {});
    ScrollTrigger.refresh();
    return;
  }

  // ScrollTriggers must be created top-to-bottom: anything below a pinned
  // section has to be measured after that pin has added its spacing.
  const heroIntro = initHero(hero);
  initTicker();
  initAbout();
  initMetals(); // pin
  initBuild(build); // pin
  initDrive(drive); // pin
  initIndustries();
  initProcess();
  initOutro();
  initReveals(); // page-wide; safe now that every pin exists
  initTilt();
  initIndustryRows();
  ScrollTrigger.refresh();

  runPreloader(() => {
    document.body.classList.remove('is-loading');
    lenis?.start();
    heroIntro.play();
  });
}

start();

window.addEventListener('load', () => ScrollTrigger.refresh());
