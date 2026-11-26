import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/footer.css';
import './styles/catalog.css';
import { METALS, metalPhoto, metalQuoteUrl, metalUrl } from './js/data.js';
import { renderFooter } from './js/footer.js';
import { initPageLinks, revealItems } from './js/page-motion.js';
import { standardFor } from './js/quote-details.js';
import { initButtons } from './js/ui.js';

function productCard(metal) {
  const standard = standardFor(metal.name);
  return `
    <article class="catalog-card">
      <a class="catalog-card__photo" href="${metalUrl(metal)}" aria-label="View ${metal.name} details" data-page-transition>
        <img src="${metalPhoto(metal, 640)}" width="640" height="426" alt="${metal.photoAlt}" loading="lazy" decoding="async" />
      </a>
      <div class="catalog-card__body">
        <h3><a href="${metalUrl(metal)}" data-page-transition>${metal.name}</a></h3>
        <p>${metal.forms}</p>
        <dl class="catalog-card__specs">
          <div><dt>Grade / purity</dt><dd>${metal.grade}</dd></div>
          <div><dt>Applications</dt><dd>${metal.use}</dd></div>
          ${standard ? `<div><dt>Reference standard</dt><dd>${standard}</dd></div>` : ''}
        </dl>
        <a class="btn btn--primary catalog-card__quote" href="${metalQuoteUrl(metal)}" aria-label="Request a quote for ${metal.name}" data-page-transition data-btn>
          <span class="btn__fill"></span><span class="btn__label">Request a quote</span>
        </a>
      </div>
    </article>`;
}

document.querySelector('[data-catalog-products]').innerHTML = METALS.map(({ family, items }) => {
  const id = family.toLowerCase();
  return `
    <section class="catalog__family" id="${id}" aria-labelledby="${id}-title">
      <h2 id="${id}-title">${family}</h2>
      <div class="catalog__grid">${items.map(productCard).join('')}</div>
    </section>`;
}).join('');

renderFooter();
initButtons();
initPageLinks();
revealItems(document.querySelectorAll('.catalog__intro > *'), 30);
