import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { BUILD_STEPS } from './build-scene.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const pad = (n, len = 2) => String(n).padStart(len, '0');

/* ---------- shared reveals ---------- */
export function initReveals() {
  // headlines: each line rises out of a mask
  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'line',
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 112,
          duration: 1.25,
          ease: 'expo.out',
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });

  // everything else: a short rise + fade
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 28,
      opacity: 0,
      duration: 1.1,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  });

  // page progress hairline
  gsap.to('.progress span', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  });
}

/* ---------- hero ---------- */
export function initHero(hero) {
  const split = SplitText.create('.hero__line', { type: 'chars', charsClass: 'char', aria: 'none' });
  gsap.set(split.chars, { yPercent: 118, rotate: 7, transformOrigin: '0% 100%' });
  gsap.set('[data-hero-fade]', { y: 26, opacity: 0 });
  gsap.set('.nav', { yPercent: -115 });

  const intro = gsap
    .timeline({ paused: true })
    .to(split.chars, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.02 }, 0.1)
    .to('[data-hero-fade]', { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.09 }, 0.7)
    .to('.nav', { yPercent: 0, duration: 1, ease: 'expo.out' }, 0.5)
    .from('.hero__glow', { scale: 0.5, opacity: 0, duration: 2.4, ease: 'expo.out' }, 0);
  if (hero) intro.to(hero.state, { intro: 1, duration: 2.6, ease: 'expo.out' }, 0);

  // scroll line loop
  gsap.fromTo(
    '.hero__scroll-line span',
    { xPercent: -101 },
    { xPercent: 101, duration: 1.7, ease: 'power2.inOut', repeat: -1, repeatDelay: 0.2 }
  );

  // leaving the hero
  const out = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  if (hero) {
    gsap.to(hero.state, { scroll: 1, ease: 'none', scrollTrigger: out });
    new IntersectionObserver(([entry]) => hero.setActive(entry.isIntersecting)).observe($('.hero'));
  }
  gsap.to('.hero__inner', { yPercent: -14, ease: 'none', scrollTrigger: out });
  gsap.to('.hero__glow', { yPercent: 30, ease: 'none', scrollTrigger: out });
  // fade the children, not .hero__meta itself — the intro already owns its opacity
  gsap.fromTo(
    '.hero__meta > *',
    { autoAlpha: 1 },
    { autoAlpha: 0, ease: 'none', immediateRender: false, scrollTrigger: { ...out, end: '22% top' } }
  );

  return intro;
}

/* ---------- ticker: speed and lean follow scroll velocity ---------- */
export function initTicker() {
  const rows = $$('[data-ticker]').map((row) => {
    const track = $('.ticker__track', row);
    const copies = Math.ceil((window.innerWidth * 2.2) / Math.max(track.offsetWidth, 1)) + 1;
    for (let i = 0; i < copies; i++) {
      const clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      row.append(clone);
    }
    return { row, track, dir: Number(row.dataset.ticker), x: 0, width: track.offsetWidth };
  });

  let velocity = 0;
  let goal = 0;
  let flow = 1;

  // plain scroll listener (not a ScrollTrigger) so it never depends on refresh order
  let lastY = window.scrollY;
  let lastT = performance.now();
  window.addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const y = window.scrollY;
      const v = ((y - lastY) / Math.max(now - lastT, 8)) * 1000;
      if (v) {
        goal = gsap.utils.clamp(-6000, 6000, v);
        flow = v > 0 ? 1 : -1;
      }
      lastY = y;
      lastT = now;
    },
    { passive: true }
  );
  ScrollTrigger.addEventListener('refresh', () => rows.forEach((r) => (r.width = r.track.offsetWidth)));

  gsap.ticker.add((_, deltaMs) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    velocity += (goal - velocity) * 0.09;
    goal *= 0.9;
    const speed = 70 + Math.min(Math.abs(velocity) * 0.45, 1400);
    const lean = gsap.utils.clamp(-7, 7, velocity / 320);
    rows.forEach((r) => {
      if (!r.width) return;
      r.x -= r.dir * flow * speed * dt;
      r.x = gsap.utils.wrap(-r.width, 0, r.x);
      r.row.style.transform = `translate3d(${r.x.toFixed(2)}px,0,0) skewX(${(-lean * r.dir).toFixed(2)}deg)`;
    });
  });
}

