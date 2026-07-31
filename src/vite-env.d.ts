/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_ELDERCARE_STORAGE_KEY?: string;
  readonly VITE_FEATURE_DOCUMENTS?: string;
  readonly VITE_FEATURE_SHARED_NOTES?: string;
  readonly VITE_FEATURE_CALENDAR?: string;
  readonly VITE_FEATURE_REMOTE_SUPPORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
