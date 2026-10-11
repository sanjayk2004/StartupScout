import { fundingStages } from '../models/Startup.js';

const investorTypes = new Set(['angel', 'individual', 'venture-capital']);
const currencies = new Set(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD']);
const commonFields = new Set(['displayName', 'phone', 'city', 'country', 'profilePhotoUrl']);
const investorFields = new Set([
  ...commonFields, 'biography', 'investmentThesis', 'investorType', 'organizationName',
  'industriesOfInterest', 'preferredFundingStages', 'investmentRange',
  'preferredStartupLocations', 'website', 'linkedInUrl',
]);
const founderFields = new Set([
  ...commonFields, 'founderDesignation', 'annualTurnover', 'turnoverCurrency', 'financialYear', 'fundingRaised',
]);

function text(input, key, errors, { min = 0, max = 120 } = {}) {
  const raw = input[key];
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    errors[key] = 'Enter valid text.';
    return undefined;
  }
  const value = raw.trim();
  if (value.length < min || value.length > max) errors[key] = `Must be between ${min} and ${max} characters.`;
  return value;
}

function url(input, key, errors, max = 253) {
  const value = text(input, key, errors, { max });
  if (value === undefined || value === '') return value;
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) throw new Error('Invalid URL');
    return parsed.toString();
  } catch {
    errors[key] = 'Enter a valid HTTP or HTTPS URL.';
    return value;
  }
}

function stringList(input, key, errors, { allowed = null } = {}) {
  if (input[key] === undefined) return undefined;
  if (!Array.isArray(input[key]) || input[key].length > 20) {
    errors[key] = 'Choose a valid list of up to 20 values.';
    return undefined;
  }
  const value = [...new Set(input[key].map((item) => typeof item === 'string' ? item.trim() : ''))];
  if (value.some((item) => item.length < 2 || item.length > 80 || (allowed && !allowed.has(item)))) {
    errors[key] = 'One or more selections are invalid.';
    return undefined;
  }
  return value;
}

function checkAllowed(input, allowed, errors) {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors[key] = 'This field cannot be changed through profile editing.';
  }
}

export function validateProfileUpdate(role, input = {}) {
  const errors = {};
  const allowed = role === 'investor' ? investorFields : role === 'founder' ? founderFields : new Set();
  checkAllowed(input, allowed, errors);
  const value = {};
  const displayName = text(input, 'displayName', errors, { min: 2, max: 80 });
  if (displayName !== undefined) value.displayName = displayName;
  const commonProfile = {};
  for (const [key, max] of [['phone', 30], ['city', 100], ['country', 100]]) {
    const field = text(input, key, errors, { max });
    if (field !== undefined) commonProfile[key] = field;
  }
  const photo = url(input, 'profilePhotoUrl', errors, 500);
  if (photo !== undefined) commonProfile.profilePhotoUrl = photo;

  if (role === 'investor') {
    for (const [key, options] of [
      ['biography', { max: 2000 }], ['investmentThesis', { min: 20, max: 2000 }], ['organizationName', { max: 160 }],
    ]) {
      const field = text(input, key, errors, options);
      if (field !== undefined) commonProfile[key] = field;
    }
    if (input.investorType !== undefined) {
      if (!investorTypes.has(input.investorType)) errors.investorType = 'Choose a valid investor type.';
      else commonProfile.investorType = input.investorType;
    }
    for (const [key, allowedValues] of [['industriesOfInterest', null], ['preferredFundingStages', new Set(fundingStages)], ['preferredStartupLocations', null]]) {
      const field = stringList(input, key, errors, { allowed: allowedValues });
      if (field !== undefined) commonProfile[key] = field;
    }
    if (input.investmentRange !== undefined) {
      const range = input.investmentRange;
      if (!range || typeof range !== 'object' || Array.isArray(range)) errors.investmentRange = 'Enter a valid investment range.';
      else {
        const min = Number(range.min);
        const max = Number(range.max);
        if (!Number.isFinite(min) || min < 0 || min > 1_000_000_000_000) errors['investmentRange.min'] = 'Enter a valid minimum investment.';
        if (!Number.isFinite(max) || max < min || max > 1_000_000_000_000) errors['investmentRange.max'] = 'Enter a maximum equal to or above the minimum.';
        if (!currencies.has(range.currency)) errors['investmentRange.currency'] = 'Choose a supported currency.';
        if (!errors['investmentRange.min'] && !errors['investmentRange.max'] && !errors['investmentRange.currency']) {
          commonProfile.investmentRange = { min, max, currency: range.currency };
        }
      }
    }
    for (const key of ['website', 'linkedInUrl']) {
      const field = url(input, key, errors);
      if (field !== undefined) commonProfile[key] = field;
    }
  } else if (role === 'founder') {
    const designation = text(input, 'founderDesignation', errors, { min: 2, max: 80 });
    if (designation !== undefined) commonProfile.founderDesignation = designation;
    for (const key of ['annualTurnover', 'fundingRaised']) {
      if (input[key] === undefined) continue;
      const amount = input[key] === null || input[key] === '' ? null : Number(input[key]);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000)) errors[key] = 'Enter a valid amount.';
      else commonProfile[key] = amount;
    }
    if (input.turnoverCurrency !== undefined) {
      if (input.turnoverCurrency !== '' && !currencies.has(input.turnoverCurrency)) errors.turnoverCurrency = 'Choose a supported currency.';
      else commonProfile.turnoverCurrency = input.turnoverCurrency;
    }
    const year = text(input, 'financialYear', errors, { max: 20 });
    if (year !== undefined) commonProfile.financialYear = year;
  }

  if (!Object.keys(input).length) errors._form = 'Provide at least one field to update.';
  return { value: { displayName: value.displayName, profile: commonProfile }, errors };
}
