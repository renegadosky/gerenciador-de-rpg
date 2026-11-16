import { Link, NavLink, Outlet } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { SaveBadge } from '../components/ui';
import { useRules } from '../stores/rules';
import { useProject } from './ProjectLoader';

const NAV = [
  { to: 'sheets', icon: 'shapes', label: 'Modelos de ficha' },
  { to: 'characters', icon: 'smile', label: 'Personagens' },
  { to: 'rules', icon: 'sigma', label: 'Regras e fórmulas' },
  { to: 'library', icon: 'library', label: 'Biblioteca' },
  { to: 'relations', icon: 'network', label: 'Relações', soon: true },
  { to: 'docs', icon: 'file', label: 'Documentação', soon: true },
];

export default function ProjectShell() {
  const ctx = useProject();
  const status = useRules((s) => s.status);
  const saveError = useRules((s) => s.saveError);
  return (
    <div className="flex h-full">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-g-700 bg-g-850">
        <Link to="/" className="flex items-center gap-2 px-3 py-3 text-xs text-g-400 hover:text-g-100"><Logo size={18} /> <span className="font-display font-bold tracking-wide text-g-200">Gerenciador de RPG</span></Link>
        <div className="border-b border-g-700 px-3 pb-3">
          <div className="truncate font-display text-base font-bold" title={ctx.project.name}>{ctx.project.name}</div>
          {ctx.project.kind === 'imported' && <div className="mt-0.5 inline-block rounded bg-accent-soft px-1.5 text-2xs text-accent">recebido do mestre</div>}
          {ctx.project.description && <div className="line-clamp-2 text-xs text-g-400">{ctx.project.description}</div>}
        </div>
        <nav className="flex-1 p-2">
          {(ctx.project.kind === 'imported' ? NAV.filter((n) => n.to === 'characters') : NAV).map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `mb-0.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${isActive ? 'bg-accent-soft font-medium text-accent shadow-[inset_2px_0_0_rgb(var(--accent))]' : 'text-g-300 hover:bg-g-800'}`}>
              <Icon name={n.icon} size={15} /> <span className="flex-1">{n.label}</span>
              {n.soon && <span className="rounded bg-g-700 px-1.5 text-2xs text-g-400">em breve</span>}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-g-700 p-3"><SaveBadge status={status} error={saveError} /><ThemeSwitcher up /></div>
      </aside>
      <main className="glow-bg min-w-0 flex-1 overflow-y-auto bg-g-900"><Outlet context={ctx} /></main>
    </div>
  );
}
