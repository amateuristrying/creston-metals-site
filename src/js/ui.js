import gsap from 'gsap';
import { METALS, INDUSTRIES, CONTACT_EMAIL, metalPhoto, metalUrl } from './data.js';

const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/* ---------- render content from data ---------- */
export function renderContent() {
  const track = $('[data-metals-track]');
  track.innerHTML = METALS.map(
    (group) => `
      <div class="metal-group" aria-hidden="true">
        <span>${String(group.items.length).padStart(2, '0')} lines</span>
        <strong>${group.family}</strong>
      </div>
      ${group.items
        .map(
          (m) => `
        <article class="metal" data-metal>
          <span class="metal__sheen"></span>
          <div class="metal__top"><span class="metal__no">${m.no}</span><span>${group.family}</span></div>
          <div class="metal__media">
            <img class="metal__photo" src="${metalPhoto(m, 640)}" alt="${m.photoAlt}" width="640" height="426" loading="lazy" decoding="async" />
            <span class="metal__sym" aria-hidden="true">${m.sym}</span>
          </div>
          <h3 class="metal__name"><a href="${metalUrl(m)}" data-page-transition>${m.name}</a></h3>
          <p class="metal__forms">${m.forms}</p>
          <ul class="metal__spec">
            <li><span>Grade</span><span>${m.grade}</span></li>
            <li><span>Goes into</span><span>${m.use}</span></li>
          </ul>
        </article>`
        )
        .join('')}`
  ).join('');

  $('[data-industries]').innerHTML = INDUSTRIES.map(
    (ind, i) => `
      <li class="ind">
        <div class="ind__link">
          <span class="ind__fill"></span>
          <span class="ind__no">${String(i + 1).padStart(2, '0')}</span>
          <span class="ind__name">${ind.name}</span>
          <span class="ind__desc">${ind.desc}</span>
          <span class="ind__arrow" aria-hidden="true">↗</span>
        </div>
      </li>`
  ).join('');

  const metalCount = METALS.reduce((count, group) => count + group.items.length, 0);
  $$('[data-metal-count]').forEach((node) => {
    node.textContent = String(metalCount).padStart(2, '0');
    if (node.hasAttribute('data-count')) node.dataset.count = metalCount;
  });
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
}

/* ---------- theme switch: night / day ---------- */
export function initTheme(onChange) {
  const root = document.documentElement;
  const button = $('[data-theme-toggle]');
  const meta = $('meta[name="theme-color"]');
  const icons = { light: $('.theme-toggle__cell--sun svg', button), dark: $('.theme-toggle__cell--moon svg', button) };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const current = () => (root.dataset.theme === 'light' ? 'light' : 'dark');

  const paint = (theme) => {
    button.setAttribute('aria-checked', String(theme === 'light'));
    meta.content = theme === 'light' ? '#f6f6f4' : '#050506';
  };

  const apply = (theme, animate) => {
    if (theme === 'light') root.dataset.theme = 'light';
    else delete root.dataset.theme;
    try {
      localStorage.setItem('creston-theme', theme);
    } catch {
      /* private mode: the choice just lasts for this visit */
    }
    paint(theme);
    onChange?.(theme);
    if (!animate) return;
    // the icon you picked spins up; the other one ducks away
    const other = theme === 'light' ? 'dark' : 'light';
    gsap.fromTo(icons[theme], { rotation: -120, scale: 0.4 }, { rotation: 0, scale: 1, duration: 0.9, ease: 'expo.out', overwrite: true });
    gsap.fromTo(icons[other], { rotation: 0, scale: 1 }, { rotation: 60, scale: 0.8, duration: 0.3, ease: 'power2.in', yoyo: true, repeat: 1, overwrite: true });
  };

  button.addEventListener('click', () => {
    const next = current() === 'light' ? 'dark' : 'light';
    gsap.fromTo(button, { scale: 0.92 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    if (!document.startViewTransition || reduced.matches) return apply(next, !reduced.matches);

    // the new theme opens as a circle growing out of the switch
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => apply(next, true));
    transition.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 950, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', pseudoElement: '::view-transition-new(root)' }
        )
      )
      .catch(() => {});
  });

  paint(current());
  onChange?.(current());
}

