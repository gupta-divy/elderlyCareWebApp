import type { CountryCode } from 'libphonenumber-js';

export type TimezoneOption = {
  value: string;
  label: string;
};

const fallbackTimezone = 'UTC';

export const COUNTRY_TIMEZONES: Partial<Record<CountryCode, TimezoneOption[]>> = {
  IN: [{ value: 'Asia/Kolkata', label: 'India Time' }],
  US: [
    { value: 'America/New_York', label: 'Eastern Time' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'America/Anchorage', label: 'Alaska Time' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  ],
  CA: [
    { value: 'America/Toronto', label: 'Eastern Time' },
    { value: 'America/Winnipeg', label: 'Central Time' },
    { value: 'America/Edmonton', label: 'Mountain Time' },
    { value: 'America/Vancouver', label: 'Pacific Time' },
    { value: 'America/Halifax', label: 'Atlantic Time' },
    { value: 'America/St_Johns', label: 'Newfoundland Time' },
  ],
  GB: [{ value: 'Europe/London', label: 'United Kingdom Time' }],
  AU: [
    { value: 'Australia/Sydney', label: 'Eastern Time' },
    { value: 'Australia/Adelaide', label: 'Central Time' },
    { value: 'Australia/Perth', label: 'Western Time' },
  ],
  AE: [{ value: 'Asia/Dubai', label: 'Gulf Time' }],
  SG: [{ value: 'Asia/Singapore', label: 'Singapore Time' }],
  BD: [{ value: 'Asia/Dhaka', label: 'Bangladesh Time' }],
  NP: [{ value: 'Asia/Kathmandu', label: 'Nepal Time' }],
  PK: [{ value: 'Asia/Karachi', label: 'Pakistan Time' }],
};

export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || fallbackTimezone;
}

export function isValidTimezone(timezone?: string | null): timezone is string {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getTimezoneOptionsForCountry(country: CountryCode): TimezoneOption[] {
  return COUNTRY_TIMEZONES[country] ?? [{ value: getLocalTimezone(), label: 'Local Time' }];
}

export function getDefaultTimezoneForCountry(country: CountryCode): string {
  return getTimezoneOptionsForCountry(country)[0]?.value ?? getLocalTimezone();
}

export function resolveTimezone(timezone?: string | null): string {
  return isValidTimezone(timezone) ? timezone : getLocalTimezone();
}

function getZonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const hour = partValue('hour');

  return {
    year: partValue('year'),
    month: partValue('month'),
    day: partValue('day'),
    hour: hour === 24 ? 0 : hour,
    minute: partValue('minute'),
    second: partValue('second'),
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zonedAsUtc - date.getTime();
}

export function zonedDateTimeToUtc(dateKey: string, time: string, timezone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour = 0, minute = 0] = time ? time.split(':').map(Number) : [23, 59];
  const normalizedTimezone = resolveTimezone(timezone);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, time ? 0 : 59, time ? 0 : 999));
  const firstPass = new Date(utcGuess.getTime() - getTimezoneOffsetMs(utcGuess, normalizedTimezone));
  const secondPass = new Date(utcGuess.getTime() - getTimezoneOffsetMs(firstPass, normalizedTimezone));
  return secondPass;
}

export function formatViewerDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatViewerTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateInTimezone(iso: string, timezone?: string | null): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: resolveTimezone(timezone),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimeInTimezone(iso: string, timezone?: string | null): string {
  return new Date(iso).toLocaleTimeString([], {
    timeZone: resolveTimezone(timezone),
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function formatWallTimeInTimezone(dateKey: string, time: string, timezone?: string | null): string {
  if (!time) return 'Anytime today';
  return formatTimeInTimezone(zonedDateTimeToUtc(dateKey, time, resolveTimezone(timezone)).toISOString(), timezone);
}

export function formatTimezoneLabel(timezone?: string | null): string {
  const resolved = resolveTimezone(timezone);
  const explicit = Object.values(COUNTRY_TIMEZONES)
    .flat()
    .find((option) => option.value === resolved);
  return explicit?.label ?? resolved.replace(/_/g, ' ');
}
