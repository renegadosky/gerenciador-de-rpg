export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '',
};
/** Sem as variáveis do Supabase, o app roda em modo local (IndexedDB), sem login. */
export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseAnonKey);
