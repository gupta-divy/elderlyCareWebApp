"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseConfigured = void 0;
exports.createClient = createClient;
const ssr_1 = require("@supabase/ssr");
const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let browserClient = null;
exports.isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
function createClient() {
    if (!exports.isSupabaseConfigured) {
        throw new Error('Supabase environment variables are not configured.');
    }
    browserClient ??= (0, ssr_1.createBrowserClient)(supabaseUrl, supabasePublishableKey);
    return browserClient;
}
