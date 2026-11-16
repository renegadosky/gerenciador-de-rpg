import { useEffect, useRef, useState } from 'react';
import { THEMES, useTheme } from '../stores/theme';
import { Icon } from './Icon';

/** Seletor de aparência. `up` abre o menu para cima (usado em rodapés). */
export function ThemeSwitcher({ up = false, label = false }: { up?: boolean; label?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button className={label ? 'btn btn-ghost !py-1' : 'icon-btn'} title="Aparência" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="palette" size={15} />{label && <span>Aparência</span>}
      </button>
      {open && (
        <div role="menu" className={`anim-in absolute right-0 z-50 w-56 rounded-xl border border-g-700 bg-g-850 p-1.5 shadow-2xl ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={theme === t.id} onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-g-800 ${theme === t.id ? 'bg-g-800' : ''}`}>
              <span className="h-5 w-5 shrink-0 rounded-full border border-white/20" style={{ background: t.swatch }} />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-g-100">{t.name}</span><span className="block truncate text-2xs text-g-400">{t.hint}</span></span>
              {theme === t.id && <Icon name="check" size={13} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
