const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function revealItems(elements, delay = 0) {
  if (motion.matches) return;
  Array.from(elements).forEach((element, index) => {
    element.animate([
      { opacity: 0, translate: '0 16px' },
      { opacity: 1, translate: '0 0' },
    ], {
      duration: 480,
      delay: delay + index * 48,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
      fill: 'backwards',
    });
  });
}

export function initPageLinks() {
  let curtain;
  window.addEventListener('pageshow', () => {
    curtain?.remove();
    curtain = null;
  });

  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a[data-page-transition]');
    if (!link || event.defaultPrevented || motion.matches || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute('target') || link.hasAttribute('download')) return;

    event.preventDefault();
    if (curtain) return;
    curtain = document.createElement('div');
    curtain.className = 'page-curtain';
    curtain.setAttribute('aria-hidden', 'true');
    document.body.append(curtain);
    const fade = curtain.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 240,
      easing: 'ease-in-out',
      fill: 'forwards',
    });
    await fade.finished.catch(() => {});
    window.location.assign(link.href);
  });
}
