import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/footer.css';
import './styles/metal.css';
import { METALS, metalPhoto, metalQuoteUrl, metalSlug } from './js/data.js';
import { PRODUCTION } from './js/metal-production.js';
import { standardFor } from './js/quote-details.js';
import { renderFooter } from './js/footer.js';
import { initPageLinks, revealItems } from './js/page-motion.js';
import { initButtons } from './js/ui.js';

const root = document.querySelector('[data-metal-product]');
const slug = root.dataset.metalProduct;
const family = METALS.find((group) => group.items.some((item) => metalSlug(item) === slug));
const metal = family.items.find((item) => metalSlug(item) === slug);
const standard = standardFor(metal.name);
const [production, source] = PRODUCTION[slug];

root.insertAdjacentHTML('beforeend', `
  <p class="metal-page__family">${family.family}</p>
  <div class="metal-page__overview">
    <figure class="editorial-photo metal-page__photo">
      <img src="${metalPhoto(metal, 1200)}" srcset="${metalPhoto(metal, 640)} 640w, ${metalPhoto(metal, 1200)} 1200w"
        sizes="(max-width: 800px) 94vw, 54vw" alt="${metal.photoAlt}" width="1200" height="800" fetchpriority="high" />
      <figcaption>Illustrative product image</figcaption>
    </figure>
    <div class="metal-page__details">
      <dl class="metal-page__specs" aria-label="Product details">
        <div><dt>Forms</dt><dd>${metal.forms}</dd></div>
        <div><dt>Typical grade or purity</dt><dd>${metal.grade}</dd></div>
        ${standard ? `<div><dt>Reference standard</dt><dd>${standard}</dd></div>` : ''}
        <div><dt>Common applications</dt><dd>${metal.use}</dd></div>
      </dl>
      <a class="btn btn--primary" href="${metalQuoteUrl(metal)}" data-page-transition data-btn>
        <span class="btn__fill"></span><span class="btn__label">Request a quote</span>
      </a>
    </div>
  </div>
  <section class="metal-page__production" aria-labelledby="production-title">
    <h2 id="production-title">How it’s made</h2>
    <p>${production}</p>
    <a href="${source}">Read about the production process</a>
  </section>
`);
renderFooter();
initButtons();
initPageLinks();
revealItems(root.children, 30);
