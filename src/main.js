import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import 'lenis/dist/lenis.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';
import './styles/footer.css';
import './styles/entrance.css';
import { initEntrance } from './js/entrance.js';
import { initPageLinks } from './js/page-motion.js';
import { renderFooter } from './js/footer.js';

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
  initIndustryRows,
} from './js/ui.js';
import {
  initReveals,
  initHero,
  initTicker,
  initAbout,
  initBuild,
  initDrive,
  initIndustries,
  initProcess,
} from './js/sections.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Start at the hero unless arriving at a section from the quote page.
if (!window.location.hash) {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
}

renderFooter();
renderContent();
initPageLinks();

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

function scrollToLinkedSection() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  let target;
  try {
    target = document.getElementById(decodeURIComponent(id));
  } catch {
    return;
  }
  if (target) {
    if (lenis) lenis.scrollTo(target, { immediate: true });
    else target.scrollIntoView();
  }
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

  if (reducedMotion) {
    // no choreography: content is simply there; only the pinned sequences remain scroll-linked
    if (hero) hero.state.intro = 1;
    initBuild(build);
    initDrive(drive);
    initProcess();
    ScrollTrigger.refresh();
    return { heroIntro: null };
  }

  // ScrollTriggers must be created top-to-bottom: anything below a pinned
  // section has to be measured after that pin has added its spacing.
  const heroIntro = initHero(hero);
  initTicker();
  initAbout();
  initBuild(build); // pin
  initDrive(drive); // pin
  initIndustries();
  initProcess();
  initReveals(); // page-wide; safe now that every pin exists
  initIndustryRows();
  ScrollTrigger.refresh();

  return { heroIntro };
}

const pageReady = start();
initEntrance({
  reducedMotion,
  async onEnter(destination) {
    const { heroIntro } = await pageReady;
    document.body.classList.remove('is-loading');
    lenis?.start();
    // Settle the hero before jumping to a destination below it.
    const linkedSection = destination || window.location.hash;
    if (linkedSection && linkedSection !== '#top') heroIntro?.progress(1);
    else heroIntro?.play();
    if (destination) history.replaceState(null, '', destination);
    ScrollTrigger.refresh();
    scrollToLinkedSection();
  },
});

window.addEventListener('load', () => ScrollTrigger.refresh());
