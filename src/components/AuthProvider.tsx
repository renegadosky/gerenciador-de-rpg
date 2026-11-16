import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { createRepository, Repository } from '../data';
import { supabase } from '../data/supabaseClient';
import { hasSupabase } from '../lib/env';
import { FullCenter, Spinner } from './ui';

interface AuthCtx {
  /** null = não autenticado (apenas com Supabase configurado) */
  user: { id: string; email: string } | null;
  repo: Repository | null;
  mode: 'local' | 'supabase';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthCtx['user']>(hasSupabase ? null : { id: 'local', email: 'modo local' });
  const [ready, setReady] = useState(!hasSupabase);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? '' } : null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? '' } : null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const repo = useMemo(() => (user ? createRepository(user.id) : null), [user?.id]);

  const value: AuthCtx = {
    user, repo, mode: hasSupabase ? 'supabase' : 'local',
    async signIn(email, password) {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(translate(error.message));
    },
    async signUp(email, password) {
      if (!supabase) return { needsConfirmation: false };
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(translate(error.message));
      return { needsConfirmation: !data.session };
    },
    async signOut() { await supabase?.auth.signOut(); },
  };

  if (!ready) return <FullCenter><Spinner size={22} /></FullCenter>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}

/** Repositório garantido (usado só dentro de rotas protegidas). */
export function useRepo(): Repository {
  const { repo } = useAuth();
  if (!repo) throw new Error('Sem sessão ativa.');
  return repo;
}

function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered')) return 'Este e-mail já está cadastrado.';
  if (m.includes('password should be')) return 'A senha é curta demais (mínimo de 6 caracteres).';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde um pouco.';
  if (m.includes('fetch')) return 'Não foi possível conectar ao servidor.';
  return msg;
}
