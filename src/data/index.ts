import { createLocalRepository } from './localRepository';
import { createSupabaseRepository } from './supabaseRepository';
import { supabase } from './supabaseClient';
import type { Repository } from './repository';

export * from './repository';

/** Escolhe a implementação conforme a configuração. `userId` isola dados locais por usuário. */
export function createRepository(userId?: string): Repository {
  return supabase ? createSupabaseRepository(supabase) : createLocalRepository(userId ?? 'local');
}
