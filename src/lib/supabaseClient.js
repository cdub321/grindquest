import { createClient } from '@supabase/supabase-js';

// Expects these to be defined in your environment (.env for local, Netlify env vars in prod)
// VITE_SUPABASE_URL=<your_supabase_url>
// VITE_SUPABASE_ANON_KEY=<your_supabase_anon_key>  (do NOT use the service role key in the browser)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast in dev if keys are missing; avoids silent runtime errors.
  console.warn('Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
