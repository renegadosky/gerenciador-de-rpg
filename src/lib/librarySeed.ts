import { uid } from './ids';
import type { FieldDef, LibraryType } from '../types';

const f = (name: string, kind: FieldDef['kind'], extra: Partial<FieldDef> = {}): FieldDef => ({ id: uid(), name, kind, ...extra });
const base = () => [f('Imagem', 'image'), f('Descrição', 'longtext')];

/**
 * Categorias iniciais: apenas um ponto de partida. Todas podem ser renomeadas, ter campos
 * alterados ou ser excluídas; o usuário também cria as suas.
 */
const SEEDS: { name: string; icon: string; fields: () => FieldDef[] }[] = [
  { name: 'Armas', icon: 'sword', fields: () => [...base(), f('Dano', 'text'), f('Raridade', 'text'), f('Requisitos', 'text'), f('Efeitos', 'longtext')] },
  { name: 'Armaduras', icon: 'shield', fields: base },
  { name: 'Roupas', icon: 'leaf', fields: base },
  { name: 'Itens', icon: 'flask', fields: base },
  { name: 'Moedas', icon: 'coins', fields: base },
  { name: 'Criaturas', icon: 'skull', fields: base },
  { name: 'Personagens', icon: 'crown', fields: base },
  { name: 'Facções', icon: 'flame', fields: base },
  { name: 'Organizações', icon: 'key', fields: base },
  { name: 'Cidades', icon: 'map', fields: base },
  { name: 'Regiões', icon: 'compass', fields: base },
  { name: 'Localizações', icon: 'footprints', fields: base },
  { name: 'Armadilhas', icon: 'bone', fields: base },
  { name: 'Habilidades', icon: 'zap', fields: base },
  { name: 'E.G.O.s', icon: 'moon', fields: base },
  { name: 'Eventos', icon: 'scroll', fields: base },
  { name: 'Relíquias', icon: 'gem', fields: base },
];

export function seedLibraryTypes(projectId: string): LibraryType[] {
  return SEEDS.map((s, i) => ({ id: uid(), projectId, name: s.name, icon: s.icon, fields: s.fields(), position: i }));
}

const flagKey = (pid: string) => `rpg-libseed:${pid}`;
export const wasSeeded = (pid: string) => { try { return localStorage.getItem(flagKey(pid)) === '1'; } catch { return false; } };
export const markSeeded = (pid: string) => { try { localStorage.setItem(flagKey(pid), '1'); } catch { /* ignora */ } };
