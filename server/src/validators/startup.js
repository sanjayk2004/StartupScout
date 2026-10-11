import { fundingStages } from '../models/Startup.js';

const fields = ['name', 'industry', 'description', 'location', 'fundingStage', 'fundingGoal', 'foundedYear', 'website', 'teamSize', 'businessModel', 'targetMarket', 'productName', 'productDescription'];
const optionalFields = new Set(['website', 'teamSize', 'businessModel', 'targetMarket', 'productName', 'productDescription']);

export function validateStartup(input, { partial = false } = {}) {
  const errors = {};
  const value = {};
  for (const field of fields) {
    if (Object.hasOwn(input, field)) value[field] = input[field];
    else if (!partial && !optionalFields.has(field)) errors[field] = 'This field is required.';
  }

  for (const [field, min, max] of [['name', 2, 120], ['industry', 2, 80], ['description', 20, 2000], ['location', 2, 120]]) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== 'string' || value[field].trim().length < min || value[field].trim().length > max) {
      errors[field] = `Must be a string between ${min} and ${max} characters.`;
    } else value[field] = value[field].trim();
  }

  for (const [field, max] of [['businessModel', 300], ['targetMarket', 500], ['productName', 120], ['productDescription', 1500]]) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== 'string' || value[field].trim().length > max) errors[field] = `Must be a string of at most ${max} characters.`;
    else value[field] = value[field].trim();
  }
  if (value.teamSize !== undefined && value.teamSize !== null && value.teamSize !== '') {
    const teamSize = Number(value.teamSize);
    if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 1_000_000) errors.teamSize = 'Enter a valid team size.';
    else value.teamSize = teamSize;
  }

  if (value.fundingStage !== undefined && !fundingStages.includes(value.fundingStage)) errors.fundingStage = 'Choose a supported funding stage.';
  if (value.fundingGoal !== undefined) {
    const amount = Number(value.fundingGoal);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) errors.fundingGoal = 'Must be a positive amount no greater than 1 trillion.';
    else value.fundingGoal = amount;
  }
  if (value.foundedYear !== undefined) {
    const year = Number(value.foundedYear);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) errors.foundedYear = 'Enter a valid founding year.';
    else value.foundedYear = year;
  }
  if (value.website !== undefined) {
    if (typeof value.website !== 'string' || value.website.length > 253) errors.website = 'Website must be a URL under 254 characters.';
    else if (value.website.trim()) {
      const candidate = /^https?:\/\//i.test(value.website.trim()) ? value.website.trim() : `https://${value.website.trim()}`;
      try {
        const url = new URL(candidate);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error('invalid');
        value.website = url.toString();
      } catch { errors.website = 'Enter a valid HTTP or HTTPS website URL.'; }
    } else value.website = '';
  }

  return { value, errors };
}