/* ---------- cursor ---------- */
export function initCursor() {
  if (!fine.matches) return;
  const ring = $('.cursor__ring');
  const dot = $('.cursor__dot');
  gsap.set([ring, dot], { xPercent: 0, yPercent: 0 });

  const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });

  let shown = false;
  window.addEventListener(
    'pointermove',
    (e) => {
      ringX(e.clientX);
      ringY(e.clientY);
      dotX(e.clientX);
      dotY(e.clientY);
      if (!shown) {
        shown = true;
        gsap.to([ring, dot], { opacity: 1, duration: 0.4 });
      }
    },
    { passive: true }
  );

  document.documentElement.addEventListener('pointerleave', () => {
    shown = false;
    gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
  });

  const interactive = 'a, button, .chip, input, textarea, [data-metal], .ind, .footer__word .char';
  document.addEventListener('pointerover', (e) => {
    const hit = e.target.closest?.(interactive);
    if (!hit) return;
    const big = hit.matches('[data-metal], .ind');
    gsap.to(ring, {
      scale: big ? 2.1 : 1.6,
      backgroundColor: big ? 'rgba(247,173,69,0)' : 'rgba(247,173,69,0.14)',
      borderColor: 'rgba(247,173,69,0.9)',
      duration: 0.4,
      ease: 'power3.out',
      overwrite: 'auto',
    });
    gsap.to(dot, { scale: big ? 1 : 0, duration: 0.3, overwrite: 'auto' });
  });
  document.addEventListener('pointerout', (e) => {
    const hit = e.target.closest?.(interactive);
    if (!hit || hit.contains(e.relatedTarget)) return;
    gsap.to(ring, {
      scale: 1,
      backgroundColor: 'rgba(247,173,69,0)',
      borderColor: 'rgba(247,173,69,0.55)',
      duration: 0.5,
      ease: 'power3.out',
      overwrite: 'auto',
    });
    gsap.to(dot, { scale: 1, duration: 0.3, overwrite: 'auto' });
  });
  window.addEventListener('pointerdown', () => gsap.to(ring, { scale: '*=0.8', duration: 0.15, yoyo: true, repeat: 1 }));
}

/* ---------- magnetic elements ---------- */
export function initMagnetic() {
  if (!fine.matches) return;
  $$('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic) || 0.32;
    const x = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * strength);
      y((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      x(0);
      y(0);
    });
  });
}

/* ---------- buttons: fill floods from where the pointer enters ---------- */
export function initButtons() {
  $$('[data-btn]').forEach((btn) => {
    const fill = $('.btn__fill', btn);
    if (!fill) return;
    gsap.set(fill, { xPercent: -50, yPercent: -50, scale: 0, x: 0, y: 0 });
    const place = (e) => {
      const r = btn.getBoundingClientRect();
      gsap.set(fill, { left: e.clientX - r.left, top: e.clientY - r.top });
    };
    btn.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      place(e);
      gsap.to(fill, { scale: 1, duration: 0.7, ease: 'power3.out', overwrite: true });
    });
    btn.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return;
      place(e);
      gsap.to(fill, { scale: 0, duration: 0.55, ease: 'power3.out', overwrite: true });
    });
    btn.addEventListener('pointerdown', () => gsap.fromTo(btn, { scale: 0.96 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' }));
  });
}

/* ---------- rolling text links ---------- */
export function initRollLinks() {
  $$('[data-roll]').forEach((link) => {
    const text = link.textContent.trim();
    link.setAttribute('aria-label', text);
    link.innerHTML = `<span class="roll" aria-hidden="true"><span>${text}</span><span>${text}</span></span>`;
    const parts = $$('.roll > span', link);
    link.addEventListener('pointerenter', () =>
      gsap.to(parts, { yPercent: -100, duration: 0.55, ease: 'expo.out', overwrite: true })
    );
    link.addEventListener('pointerleave', () =>
      gsap.to(parts, { yPercent: 0, duration: 0.55, ease: 'expo.out', overwrite: true })
    );
  });
}

