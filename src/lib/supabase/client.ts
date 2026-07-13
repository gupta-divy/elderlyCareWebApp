import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment variables are not configured.');
  }

  browserClient ??= createBrowserClient(supabaseUrl as string, supabasePublishableKey as string);
  return browserClient;
}
