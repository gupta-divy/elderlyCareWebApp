export type ContactValidationResult = {
  isValid: boolean;
  message?: string;
};

export function sanitizeIndianPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function formatIndianPhoneNumber(digits: string): string {
  return `+91${digits}`;
}

export function validateContactForm(
  name: string,
  phoneDigits: string,
): ContactValidationResult {
  if (!name.trim()) {
    return { isValid: false, message: 'Please enter name' };
  }

  if (phoneDigits.length !== 10) {
    return { isValid: false, message: 'Please enter 10 digit phone number' };
  }

  return { isValid: true };
}
