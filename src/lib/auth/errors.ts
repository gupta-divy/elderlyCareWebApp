type ErrorLike = {
  message?: string;
  status?: number;
  code?: string;
};

function getMessage(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as ErrorLike).message ?? '');
  }
  return String(error);
}

export function friendlyAuthError(error: unknown) {
  const message = getMessage(error);

  if (/invalid login credentials/i.test(message)) {
    return 'Email or password is incorrect.';
  }
  if (/user already registered|already registered|already exists|duplicate/i.test(message)) {
    return 'An account already exists for this email. Please sign in instead.';
  }
  if (/invalid email|email address/i.test(message)) {
    return 'Please enter a valid email address.';
  }
  if (/password/i.test(message) && /weak|short|least|characters/i.test(message)) {
    return 'Please use a stronger password with at least 8 characters.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email before signing in.';
  }
  if (/failed to fetch|network|fetch/i.test(message)) {
    return 'We could not reach Supabase. Please check your connection and try again.';
  }

  return 'Something went wrong. Please try again.';
}

export function friendlyOnboardingError(error: unknown) {
  const message = getMessage(error);

  if (/could not find the function|schema cache|function .* does not exist/i.test(message)) {
    return 'Supabase cannot find the onboarding RPC. Please run the latest database migration and reload the app.';
  }
  if (/ambiguous|column reference/i.test(message)) {
    return 'The onboarding RPC needs the latest database fix. Please run the newest Supabase migration and try again.';
  }
  if (/permission denied|not allowed|42501/i.test(message)) {
    return 'Supabase permissions are not ready for onboarding. Please run the latest migration and try again.';
  }
  if (/FAMILY_NOT_FOUND|family does not exist/i.test(message)) {
    return 'We could not find that Family ID. Please check it and try again.';
  }
  if (/INVALID_FAMILY_CODE|family code/i.test(message)) {
    return 'Please enter a Family ID like FAM-7K4P9Q.';
  }
  if (/DUPLICATE_MEMBERSHIP|duplicate key|already a member/i.test(message)) {
    return 'You are already a member of this family.';
  }
  if (/INVALID_ROLE|role/i.test(message)) {
    return 'Please choose Parent or Child.';
  }
  if (/INVALID_WHATSAPP|whatsapp|phone/i.test(message)) {
    return 'Please enter a valid international WhatsApp number.';
  }
  if (/PROFILE/i.test(message)) {
    return 'We could not save your profile. Please try again.';
  }
  if (/FAMILY/i.test(message)) {
    return 'We could not create or join the family. Please try again.';
  }
  if (/JWT|session|auth\.uid|authenticated/i.test(message)) {
    return 'Your session expired. Please sign in and try again.';
  }
  if (/failed to fetch|network|fetch/i.test(message)) {
    return 'We could not reach Supabase. Please check your connection and try again.';
  }

  return 'We could not finish family setup. Please try again.';
}
