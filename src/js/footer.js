import { CONTACT_EMAIL, METALS } from './data.js';

export function renderFooter() {
  const footer = document.querySelector('[data-site-footer]');
  if (!footer) return;
  const onQuotePage = document.body.classList.contains('quote-page');
  const home = onQuotePage ? '/' : '';
  const quote = onQuotePage ? '#enquiry' : '/contact/';
  const columns = METALS.map((group) => `
    <div class="site-footer__column"><h3>${group.family}</h3><ul>${group.items.map((metal) =>
      `<li><a href="${home}#metals">${metal.name}</a></li>`).join('')}</ul></div>`).join('');
  footer.innerHTML = `
    <div class="container">
      <div class="site-footer__cta">
        <h2>Have a metal<br />requirement <em>in mind?</em></h2>
        <a class="btn btn--ghost" href="${quote}" data-btn><span class="btn__fill"></span><span class="btn__label">Start a conversation</span></a>
      </div>
      <div class="site-footer__grid">
        <div class="site-footer__company">
          <a class="brand" href="${home || '/'}" aria-label="Creston Metals — home">
            <img class="mark--day" src="/logo-mark-day.webp" alt="" width="52" height="52" loading="lazy" />
            <img class="mark--night" src="/logo-mark.webp" alt="" width="52" height="52" loading="lazy" />
            <span class="brand__word">Creston<small>Metals</small></span>
          </a>
          <p>Sourcing and trading the ferrous and non-ferrous metals that build India.</p>
          <address><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><a href="tel:+919265068741">+91 92650 68741</a><a href="https://maps.app.goo.gl/SikjziNRJomTtyTr5" target="_blank" rel="noopener noreferrer">Dadra and Nagar Haveli, India</a></address>
        </div>
        <nav class="site-footer__column" aria-label="Company"><h3>Company</h3><ul><li><a href="${home}#about">Who we are</a></li><li><a href="${home}#build">What metal becomes</a></li><li><a href="${home}#industries">Industries</a></li><li><a href="${home}#process">How we work</a></li><li><a href="${quote}">Contact us</a></li></ul></nav>
        ${columns}
        <nav class="site-footer__column" aria-label="Services"><h3>Services</h3><ul><li><a href="${home}#process">Sourcing</a></li><li><a href="${home}#process">Quality verification</a></li><li><a href="${home}#process">Coordinated delivery</a></li><li><a href="${quote}">Request a quote</a></li></ul></nav>
      </div>
      <div class="site-footer__base"><span>© <span data-year>${new Date().getFullYear()}</span> Creston Metals</span><span>Ferrous &amp; non-ferrous commodities · India</span><a href="#top">Back to top</a></div>
    </div>`;
}
