import { createClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '../lib/env';

export const supabase = hasSupabase ? createClient(env.supabaseUrl, env.supabaseAnonKey) : null;
