const loginRoles = new Set(['investor', 'founder', 'admin']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fundingStages = new Set(['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth']);
const investorTypes = new Set(['angel', 'individual', 'venture-capital']);
const currencies = new Set(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD']);

function optionalText(input, key, errors, { max = 120, min = 0 } = {}) {
  const value = input[key] === undefined || input[key] === null ? '' : input[key];
  if (typeof value !== 'string') {
    errors[key] = 'Enter valid text.';
    return '';
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) errors[key] = `Must be between ${min} and ${max} characters.`;
  return normalized;
}

function optionalUrl(input, key, errors) {
  const value = optionalText(input, key, errors, { max: 253 });
  if (value) {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
      return url.toString();
    } catch {
      errors[key] = 'Enter a valid website URL.';
    }
  }
  return value;
}

function list(input, key, errors, { required = false, allowed = null, maxItems = 20 } = {}) {
  const raw = input[key] === undefined ? [] : input[key];
  if (!Array.isArray(raw) || raw.length > maxItems || (required && raw.length === 0)) {
    errors[key] = required ? `Choose between 1 and ${maxItems} values.` : `Choose no more than ${maxItems} values.`;
    return [];
  }
  const values = [...new Set(raw.map((item) => typeof item === 'string' ? item.trim() : ''))];
  if (values.some((item) => item.length < 2 || item.length > 80 || (allowed && !allowed.has(item)))) {
    errors[key] = 'One or more selections are invalid.';
    return [];
  }
  return values;
}

function commonRegistration(input, errors) {
  const nameInput = { ...input, fullName: input.fullName ?? input.displayName };
  const displayName = optionalText(nameInput, 'fullName', errors, { min: 2, max: 80 });
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const confirmPassword = typeof input.confirmPassword === 'string' ? input.confirmPassword : '';
  if (email.length > 254 || !emailPattern.test(email)) errors.email = 'Enter a valid email address.';
  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (passwordBytes < 12 || passwordBytes > 72) errors.password = 'Password must be between 12 and 72 bytes.';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  if (Object.hasOwn(input, 'role')) errors.role = 'Account role is determined by this registration flow.';
  const profile = {
    phone: optionalText(input, 'phone', errors, { max: 30 }),
    city: optionalText(input, 'city', errors, { max: 100 }),
    country: optionalText(input, 'country', errors, { max: 100 }),
    profilePhotoUrl: optionalUrl(input, 'profilePhotoUrl', errors),
  };
  return { displayName, email, password, profile };
}

export function validateInvestorRegistration(input = {}) {
  const errors = {};
  const common = commonRegistration(input, errors);
  const investorType = input.investorType;
  if (!investorTypes.has(investorType)) errors.investorType = 'Choose a valid investor type.';
  const investmentThesis = optionalText(input, 'investmentThesis', errors, { min: 20, max: 2000 });
  const industriesOfInterest = list(input, 'industriesOfInterest', errors, { required: true });
  const preferredFundingStages = list(input, 'preferredFundingStages', errors, { required: true, allowed: fundingStages });
  const preferredStartupLocations = list(input, 'preferredStartupLocations', errors, { required: true });
  const investmentRange = input.investmentRange && typeof input.investmentRange === 'object' ? input.investmentRange : {};
  const min = Number(investmentRange.min);
  const max = Number(investmentRange.max);
  const currency = investmentRange.currency;
  if (!Number.isFinite(min) || min < 0 || min > 1_000_000_000_000) errors['investmentRange.min'] = 'Enter a valid minimum investment.';
  if (!Number.isFinite(max) || max < 0 || max > 1_000_000_000_000 || max < min) errors['investmentRange.max'] = 'Enter a maximum equal to or above the minimum.';
  if (!currencies.has(currency)) errors['investmentRange.currency'] = 'Choose a supported currency.';
  const profile = {
    ...common.profile,
    biography: optionalText(input, 'biography', errors, { max: 2000 }),
    investmentThesis,
    investorType,
    organizationName: optionalText(input, 'organizationName', errors, { max: 160 }),
    industriesOfInterest,
    preferredFundingStages,
    investmentRange: { min, max, currency },
    preferredStartupLocations,
    website: optionalUrl(input, 'website', errors),
    linkedInUrl: optionalUrl(input, 'linkedInUrl', errors),
  };
  return { value: { ...common, profile }, errors };
}

export function validateFounderRegistration(input = {}) {
  const errors = {};
  const common = commonRegistration(input, errors);
  const founderDesignation = optionalText(input, 'founderDesignation', errors, { min: 2, max: 80 });
  const startupInput = input.startup && typeof input.startup === 'object' ? input.startup : {};
  if (!input.startup || typeof input.startup !== 'object' || Array.isArray(input.startup)) errors.startup = 'Startup details are required.';
  const startup = {
    name: optionalText(startupInput, 'name', errors, { min: 2, max: 120 }),
    industry: optionalText(startupInput, 'industry', errors, { min: 2, max: 80 }),
    description: optionalText(startupInput, 'description', errors, { min: 20, max: 2000 }),
    location: optionalText(startupInput, 'location', errors, { min: 2, max: 120 }),
    fundingStage: startupInput.fundingStage,
    fundingGoal: Number(startupInput.fundingGoal),
    foundedYear: Number(startupInput.foundedYear),
    website: optionalUrl(startupInput, 'website', errors),
    teamSize: startupInput.teamSize === undefined || startupInput.teamSize === '' ? undefined : Number(startupInput.teamSize),
    businessModel: optionalText(startupInput, 'businessModel', errors, { max: 300 }),
    targetMarket: optionalText(startupInput, 'targetMarket', errors, { max: 500 }),
    productName: optionalText(startupInput, 'productName', errors, { max: 120 }),
    productDescription: optionalText(startupInput, 'productDescription', errors, { max: 1500 }),
  };
  if (!fundingStages.has(startup.fundingStage)) errors['startup.fundingStage'] = 'Choose a valid funding stage.';
  if (!Number.isFinite(startup.fundingGoal) || startup.fundingGoal < 1 || startup.fundingGoal > 1_000_000_000_000) errors['startup.fundingGoal'] = 'Enter a valid funding target.';
  if (!Number.isInteger(startup.foundedYear) || startup.foundedYear < 1900 || startup.foundedYear > new Date().getFullYear()) errors['startup.foundedYear'] = 'Enter a valid founding year.';
  if (startup.teamSize !== undefined && (!Number.isInteger(startup.teamSize) || startup.teamSize < 1 || startup.teamSize > 1_000_000)) errors['startup.teamSize'] = 'Enter a valid team size.';
  const annualTurnover = input.annualTurnover === undefined || input.annualTurnover === '' ? null : Number(input.annualTurnover);
  if (annualTurnover !== null && (!Number.isFinite(annualTurnover) || annualTurnover < 0 || annualTurnover > 1_000_000_000_000)) errors.annualTurnover = 'Enter a valid annual revenue amount.';
  const fundingRaised = input.fundingRaised === undefined || input.fundingRaised === '' ? null : Number(input.fundingRaised);
  if (fundingRaised !== null && (!Number.isFinite(fundingRaised) || fundingRaised < 0 || fundingRaised > 1_000_000_000_000)) errors.fundingRaised = 'Enter a valid amount raised.';
  const financialYear = optionalText(input, 'financialYear', errors, { max: 20 });
  const turnoverCurrency = input.turnoverCurrency || '';
  if ((annualTurnover !== null || fundingRaised !== null) && !currencies.has(turnoverCurrency)) errors.turnoverCurrency = 'Choose a supported financial currency.';
  const value = {
    ...common,
    profile: {
      ...common.profile,
      founderDesignation,
      annualTurnover,
      turnoverCurrency,
      financialYear,
      fundingRaised,
    },
    startup,
  };
  return { value, errors };
}

export function validateLogin(input = {}) {
  const errors = {};
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const role = input.role;
  if (email.length > 254 || !emailPattern.test(email)) errors.email = 'Enter a valid email address.';
  if (Buffer.byteLength(password, 'utf8') < 1 || Buffer.byteLength(password, 'utf8') > 72) errors.password = 'Enter a valid password.';
  if (role !== undefined && !loginRoles.has(role)) errors.role = 'Choose a valid account role.';
  return { value: { email, password, role }, errors };
}
