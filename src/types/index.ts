import type { Value } from '../engine/formula';

export type { Value };

/* ───────────── Projetos ───────────── */
export interface Project {
  id: string;
  name: string;
  description: string;
  /** data URL (modo local) ou URL pública (Supabase Storage) */
  coverUrl: string | null;
  /** 'own' = projeto do mestre (edita tudo); 'imported' = recebido de um mestre (só joga) */
  kind: 'own' | 'imported';
  createdAt: string;
  updatedAt: string;
}
export type ProjectInput = Pick<Project, 'name' | 'description' | 'coverUrl'>;

/* ───────────── Regras: variáveis ───────────── */
export type VarType = 'number' | 'text' | 'boolean';

export interface Variable {
  id: string;
  name: string;
  type: VarType;
  /** valor inicial (usado quando não há fórmula) */
  initial: Value;
  /** se preenchida, a variável é calculada e somente leitura */
  formula: string;
  /** agrupamento livre definido pelo usuário (ex.: "Atributos"); nada é pré-definido */
  group: string;
  description: string;
}

/* ───────────── Cena do editor visual ───────────── */
export type NodeType =
  | 'group'
  | 'text'
  | 'image'
  | 'box'
  | 'shape'
  | 'table'
  | 'number'
  | 'input'
  | 'select'
  | 'progress'
  | 'indicator'
  | 'button'
  | 'icon'
  | 'list';

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  valign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  shadow?: boolean;
}

/**
 * Dados específicos de cada tipo. Chaves usadas:
 *  text/button: text · image: src, fit · shape: shape ('rect'|'ellipse'|'triangle'|'line'|'diamond')
 *  icon: icon · campos: bind (id da variável), dataType, initial, min, max, step, decimals, prefix, suffix, editable, label
 *  select: options · progress: bind, maxBind, max · indicator: bind, onColor/offColor, threshold
 *  button: action ('none'|'inc'|'dec'|'set'|'toggle'), actionValue · list: items, ordered · table: rows, header
 */
export type NodeData = Record<string, any>;

export interface SceneNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  parentId: string | null;
  /** apenas para grupos: ids dos filhos, de baixo para cima */
  children?: string[];
  aspectLocked?: boolean;
  style: NodeStyle;
  data: NodeData;
}

export interface PageSettings {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: string;
  visible: boolean;
}

export interface Scene {
  nodes: Record<string, SceneNode>;
  /** ids de raiz, de baixo para cima (último = na frente) */
  order: string[];
  page: PageSettings;
}

/* ───────────── Fichas (documentos do construtor) ───────────── */
export interface PlayState {
  /** valor atual de variáveis "de entrada" quando a ficha está em modo jogo */
  vars: Record<string, Value>;
  /** estado de campos não vinculados a variáveis (valor simples) e de listas/tabelas editáveis (matrizes) */
  nodes: Record<string, unknown>;
}

export interface SheetMeta {
  id: string;
  projectId: string;
  name: string;
  updatedAt: string;
}
export interface Sheet extends SheetMeta {
  scene: Scene;
  play: PlayState;
  /** incrementa a cada gravação; detecta edição concorrente em outra aba */
  version: number;
}

/* ───────────── Personagens (instâncias de um modelo) ───────────── */
export interface CharacterMeta {
  id: string;
  projectId: string;
  sheetId: string;
  name: string;
  updatedAt: string;
}
export interface Character extends CharacterMeta {
  play: PlayState;
  version: number;
}

/* ───────────── Pacotes de compartilhamento (arquivos .json) ───────────── */
export interface TemplateBundle {
  format: 'gerenciador-rpg/modelo';
  version: 1;
  exportedAt: string;
  project: { id: string; name: string; description: string; coverUrl: string | null };
  variables: Variable[];
  sheets: { id: string; name: string; scene: Scene }[];
}
export interface CharacterBundle {
  format: 'gerenciador-rpg/personagem';
  version: 1;
  exportedAt: string;
  projectId: string;
  sheetId: string;
  templateName: string;
  character: { id: string; name: string; play: PlayState };
}

/* ───────────── Biblioteca ───────────── */
export type FieldKind = 'text' | 'longtext' | 'number' | 'select' | 'boolean' | 'image' | 'link';

export interface FieldDef {
  id: string;
  name: string;
  kind: FieldKind;
  /** apenas kind 'select' */
  options?: string[];
  /** apenas kind 'link': restringe a um tipo (id); vazio = qualquer registro */
  linkType?: string;
}
export interface LibraryType {
  id: string;
  projectId: string;
  name: string;
  icon: string;
  fields: FieldDef[];
  position: number;
}
export interface LibraryRecord {
  id: string;
  projectId: string;
  typeId: string;
  name: string;
  /** valores por id de campo: string | number | boolean | string[] (vínculos) */
  data: Record<string, unknown>;
  updatedAt: string;
}
