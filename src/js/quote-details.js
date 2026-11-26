import { METALS, CONTACT_EMAIL } from './data.js';

const FORMS = {
  'TMT Bars': ['Straight bars', 'Coiled rebar'],
  'HR & CR Coils': ['Hot rolled coil', 'Cold rolled coil', 'Sheet', 'Plate'],
  'Billets & Blooms': ['Billets', 'Blooms'],
  'Structural Steel': ['Beams', 'Columns', 'Angles', 'Channels'],
  'Stainless Steel': ['Coil', 'Sheet', 'Plate', 'Long products'],
  Copper: ['Cathodes', 'Wire rod', 'Busbar'],
  Aluminium: ['Ingots', 'Billets', 'Wire rod'],
  Zinc: ['Ingots', 'Jumbo slabs'],
  Nickel: ['Cathodes', 'Briquettes'],
  Lead: ['Refined ingots', 'Alloys'],
  Tin: ['Ingots'],
};

export function materialsFor(family) {
  return METALS.filter((group) => family === 'Not sure yet' || group.family === family)
    .flatMap((group) => group.items);
}

export function specificationsFor(material) {
  const item = METALS.flatMap((group) => group.items).find((entry) => entry.name === material);
  return { forms: FORMS[material] || [], grades: item ? item.grade.split(' · ') : [] };
}

export function standardFor(material) {
  const item = METALS.flatMap((group) => group.items).find((entry) => entry.name === material);
  return item?.no.startsWith('IS ') ? item.no : '';
}

export function createQuoteDraft(data) {
  const value = (key) => String(data.get(key) || '').trim();
  if (value('enquiryMode') === 'quick') {
    const subject = `Quick enquiry — ${value('name')}`;
    const body = [
      'Enquiry type: Quick', `Requirement: ${value('quickRequirement')}`,
      `Name: ${value('name')}`, `Email: ${value('email')}`,
      ...(value('phone') ? [`Phone: ${value('phone')}`] : []),
      '', 'I agree to be contacted by Creston Metals about this enquiry.',
    ].join('\n');
    return { subject, body, href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
  }
  const material = value('material') === 'Other' ? value('customMaterial') : value('material');
  const rows = [
    ['Metal family', value('family')], ['Material', material],
    ['Product form', value('productForm')], ['Grade / purity', value('grade')],
    ['Reference standard', standardFor(value('material'))],
    ['Diameter', value('diameter')],
    ['Thickness', value('thickness') ? `${value('thickness')} mm` : ''],
    ['Width', value('width') ? `${value('width')} mm` : ''],
    ['Dimensions / exact specification', value('specification')],
    ['HSN code (provided by enquirer)', value('hsn')], ['Test certificate', value('certificate')],
    ['Quantity', `${value('quantity')} ${value('unit')}`.trim()],
    ['Delivery timing', value('timing')],
    ['Required date', value('timing') === 'Specific date' ? value('deliveryDate') : ''],
    ['Country', value('country')], ['State / region', value('state')],
    ['City / site', value('city')], ['PIN / postal code', value('postalCode')],
    ['Name', value('name')], ['Company', value('company')],
    ['Email', value('email')], ['Phone', value('phone')],
    ['Additional requirements', value('message')],
  ];
  const subject = `Quote enquiry — ${material || 'Metals'} — ${value('company') || value('name')}`;
  const body = rows.filter(([, content]) => content).map(([label, content]) => `${label}: ${content}`)
    .concat('', 'I agree to be contacted by Creston Metals about this enquiry.').join('\n');
  return { subject, body, href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
