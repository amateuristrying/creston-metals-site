import test from 'node:test';
import assert from 'node:assert/strict';
import { materialsFor, specificationsFor, createQuoteDraft } from '../src/js/quote-details.js';

test('quick enquiry includes essentials without leaking saved detailed fields', () => {
  const draft = createQuoteDraft(new Map(Object.entries({
    enquiryMode: 'quick', quickRequirement: 'Copper, about 2 tonnes, Surat',
    name: 'Test Buyer', email: 'buyer@example.com',
    material: 'Tin', hsn: '12345678', company: 'Saved detailed company',
  })));
  assert.match(draft.subject, /Quick enquiry/);
  assert.match(draft.body, /Copper, about 2 tonnes, Surat/);
  assert.match(draft.body, /buyer@example.com/);
  assert.ok(!draft.body.includes('Tin'));
  assert.ok(!draft.body.includes('12345678'));
  assert.ok(!draft.body.includes('Saved detailed company'));
  assert.ok(!draft.body.includes('Phone:'));
  assert.equal(new URL(draft.href).searchParams.get('body'), draft.body);
});

test('material families and their dependent specifications stay separate', () => {
  assert.ok(materialsFor('Ferrous').some((item) => item.name === 'TMT Bars'));
  assert.ok(!materialsFor('Ferrous').some((item) => item.name === 'Copper'));
  assert.ok(materialsFor('Non-ferrous').some((item) => item.name === 'Copper'));
  assert.equal(materialsFor('Not sure yet').length, 11);
  assert.deepEqual(specificationsFor('Other'), { forms: [], grades: [] });
  assert.ok(specificationsFor('Copper').forms.includes('Cathodes'));
  assert.ok(!specificationsFor('Copper').grades.includes('Fe 500'));
});

test('email draft retains all enquiry details and safely encodes text', () => {
  const values = {
    family: 'Non-ferrous', material: 'Copper', productForm: 'Busbar', grade: '99.99%',
    specification: '20 × 5 mm & cut to 2 m', hsn: '12345678', certificate: 'Mill test certificate required',
    quantity: '2.5', unit: 'Metric tonnes', timing: 'Specific date', deliveryDate: '2027-01-10',
    country: 'India', state: 'Gujarat', city: 'Surat', postalCode: '395001',
    name: 'Test Buyer', company: 'A & B', email: 'buyer@example.com', phone: '+91 9000000000',
    message: 'Pack separately.\nConfirm tolerances.',
  };
  const draft = createQuoteDraft(new Map(Object.entries(values)));
  for (const value of Object.values(values)) assert.ok(draft.body.includes(value), value);
  const url = new URL(draft.href);
  assert.equal(url.pathname, 'sales@crestonmetals.com');
  assert.equal(url.searchParams.get('body'), draft.body);
  assert.equal(url.searchParams.get('subject'), draft.subject);
});

test('custom material is used and hidden delivery dates are excluded', () => {
  const draft = createQuoteDraft(new Map(Object.entries({
    material: 'Other', customMaterial: 'Customer alloy', timing: 'Flexible / please advise',
    deliveryDate: '2027-01-10', name: 'Test Buyer',
  })));
  assert.match(draft.subject, /Customer alloy/);
  assert.ok(!draft.body.includes('2027-01-10'));
  assert.ok(!draft.body.includes('HSN code'));
});
