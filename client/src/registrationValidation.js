const MAX_INVESTMENT = 1_000_000_000_000;

export function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}

export function validateAccountStep(form) {
  const errors = {};
  if (!String(form.fullName || '').trim()) errors.fullName = 'Enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email || '').trim())) {
    errors.email = 'Enter a valid email address.';
  }
  const passwordBytes = utf8ByteLength(form.password);
  if (passwordBytes < 12 || passwordBytes > 72) {
    errors.password = 'Use a password between 12 and 72 UTF-8 bytes.';
  }
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Enter the same password in both fields.';
  }
  return errors;
}

export function parsePreferredLocations(value) {
  return String(value ?? '').split(',').map((place) => place.trim()).filter(Boolean);
}

export function validateInvestorProfile(form) {
  const errors = {};
  const locations = parsePreferredLocations(form.preferredStartupLocations);
  if (!Array.isArray(form.industriesOfInterest) || form.industriesOfInterest.length < 1) {
    errors.industriesOfInterest = 'Choose at least one industry of interest.';
  }
  if (!Array.isArray(form.preferredFundingStages) || form.preferredFundingStages.length < 1) {
    errors.preferredFundingStages = 'Choose at least one preferred funding stage.';
  }
  if (locations.length < 1 || locations.length > 20) {
    errors.preferredStartupLocations = 'Enter between 1 and 20 locations, separated by commas.';
  } else if (locations.some((place) => place.length < 2 || place.length > 80)) {
    errors.preferredStartupLocations = 'Each location must be between 2 and 80 characters.';
  }

  const thesis = String(form.investmentThesis ?? '').trim();
  if (thesis.length < 20 || thesis.length > 2000) {
    errors.investmentThesis = 'Investment thesis must be between 20 and 2,000 characters.';
  }

  const minRaw = String(form.minInvestment ?? '').trim();
  const maxRaw = String(form.maxInvestment ?? '').trim();
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!minRaw || !Number.isFinite(min) || min < 0 || min > MAX_INVESTMENT) {
    errors.minInvestment = 'Enter a minimum amount from 0 to 1,000,000,000,000.';
  }
  if (!maxRaw || !Number.isFinite(max) || max < 0 || max > MAX_INVESTMENT) {
    errors.maxInvestment = 'Enter a maximum amount from 0 to 1,000,000,000,000.';
  } else if (!errors.minInvestment && max < min) {
    errors.maxInvestment = 'Maximum must be equal to or greater than minimum.';
  }
  return { errors, locations, min, max };
}

export function buildInvestorRegistrationPayload(form, profileCheck = validateInvestorProfile(form)) {
  const payload = {
    ...form,
    investmentRange: { min: profileCheck.min, max: profileCheck.max, currency: form.currency },
    preferredStartupLocations: profileCheck.locations,
  };
  delete payload.minInvestment;
  delete payload.maxInvestment;
  delete payload.currency;
  return payload;
}

export function mapRegistrationFieldErrors(fields = {}) {
  const mapped = {};
  const aliases = {
    'investmentRange.min': 'minInvestment',
    'investmentRange.max': 'maxInvestment',
    'profile.investmentRange.min': 'minInvestment',
    'profile.investmentRange.max': 'maxInvestment',
  };
  for (const [key, value] of Object.entries(fields)) {
    const message = typeof value === 'string' ? value : Array.isArray(value) ? value.find((item) => typeof item === 'string') : '';
    if (message) mapped[aliases[key] || key] = message;
  }
  return mapped;
}

export function passwordToggleProps(isVisible) {
  return {
    inputType: isVisible ? 'text' : 'password',
    buttonType: 'button',
    label: isVisible ? 'Hide password' : 'Show password',
  };
}

export function clearFieldErrors(errors, name) {
  const next = { ...errors };
  delete next[name];
  if (name === 'minInvestment' || name === 'maxInvestment') {
    delete next.minInvestment;
    delete next.maxInvestment;
  }
  return next;
}