/* ---------- about ---------- */
export function initAbout() {
  const el = $('[data-scrub-words]');
  SplitText.create(el, {
    type: 'words',
    wordsClass: 'word',
    autoSplit: true,
    onSplit(self) {
      return gsap.fromTo(
        self.words,
        { opacity: 0.13 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 48%', scrub: 0.4 },
        }
      );
    },
  });

  const pillars = $$('[data-pillar]');
  gsap.set(pillars, { y: 70, opacity: 0 });
  ScrollTrigger.create({
    trigger: '.pillars',
    start: 'top 85%',
    once: true,
    onEnter() {
      gsap.to(pillars, { y: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.12 });
      $$('[data-count]').forEach((node, i) => {
        const counter = { v: 0 };
        gsap.to(counter, {
          v: Number(node.dataset.count),
          duration: 1.8,
          delay: i * 0.12,
          ease: 'power3.out',
          onUpdate: () => (node.textContent = pad(Math.round(counter.v))),
        });
      });
    },
  });
}

/* ---------- metals: pinned horizontal run on desktop, swipe on touch ---------- */
export function initMetals() {
  const track = $('[data-metals-track]');
  const viewport = $('.metals__viewport');
  const bar = $('[data-metals-bar]');
  const no = $('[data-metals-no]');
  const cards = $$('[data-metal]');
  const setProgress = (progress) => {
    gsap.set(bar, { scaleX: progress });
    no.textContent = pad(Math.min(cards.length, 1 + Math.floor(progress * cards.length * 0.999)));
  };

  const mm = gsap.matchMedia();

  mm.add('(min-width: 961px)', () => {
    const distance = () => Math.max(0, track.offsetWidth - window.innerWidth);
    const run = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.metals',
        pin: '.metals__pin',
        start: 'top top',
        end: () => `+=${distance()}`,
        scrub: 0.8,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => setProgress(self.progress),
      },
    });

    cards.forEach((card) => {
      gsap.from(card, {
        yPercent: 16,
        rotation: 3,
        opacity: 0.2,
        ease: 'none',
        scrollTrigger: {
          trigger: card,
          containerAnimation: run,
          start: 'left 104%',
          end: 'left 74%',
          scrub: true,
        },
      });
    });
    $$('.metal-group strong').forEach((label) => {
      gsap.fromTo(
        label,
        { yPercent: 18 },
        {
          yPercent: -18,
          ease: 'none',
          scrollTrigger: { trigger: label, containerAnimation: run, start: 'left right', end: 'right left', scrub: true },
        }
      );
    });
  });

  mm.add('(max-width: 960px)', () => {
    gsap.from(cards.slice(0, 4), {
      x: 80,
      opacity: 0,
      duration: 1.2,
      ease: 'expo.out',
      stagger: 0.1,
      scrollTrigger: { trigger: track, start: 'top 85%', once: true },
    });
    const onScroll = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      setProgress(max > 0 ? viewport.scrollLeft / max : 0);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  });
}

