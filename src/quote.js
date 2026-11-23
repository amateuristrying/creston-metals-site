import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/footer.css';
import './styles/quote.css';
import { initTheme, initNav, initButtons } from './js/ui.js';
import { renderFooter } from './js/footer.js';
import { CONTACT_EMAIL } from './js/data.js';

renderFooter();
initTheme();
initNav(null);
initButtons();

const form = document.querySelector('[data-quote-form]');
const status = document.querySelector('[data-quote-status]');
const phonePrefix = document.querySelector('.quote-phone > span');
const country = form.elements.country;
const updatePrefix = () => {
  phonePrefix.hidden = country.value.trim().toLowerCase() !== 'india';
};
country.addEventListener('input', updatePrefix);
updatePrefix();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const value = (key) => String(data.get(key) || '').trim();
  const name = `${value('firstName')} ${value('lastName')}`;
  let phone = value('phone');
  if (!phone.startsWith('+') && !phonePrefix.hidden) phone = `+91 ${phone}`;
  const subject = `Quote enquiry — ${value('company') || name}`;
  const body = [
    `Requirement: ${value('interest')}`, `Name: ${name}`,
    `Company: ${value('company') || 'Not specified'}`, `Email: ${value('email')}`,
    `Phone: ${phone}`, `Country: ${value('country')}`, `State / region: ${value('state')}`,
    '', value('message'), '', 'I agree to be contacted by Creston Metals about this enquiry.',
  ].join('\n');
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  status.textContent = 'Your email draft is ready to open. Press send in your email app to complete the enquiry. You can also email hello@crestonmetals.com directly.';
});
