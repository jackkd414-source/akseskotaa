/**
 * AksesKota — Backend Configuration
 *
 * Paste the two public values from your Supabase project here
 * (Project Settings -> API). Both are safe to expose in client code:
 * the anon key only grants what your Row Level Security policies allow.
 *
 * Leave them empty and the app keeps working in local-only mode
 * (audits stay in this browser). Fill them in and audits become shared
 * across every visitor.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const isBackendConfigured = () =>
    Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
