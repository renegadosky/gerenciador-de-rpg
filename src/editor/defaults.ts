import { uid } from '../lib/ids';
import type { NodeType, SceneNode } from '../types';

export interface ElementDef {
  type: Exclude<NodeType, 'group'>;
  label: string;
  /** chave do ícone (ver components/Icon.tsx) */
  icon: string;
  /** rótulo curto da paleta */
  short: string;
  shortcut?: string;
  w: number;
  h: number;
  make: () => Pick<SceneNode, 'style' | 'data' | 'name'> & { aspectLocked?: boolean };
}

const font = 'Inter, system-ui, sans-serif';

/**
 * Predefinições de ELEMENTOS (não de fichas): só o ponto de partida visual de cada tipo.
 * O usuário muda tudo no painel de propriedades.
 */
export const ELEMENTS: ElementDef[] = [
  { type: 'text', short: 'Texto', label: 'Texto', icon: 'type', shortcut: 'T', w: 200, h: 40,
    make: () => ({ name: 'Texto', style: { color: '#e7e7ea', fontFamily: font, fontSize: 20, fontWeight: 400, align: 'left', valign: 'top', lineHeight: 1.3 }, data: { text: 'Texto' } }) },
  { type: 'image', short: 'Imagem', label: 'Imagem', icon: 'image', shortcut: 'I', w: 240, h: 240,
    make: () => ({ name: 'Imagem', style: { radius: 0 }, data: { src: '', fit: 'cover' } }) },
  { type: 'box', short: 'Caixa', label: 'Caixa / painel', icon: 'square', shortcut: 'B', w: 240, h: 160,
    make: () => ({ name: 'Caixa', style: { fill: '#2a2a31', stroke: '#3c3c45', strokeWidth: 1, radius: 8 }, data: {} }) },
  { type: 'shape', short: 'Forma', label: 'Forma', icon: 'shapes', shortcut: 'R', w: 120, h: 120,
    make: () => ({ name: 'Forma', style: { fill: '#6b7cff', stroke: '', strokeWidth: 0 }, data: { shape: 'rect' } }) },
  { type: 'number', short: 'Número', label: 'Campo numérico', icon: 'hash', shortcut: 'N', w: 120, h: 44,
    make: () => ({ name: 'Número', style: { fill: '#25252b', stroke: '#3c3c45', strokeWidth: 1, radius: 6, color: '#f1f1f4', fontFamily: font, fontSize: 20, fontWeight: 600, align: 'center' },
      data: { dataType: 'number', initial: 0, min: '', max: '', step: 1, decimals: 0, prefix: '', suffix: '', editable: true, bind: '' } }) },
  { type: 'input', short: 'Texto livre', label: 'Campo de texto', icon: 'text-cursor', w: 220, h: 44,
    make: () => ({ name: 'Texto livre', style: { fill: '#25252b', stroke: '#3c3c45', strokeWidth: 1, radius: 6, color: '#f1f1f4', fontFamily: font, fontSize: 16, align: 'left' },
      data: { initial: '', editable: true, multiline: false, placeholder: 'Digite…', bind: '' } }) },
  { type: 'select', short: 'Seleção', label: 'Campo de seleção', icon: 'list-checks', w: 200, h: 44,
    make: () => ({ name: 'Seleção', style: { fill: '#25252b', stroke: '#3c3c45', strokeWidth: 1, radius: 6, color: '#f1f1f4', fontFamily: font, fontSize: 16 },
      data: { options: ['Opção 1', 'Opção 2'], initial: '', editable: true, bind: '' } }) },
  { type: 'progress', short: 'Barra', label: 'Barra de progresso', icon: 'gauge', shortcut: 'P', w: 240, h: 22,
    make: () => ({ name: 'Barra', style: { fill: '#3a3a43', stroke: '#e5484d', strokeWidth: 0, radius: 11, color: '#e5484d' },
      data: { bind: '', maxBind: '', initial: 50, max: 100, showText: true } }) },
  { type: 'indicator', short: 'Indicador', label: 'Indicador', icon: 'circle-dot', w: 36, h: 36,
    make: () => ({ name: 'Indicador', style: { fill: '#3a3a43', stroke: '#3c3c45', strokeWidth: 2, color: '#2ecc71' },
      data: { bind: '', initial: false, shape: 'ellipse', editable: true } }) },
  { type: 'button', short: 'Botão', label: 'Botão', icon: 'mouse-pointer-click', w: 140, h: 40,
    make: () => ({ name: 'Botão', style: { fill: '#4b5bd6', stroke: '', strokeWidth: 0, radius: 8, color: '#ffffff', fontFamily: font, fontSize: 15, fontWeight: 600, align: 'center' },
      data: { text: 'Botão', action: 'none', bind: '', actionValue: 1 } }) },
  { type: 'icon', short: 'Ícone', label: 'Ícone', icon: 'smile', w: 48, h: 48, 
    make: () => ({ name: 'Ícone', style: { color: '#e7e7ea', strokeWidth: 2 }, data: { icon: 'sword' }, aspectLocked: true }) },
  { type: 'list', short: 'Lista', label: 'Lista', icon: 'list', w: 240, h: 140,
    make: () => ({ name: 'Lista', style: { color: '#e7e7ea', fontFamily: font, fontSize: 16, lineHeight: 1.5 }, data: { items: ['Item 1', 'Item 2'], ordered: false } }) },
  { type: 'table', short: 'Tabela', label: 'Tabela', icon: 'table', w: 360, h: 140,
    make: () => ({ name: 'Tabela', style: { fill: '#25252b', stroke: '#3c3c45', strokeWidth: 1, color: '#e7e7ea', fontFamily: font, fontSize: 14, radius: 6 },
      data: { rows: [['Coluna A', 'Coluna B', 'Coluna C'], ['', '', ''], ['', '', '']], header: true } }) },
];

export const ELEMENT_BY_TYPE = Object.fromEntries(ELEMENTS.map((e) => [e.type, e])) as Record<string, ElementDef>;

export function createNode(type: ElementDef['type'], at: { x: number; y: number }, size?: { w: number; h: number }): SceneNode {
  const def = ELEMENT_BY_TYPE[type];
  const m = def.make();
  return {
    id: uid(), type, name: m.name,
    x: at.x, y: at.y, w: size?.w ?? def.w, h: size?.h ?? def.h,
    rotation: 0, opacity: 1, locked: false, hidden: false, parentId: null,
    aspectLocked: m.aspectLocked ?? false,
    style: m.style, data: m.data,
  };
}
