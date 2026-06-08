import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let _client;

export const getSupabase = () => {
  if (!_client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials are missing. Check your .env file.');
    }
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
};
