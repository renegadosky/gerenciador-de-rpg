import type { LibraryRecord, LibraryType, Character, CharacterBundle, CharacterMeta, Project, ProjectInput, Sheet, SheetMeta, TemplateBundle, Variable } from '../types';

export class ConflictError extends Error {
  constructor(message = 'Este documento foi alterado em outra aba ou dispositivo.') {
    super(message);
    this.name = 'ConflictError';
  }
}
export class NotFoundError extends Error {
  constructor(what = 'Item') {
    super(`${what} não encontrado.`);
    this.name = 'NotFoundError';
  }
}

/**
 * Interface única de persistência. A UI só conhece isto; há uma implementação local
 * (IndexedDB) e uma Supabase. As próximas etapas (biblioteca, relações, documentos)
 * entram aqui como novos métodos, sem mexer nas telas existentes.
 */
export interface Repository {
  readonly kind: 'local' | 'supabase';

  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project>;
  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<ProjectInput>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  listSheets(projectId: string): Promise<SheetMeta[]>;
  getSheet(id: string): Promise<Sheet>;
  createSheet(projectId: string, name: string): Promise<Sheet>;
  /** Grava a ficha. Lança ConflictError se `sheet.version` não for a versão atual no armazenamento. */
  saveSheet(sheet: Sheet): Promise<Sheet>;
  renameSheet(id: string, name: string): Promise<void>;
  deleteSheet(id: string): Promise<void>;

  listVariables(projectId: string): Promise<Variable[]>;
  /** Substitui o conjunto de variáveis do projeto. */
  saveVariables(projectId: string, vars: Variable[]): Promise<void>;

  /** Personagens: cada jogador preenche o seu a partir de um modelo (ficha) sem alterar o layout. */
  listCharacters(projectId: string): Promise<CharacterMeta[]>;
  getCharacter(id: string): Promise<Character>;
  createCharacter(projectId: string, sheetId: string, name: string): Promise<Character>;
  saveCharacter(c: Character): Promise<Character>;
  renameCharacter(id: string, name: string): Promise<void>;
  deleteCharacter(id: string): Promise<void>;

  /** Biblioteca: tipos (categorias com campos próprios) e seus registros. */
  listLibraryTypes(projectId: string): Promise<LibraryType[]>;
  /** Substitui o conjunto de tipos; registros de tipos removidos são apagados junto. */
  saveLibraryTypes(projectId: string, types: LibraryType[]): Promise<void>;
  listLibraryRecords(projectId: string): Promise<LibraryRecord[]>;
  saveLibraryRecord(record: LibraryRecord): Promise<void>;
  deleteLibraryRecord(id: string): Promise<void>;

  /** Compartilhamento por arquivo. */
  exportTemplate(projectId: string, sheetId: string): Promise<TemplateBundle>;
  importTemplate(bundle: TemplateBundle): Promise<Project>;
  exportCharacter(id: string): Promise<CharacterBundle>;
  importCharacter(bundle: CharacterBundle): Promise<Character>;
}

export class BundleError extends Error {
  constructor(message: string) { super(message); this.name = 'BundleError'; }
}

/** Valida o formato de um arquivo importado (vem de fora: nunca confiar). */
export function parseTemplateBundle(raw: unknown): TemplateBundle {
  const b = raw as any;
  if (!b || b.format !== 'gerenciador-rpg/modelo' || b.version !== 1) throw new BundleError('Este arquivo não é um modelo de ficha do Gerenciador de RPG.');
  if (!b.project?.id || typeof b.project.name !== 'string') throw new BundleError('O arquivo está incompleto (projeto ausente).');
  if (!Array.isArray(b.sheets) || !b.sheets.length) throw new BundleError('O arquivo não contém nenhuma ficha.');
  if (!Array.isArray(b.variables)) throw new BundleError('O arquivo está incompleto (variáveis ausentes).');
  return b as TemplateBundle;
}
export function parseCharacterBundle(raw: unknown): CharacterBundle {
  const b = raw as any;
  if (!b || b.format !== 'gerenciador-rpg/personagem' || b.version !== 1) throw new BundleError('Este arquivo não é um personagem do Gerenciador de RPG.');
  if (!b.character?.id || !b.sheetId || !b.projectId) throw new BundleError('O arquivo de personagem está incompleto.');
  return b as CharacterBundle;
}
