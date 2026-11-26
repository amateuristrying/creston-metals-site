import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/footer.css';
import './styles/quote.css';
import { initTheme, initNav, initButtons } from './js/ui.js';
import { renderFooter } from './js/footer.js';
import { materialsFor, specificationsFor, standardFor, createQuoteDraft } from './js/quote-details.js';
import { CONTACT_EMAIL, METALS, metalSlug } from './js/data.js';
import { initPageLinks, revealItems } from './js/page-motion.js';

renderFooter();
initTheme();
initNav(null);
initButtons();
initPageLinks();

const form = document.querySelector('[data-quote-form]');
const status = document.querySelector('[data-quote-status]');
const fields = form.elements;
const customMaterial = document.querySelector('[data-custom-material]');
const deliveryDate = document.querySelector('[data-delivery-date]');
const modeButtons = [...document.querySelectorAll('[data-quote-mode]')];
const description = document.querySelector('[data-mode-description]');
const initialStatus = status.textContent;

function setMode(mode) {
  const detailed = mode === 'detailed';
  form.dataset.mode = fields.enquiryMode.value = mode;
  modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.quoteMode === mode)));
  document.querySelectorAll('[data-detailed-fields]').forEach((fieldset) => {
    fieldset.hidden = fieldset.disabled = !detailed;
  });
  const quick = document.querySelector('[data-quick-fields]');
  quick.hidden = quick.disabled = detailed;
  document.querySelectorAll('[data-detailed-contact]').forEach((row) => {
    row.hidden = !detailed;
    row.querySelectorAll('input, textarea').forEach((input) => { input.disabled = !detailed; });
  });
  description.textContent = detailed
    ? 'Specify the material, quantity and delivery details for a more precise quote.'
    : 'Share the essentials. We’ll get in touch to work out the details.';
  status.textContent = initialStatus;
}

modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.quoteMode)));

function setOptions(select, placeholder, values) {
  select.replaceChildren(new Option(placeholder, ''), ...values.map((value) => new Option(value, value)));
  select.value = '';
}

function updateSpecification() {
  const material = fields.material.value;
  const { forms, grades } = specificationsFor(material);
  const available = Boolean(material);
  setOptions(fields.productForm, available ? 'Not sure / please advise' : 'Choose a material first', [...forms, 'Other — see specification']);
  setOptions(fields.grade, available ? 'Not sure / please advise' : 'Choose a material first', [...grades, 'Other — see specification']);
  fields.productForm.disabled = fields.grade.disabled = !available;
  customMaterial.hidden = material !== 'Other';
  fields.customMaterial.disabled = customMaterial.hidden;
  fields.customMaterial.required = !customMaterial.hidden;
  if (customMaterial.hidden) fields.customMaterial.value = '';
  const standard = standardFor(material);
  const standardNote = document.querySelector('#certificate-standard');
  standardNote.textContent = standard ? `Reference standard: ${standard}. Confirm the standard for your order in the quote.` : '';
  standardNote.hidden = !standard;
  updateDimensions();
}

function updateDimensions() {
  const material = fields.material.value;
  const form = fields.productForm.value;
  const hasDiameter = material === 'TMT Bars';
  const hasFlatDimensions = !hasDiameter && (form
    ? /coil|sheet|plate|busbar/i.test(form)
    : material === 'HR & CR Coils' || material === 'Stainless Steel');
  document.querySelector('[data-diameter]').hidden = fields.diameter.disabled = !hasDiameter;
  if (!hasDiameter) fields.diameter.value = '';
  document.querySelectorAll('[data-flat-dimension]').forEach((row) => {
    const input = row.querySelector('input');
    row.hidden = input.disabled = !hasFlatDimensions;
    if (!hasFlatDimensions) input.value = '';
  });
}

function updateMaterials() {
  const family = fields.family.value;
  setOptions(fields.material, family ? 'Select a material' : 'Choose a family first', [...materialsFor(family).map((item) => item.name), 'Other', 'Not sure yet']);
  fields.material.disabled = !family;
  updateSpecification();
}

const updateDate = () => {
  deliveryDate.hidden = fields.timing.value !== 'Specific date';
  fields.deliveryDate.disabled = deliveryDate.hidden;
  fields.deliveryDate.required = !deliveryDate.hidden;
  if (deliveryDate.hidden) fields.deliveryDate.value = '';
};
fields.family.addEventListener('change', updateMaterials);
fields.material.addEventListener('change', updateSpecification);
fields.productForm.addEventListener('change', updateDimensions);
fields.timing.addEventListener('change', updateDate);
updateMaterials();
updateDate();
const query = new URLSearchParams(window.location.search);
setMode(query.get('enquiry') === 'detailed' ? 'detailed' : 'quick');
const requestedMetal = query.get('metal');
for (const group of METALS) {
  const metal = group.items.find((item) => metalSlug(item) === requestedMetal);
  if (!metal) continue;
  setMode('detailed');
  fields.family.value = group.family;
  updateMaterials();
  fields.material.value = metal.name;
  updateSpecification();
  break;
}

revealItems(document.querySelectorAll('.quote-mode, .quote-copy > *'), 45);
const revealOnScroll = new IntersectionObserver((entries, observer) => {
  revealItems(entries.filter((entry) => entry.isIntersecting && entry.target.getClientRects().length)
    .map(({ target }) => { observer.unobserve(target); return target; }));
});
document.querySelectorAll('.quote-form legend, .quote-field, .quote-form > label, .quote-submit, .quote-help, .quote-process h2, .quote-process li, .quote-location > *')
  .forEach((element) => revealOnScroll.observe(element));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  window.location.href = createQuoteDraft(new FormData(form)).href;
  status.textContent = `Your email draft is ready to open. Press send in your email app to complete the enquiry. You can also email ${CONTACT_EMAIL} directly.`;
});
