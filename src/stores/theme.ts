import { create } from 'zustand';

export interface ThemeInfo { id: string; name: string; hint: string; swatch: string }
export const THEMES: ThemeInfo[] = [
  { id: 'grafite', name: 'Grafite', hint: 'Neutro, estilo editor de design', swatch: '#7b8cff' },
  { id: 'grimorio', name: 'Grimório', hint: 'Marrom escuro e dourado', swatch: '#d6a64a' },
  { id: 'arcano', name: 'Arcano', hint: 'Violeta profundo', swatch: '#b07cff' },
  { id: 'gelo', name: 'Gelo', hint: 'Azul-petróleo e turquesa', swatch: '#4ecdc4' },
  { id: 'pergaminho', name: 'Pergaminho', hint: 'Claro, cor de papel', swatch: '#964628' },
];
const KEY = 'rpg-theme';

export function storedTheme(): string {
  try {
    const t = localStorage.getItem(KEY);
    if (t && THEMES.some((x) => x.id === t)) return t;
  } catch { /* armazenamento bloqueado: usa o padrão */ }
  return 'grafite';
}

export function applyTheme(id: string) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(KEY, id); } catch { /* ignora */ }
}

export const useTheme = create<{ theme: string; setTheme: (id: string) => void }>((set) => ({
  theme: storedTheme(),
  setTheme: (id) => { applyTheme(id); set({ theme: id }); },
}));