/* ---------- build sequence ---------- */
export function initBuild(scene) {
  const steps = $$('[data-step]');
  const members = $('[data-hud-members]');
  const floor = $('[data-hud-floor]');
  const bar = $('[data-hud-bar]');
  let current = -1;
  let lastPlaced = -1;
  let lastFloor = -1;

  const showStep = (index) => {
    if (index === current) return;
    const previous = steps[current];
    const next = steps[index];
    const direction = index > current ? 1 : -1;
    current = index;
    if (previous) {
      gsap.to(previous, { autoAlpha: 0, y: -24 * direction, duration: 0.4, ease: 'power2.in', overwrite: true });
    }
    gsap.fromTo(
      next,
      { autoAlpha: 0, y: 36 * direction },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', delay: previous ? 0.18 : 0, overwrite: true }
    );
    gsap.fromTo(
      next.children,
      { y: 22 * direction, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.07, delay: previous ? 0.2 : 0 }
    );
  };

  const update = (p, placed, level) => {
    let index = 0;
    BUILD_STEPS.forEach((threshold, i) => p >= threshold && (index = i));
    showStep(index);
    if (placed !== lastPlaced) members.textContent = pad((lastPlaced = placed), 3);
    if (level !== lastFloor) floor.textContent = pad((lastFloor = level));
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  };

  const isPhone = () => window.innerWidth < 760;

  if (scene) {
    scene.onFrame((info) => update(info.p, info.placed, info.floor));
    // only render while the section is anywhere near the screen
    new IntersectionObserver(([entry]) => scene.setActive(entry.isIntersecting), { rootMargin: '20% 0px' }).observe(
      $('.build')
    );
  }

  ScrollTrigger.create({
    trigger: '.build',
    pin: '.build__pin',
    start: 'top top',
    end: () => `+=${window.innerHeight * (isPhone() ? 3.4 : 4.4)}`,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate(self) {
      if (scene) scene.setProgress(self.progress);
      else update(self.progress, Math.round(self.progress * 560), Math.round(self.progress * 14));
    },
  });

  showStep(0);

  // on phones the headline steps aside once the build is under way
  gsap.matchMedia().add('(max-width: 720px)', () => {
    gsap.fromTo(
      '.build__head',
      { autoAlpha: 1, y: 0 },
      {
        autoAlpha: 0,
        y: -30,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: '.build',
          start: () => `top+=${window.innerHeight * 0.35} top`,
          end: () => `top+=${window.innerHeight * 0.75} top`,
          scrub: true,
        },
      }
    );
  });

  gsap.from('.build__head > *', {
    y: 40,
    opacity: 0,
    duration: 1.2,
    ease: 'expo.out',
    stagger: 0.1,
    scrollTrigger: { trigger: '.build', start: 'top 55%', once: true },
  });
  gsap.from('.build__hud', {
    opacity: 0,
    y: 20,
    duration: 1,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.build', start: 'top 30%', once: true },
  });
}

/* ---------- industries ---------- */
export function initIndustries() {
  const rows = $$('.ind');
  gsap.set(rows, { opacity: 0, y: 46 });
  ScrollTrigger.batch(rows, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }),
  });
}

/* ---------- process ---------- */
export function initProcess() {
  const steps = $$('.process__step');
  const rail = $('.process__rail span');
  const light = (progress) => steps.forEach((s, i) => s.classList.toggle('is-on', progress > i / steps.length + 0.02));

  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 861px)', narrow: '(max-width: 860px)' }, (ctx) => {
    const { wide } = ctx.conditions;
    gsap.fromTo(
      rail,
      wide ? { scaleX: 0, scaleY: 1 } : { scaleY: 0, scaleX: 1 },
      {
        scaleX: 1,
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.process__wrap',
          start: wide ? 'top 78%' : 'top 70%',
          end: wide ? 'top 30%' : 'bottom 62%',
          scrub: 0.5,
          onUpdate: (self) => light(self.progress),
        },
      }
    );
  });

  gsap.set(steps, { opacity: 0, y: 50 });
  ScrollTrigger.batch(steps, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12 }),
  });
}

/* ---------- contact + footer ---------- */
export function initOutro() {
  gsap.fromTo(
    '.contact__glow',
    { yPercent: 25, scale: 0.8 },
    {
      yPercent: -10,
      scale: 1.1,
      ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true },
    }
  );

  gsap.from('.form', {
    y: 70,
    opacity: 0,
    duration: 1.4,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.form', start: 'top 88%', once: true },
  });
  gsap.from('.form > *', {
    y: 24,
    opacity: 0,
    duration: 1,
    ease: 'expo.out',
    stagger: 0.07,
    delay: 0.15,
    scrollTrigger: { trigger: '.form', start: 'top 88%', once: true },
  });

  const word = $('[data-footer-word]');
  const split = SplitText.create(word, { type: 'chars', charsClass: 'char', aria: 'none' });
  gsap.from(split.chars, {
    yPercent: 105,
    duration: 1.5,
    ease: 'expo.out',
    stagger: 0.06,
    scrollTrigger: { trigger: word, start: 'top 96%', once: true },
  });
  split.chars.forEach((char) => {
    char.addEventListener('pointerenter', () => {
      char.classList.add('is-hot');
      gsap.to(char, { yPercent: -7, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
    });
    char.addEventListener('pointerleave', () => {
      char.classList.remove('is-hot');
      gsap.to(char, { yPercent: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
    });
  });
}
