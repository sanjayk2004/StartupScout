import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInvestorRegistrationPayload,
  clearFieldErrors,
  mapRegistrationFieldErrors,
  passwordToggleProps,
  parsePreferredLocations,
  validateAccountStep,
  validateInvestorProfile,
} from '../src/registrationValidation.js';

const account = { fullName: 'Avery Investor', email: 'avery@example.test', password: 'correct horse battery', confirmPassword: 'correct horse battery' };
const investor = {
  ...account,
  investorType: 'individual',
  investmentThesis: 'I support early teams building useful products.',
  industriesOfInterest: ['Climate & Energy'],
  preferredFundingStages: ['Seed'],
  minInvestment: '25000',
  maxInvestment: '200000',
  currency: 'USD',
  preferredStartupLocations: ' India,  United States ,,',
};

test('password validation uses the backend UTF-8 byte range and exact confirmation', () => {
  assert.deepEqual(validateAccountStep({ ...account, password: 'é'.repeat(6), confirmPassword: 'é'.repeat(6) }), {});
  assert.deepEqual(validateAccountStep({ ...account, password: 'a'.repeat(72), confirmPassword: 'a'.repeat(72) }), {});
  assert.equal(validateAccountStep({ ...account, password: 'short', confirmPassword: 'short' }).password,
    'Use a password between 12 and 72 UTF-8 bytes.');
  assert.equal(validateAccountStep({ ...account, password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }).password,
    'Use a password between 12 and 72 UTF-8 bytes.');
  assert.equal(validateAccountStep({ ...account, confirmPassword: 'a different value' }).confirmPassword,
    'Enter the same password in both fields.');
});

test('password visibility toggles expose independent accessible states and non-submit button type', () => {
  assert.deepEqual(passwordToggleProps(false), { inputType: 'password', buttonType: 'button', label: 'Show password' });
  assert.deepEqual(passwordToggleProps(true), { inputType: 'text', buttonType: 'button', label: 'Hide password' });
});

test('investor payload preserves confirmPassword and sends trimmed locations and numeric range', () => {
  const check = validateInvestorProfile(investor);
  const payload = buildInvestorRegistrationPayload(investor, check);
  assert.equal(payload.password, investor.password);
  assert.equal(payload.confirmPassword, investor.confirmPassword);
  assert.deepEqual(payload.preferredStartupLocations, ['India', 'United States']);
  assert.deepEqual(payload.investmentRange, { min: 25000, max: 200000, currency: 'USD' });
  assert.equal('minInvestment' in payload, false);
  assert.equal('maxInvestment' in payload, false);
});

test('investor validation requires industries, stages, locations, thesis, and both amounts', () => {
  const missing = validateInvestorProfile({ ...investor, industriesOfInterest: [], preferredFundingStages: [], preferredStartupLocations: ' , ', investmentThesis: 'too short', minInvestment: '', maxInvestment: '' });
  assert.ok(missing.errors.industriesOfInterest);
  assert.ok(missing.errors.preferredFundingStages);
  assert.ok(missing.errors.preferredStartupLocations);
  assert.ok(missing.errors.investmentThesis);
  assert.ok(missing.errors.minInvestment);
  assert.ok(missing.errors.maxInvestment);
});

test('investor locations allow 1 to 20 trimmed entries and reject more than 20', () => {
  assert.deepEqual(parsePreferredLocations('  India, Canada ,, '), ['India', 'Canada']);
  const tooMany = Array.from({ length: 21 }, (_, index) => `Place ${index + 1}`).join(',');
  assert.ok(validateInvestorProfile({ ...investor, preferredStartupLocations: tooMany }).errors.preferredStartupLocations);
});

test('investor amounts reject invalid numbers and maximum below minimum', () => {
  assert.ok(validateInvestorProfile({ ...investor, minInvestment: '  ', maxInvestment: '100' }).errors.minInvestment);
  assert.ok(validateInvestorProfile({ ...investor, minInvestment: '-1', maxInvestment: 'Infinity' }).errors.minInvestment);
  assert.ok(validateInvestorProfile({ ...investor, minInvestment: '200', maxInvestment: '100' }).errors.maxInvestment);
});

test('nested backend field errors map to the investor form fields without object coercion', () => {
  assert.deepEqual(mapRegistrationFieldErrors({
    'investmentRange.max': 'Maximum must be equal to or greater than minimum.',
    preferredStartupLocations: 'Choose between 1 and 20 values.',
    private: { detail: 'must not be rendered' },
  }), {
    maxInvestment: 'Maximum must be equal to or greater than minimum.',
    preferredStartupLocations: 'Choose between 1 and 20 values.',
  });
});

test('correcting a field clears its stale validation error', () => {
  assert.deepEqual(clearFieldErrors({ password: 'Too short', confirmPassword: 'Mismatch', email: 'Invalid' }, 'password'), {
    confirmPassword: 'Mismatch', email: 'Invalid',
  });
  assert.deepEqual(clearFieldErrors({ minInvestment: 'Invalid amount', maxInvestment: 'Maximum too low' }, 'maxInvestment'), {});
});
