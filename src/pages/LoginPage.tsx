import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { useAuth } from '../components/AuthProvider';
import { errMsg } from '../stores/toast';

export default function LoginPage() {
  const { user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Informe um e-mail válido.');
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else {
        const r = await signUp(email, password);
        if (r.needsConfirmation) setInfo('Conta criada! Confirme o e-mail que enviamos para poder entrar.');
      }
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="glow-bg relative flex h-full items-center justify-center bg-g-900 p-4"><div className="absolute right-4 top-4"><ThemeSwitcher label /></div>
      <form onSubmit={submit} className="anim-in w-full max-w-sm rounded-xl border border-g-700 bg-g-850 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
          <div><div className="font-display text-xl font-bold leading-6">Gerenciador de RPG</div><div className="text-xs text-g-400">Construa seu sistema do zero</div></div>
        </div>
        <label className="mb-3 block"><span className="mb-1 block text-xs text-g-400">E-mail</span>
          <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
        <label className="mb-4 block"><span className="mb-1 block text-xs text-g-400">Senha</span>
          <input className="field" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</div>}
        {info && <div className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{info}</div>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="mt-3 w-full text-center text-xs text-g-400 hover:text-g-100" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); setInfo(''); }}>
          {mode === 'in' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  );
}