/* ---------- nav: hide on scroll down, mobile menu, anchors ---------- */
export function initNav(lenis) {
  const nav = $('[data-nav]');
  const burger = $('.nav__burger');
  const menu = $('#menu');
  let open = false;
  let hidden = false;

  const showNav = (show) => {
    if (hidden === !show) return;
    hidden = !show;
    gsap.to(nav, { yPercent: show ? 0 : -115, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
  };

  let lastY = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const delta = y - lastY;
      nav.classList.toggle('is-solid', y > 80 && !open);
      if (open) return;
      if (y < 120) showNav(true);
      else if (Math.abs(delta) > 4) showNav(delta < 0);
      lastY = y;
    },
    { passive: true }
  );

  const menuTl = gsap
    .timeline({ paused: true, defaults: { ease: 'expo.inOut' } })
    .set(menu, { visibility: 'visible' })
    .fromTo('.menu__bg', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.9 })
    .from('.menu__txt', { yPercent: 110, duration: 0.9, stagger: 0.06, ease: 'expo.out' }, 0.35)
    .from('.menu__no, .menu__foot', { opacity: 0, duration: 0.6, stagger: 0.04, ease: 'power2.out' }, 0.5);

  const setMenu = (value) => {
    if (open === value) return;
    open = value;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
    if (open) nav.classList.remove('is-solid');
    if (open) {
      lenis?.stop();
      showNav(true);
      menuTl.timeScale(1).play();
    } else {
      lenis?.start();
      menuTl.timeScale(1.7).reverse();
    }
  };

  burger.addEventListener('click', () => setMenu(!open));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => e.matches && setMenu(false));

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const wasOpen = open;
    setMenu(false);
    const go = () => {
      if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else target.scrollIntoView({ behavior: 'smooth' });
    };
    wasOpen ? setTimeout(go, 350) : go();
  });
}

/* ---------- metal tiles: tilt + sheen ---------- */
export function initTilt() {
  if (!fine.matches) return;
  $$('[data-metal]').forEach((card) => {
    gsap.set(card, { transformPerspective: 900 });
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      rx((0.5 - py) * 9);
      ry((px - 0.5) * 11);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });
}

/* ---------- industry rows: fill wipes in from the edge you entered ---------- */
export function initIndustryRows() {
  $$('.ind').forEach((row) => {
    const fill = $('.ind__fill', row);
    const name = $('.ind__name', row);
    const arrow = $('.ind__arrow', row);
    const edge = (e) => {
      const r = row.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2 ? '50% 0%' : '50% 100%';
    };
    row.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      gsap.set(fill, { transformOrigin: edge(e) });
      gsap.to(fill, { scaleY: 1, duration: 0.55, ease: 'expo.out', overwrite: true });
      gsap.to(name, { x: 22, duration: 0.6, ease: 'expo.out', overwrite: true });
      gsap.to(arrow, { rotation: 45, x: -8, duration: 0.6, ease: 'expo.out', overwrite: true });
    });
    row.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return;
      gsap.set(fill, { transformOrigin: edge(e) });
      gsap.to(fill, { scaleY: 0, duration: 0.5, ease: 'expo.out', overwrite: true });
      gsap.to(name, { x: 0, duration: 0.6, ease: 'expo.out', overwrite: true });
      gsap.to(arrow, { rotation: 0, x: 0, duration: 0.6, ease: 'expo.out', overwrite: true });
    });
  });
}

/* ---------- enquiry form → pre-filled email ---------- */
export function initForm() {
  const form = $('[data-form]');
  const note = $('[data-form-note]');
  const defaultNote = note.textContent;

  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const required = $$('[required]', form);
    const invalid = required.filter((input) => !input.checkValidity());
    required.forEach((input) => input.closest('.field').classList.toggle('is-invalid', invalid.includes(input)));

    if (invalid.length) {
      note.textContent = 'Please add your name, a valid email and your requirement.';
      note.classList.add('is-error');
      gsap.fromTo(
        invalid.map((input) => input.closest('.field')),
        { x: -8 },
        { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)', stagger: 0.05 }
      );
      invalid[0].focus();
      return;
    }

    const data = new FormData(form);
    const needs = data.getAll('need').join(', ') || 'Not specified';
    const subject = `Enquiry — ${data.get('company') || data.get('name')}`;
    const body = [
      `Name: ${data.get('name')}`,
      `Company: ${data.get('company') || '—'}`,
      `Email: ${data.get('email')}`,
      `Looking for: ${needs}`,
      '',
      data.get('message'),
    ].join('\n');

    note.classList.remove('is-error');
    note.textContent = 'Opening your email app — press send there to reach us.';
    gsap.fromTo(note, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
    gsap.delayedCall(6, () => (note.textContent = defaultNote));

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}
