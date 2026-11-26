import gsap from 'gsap';

export function initEntrance({ reducedMotion, onEnter }) {
  const root = document.querySelector('.entrance');
  const logo = root.querySelector('.entrance__logo');
  const options = root.querySelector('.entrance__options');
  const links = [...options.querySelectorAll('a')];
  let expanded = false;
  let leaving = false;
  let transition;

  // A direct section link should go straight to its destination.
  if (window.location.hash) {
    root.remove();
    onEnter();
    return;
  }

  const background = [...document.body.children]
    .filter((element) => element !== root && !element.inert && !['SCRIPT', 'NOSCRIPT'].includes(element.tagName));
  background.forEach((element) => { element.inert = true; });
  root.setAttribute('tabindex', '-1');
  root.focus({ preventScroll: true });

  function toggle() {
    if (leaving) return;
    const keyboard = logo.matches(':focus-visible');
    expanded = !expanded;
    transition?.kill();
    root.classList.toggle('is-expanded', expanded);
    logo.setAttribute('aria-expanded', String(expanded));
    logo.setAttribute('aria-label', expanded ? 'Close introduction menu' : 'Explore Creston Metals');
    options.inert = !expanded;
    options.hidden = false;
    transition = gsap.to(options, {
      height: expanded ? 'auto' : 0,
      opacity: expanded ? 1 : 0,
      duration: reducedMotion ? 0 : 0.65,
      ease: 'power3.inOut',
      onComplete: () => { options.hidden = !expanded; },
    });
    if (expanded && keyboard) links[0].focus({ preventScroll: true });
    else logo.focus({ preventScroll: true });
  }

  function cleanup(destination) {
    background.forEach((element) => { element.inert = false; });
    root.remove();
    document.removeEventListener('keydown', onKeyDown);
    const target = document.querySelector(destination || '#top');
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
  }

  async function enter(destination) {
    if (leaving) return;
    leaving = true;
    await onEnter(destination);
    if (reducedMotion) return cleanup(destination);
    gsap.timeline({ onComplete: () => cleanup(destination) })
      .to('.entrance__panel', { y: -18, opacity: 0, duration: 0.28, ease: 'power2.in' })
      .to(root, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 0.12);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      expanded ? toggle() : enter();
    }
    if (event.key !== 'Tab') return;
    const controls = expanded ? [logo, ...links] : [logo];
    const first = controls[0];
    const last = controls.at(-1);
    if (document.activeElement === root) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  logo.addEventListener('click', toggle);
  document.addEventListener('keydown', onKeyDown);
  options.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    // Let a new-tab gesture and the contact page use normal link navigation.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      event.stopPropagation();
      return;
    }
    const href = link.getAttribute('href');
    if (!href.startsWith('#')) return;
    event.preventDefault();
    event.stopPropagation();
    enter(href);
  });
}
