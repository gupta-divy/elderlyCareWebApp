import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export type PhoneCountry = {
  iso: CountryCode;
  name: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'IN', name: 'India' },
  { iso: 'US', name: 'United States' },
  { iso: 'CA', name: 'Canada' },
  { iso: 'GB', name: 'United Kingdom' },
  { iso: 'AU', name: 'Australia' },
  { iso: 'AE', name: 'United Arab Emirates' },
  { iso: 'SG', name: 'Singapore' },
  { iso: 'BD', name: 'Bangladesh' },
  { iso: 'NP', name: 'Nepal' },
  { iso: 'PK', name: 'Pakistan' },
];

export function getDialCode(country: CountryCode) {
  return `+${getCountryCallingCode(country)}`;
}

export function normalizeWhatsappNumber(country: CountryCode, localNumber: string) {
  const parsed = parsePhoneNumberFromString(localNumber.trim(), country);
  if (!parsed || !parsed.isValid()) {
    return null;
  }
  return parsed.number;
}

