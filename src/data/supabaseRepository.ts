import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyScene, normalizeScene } from '../editor/sceneOps';
import type { LibraryRecord, LibraryType, Character, CharacterMeta, Project, ProjectInput, Sheet, SheetMeta, Variable } from '../types';
import { BundleError, ConflictError, NotFoundError, Repository } from './repository';

const toProject = (r: any): Project => ({
  id: r.id, name: r.name, description: r.description ?? '', coverUrl: r.cover_url ?? null, kind: 'own',
  createdAt: r.created_at, updatedAt: r.updated_at,
});

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what = 'Item'): T {
  if (res.error) {
    if (res.error.code === 'PGRST116') throw new NotFoundError(what);
    throw new Error(res.error.message);
  }
  return res.data as T;
}

export function createSupabaseRepository(sb: SupabaseClient): Repository {
  return {
    kind: 'supabase',

    async listProjects() {
      const data = check(await sb.from('projects').select('*').order('updated_at', { ascending: false }));
      return (data as any[]).map(toProject);
    },
    async getProject(id) {
      return toProject(check(await sb.from('projects').select('*').eq('id', id).single(), 'Projeto'));
    },
    async createProject(input: ProjectInput) {
      const row = { name: input.name, description: input.description, cover_url: input.coverUrl };
      return toProject(check(await sb.from('projects').insert(row).select().single()));
    },
    async updateProject(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
      return toProject(check(await sb.from('projects').update(row).eq('id', id).select().single(), 'Projeto'));
    },
    async deleteProject(id) {
      check(await sb.from('projects').delete().eq('id', id));
    },

    async listSheets(pid) {
      const data = check(await sb.from('sheets').select('id, project_id, name, updated_at').eq('project_id', pid).order('name'));
      return (data as any[]).map((r): SheetMeta => ({ id: r.id, projectId: r.project_id, name: r.name, updatedAt: r.updated_at }));
    },
    async getSheet(id) {
      const r: any = check(await sb.from('sheets').select('*').eq('id', id).single(), 'Ficha');
      return {
        id: r.id, projectId: r.project_id, name: r.name, updatedAt: r.updated_at, version: r.version,
        scene: normalizeScene(r.scene), play: r.play ?? { vars: {}, nodes: {} },
      };
    },
    async createSheet(pid, name) {
      const r: any = check(await sb.from('sheets').insert({ project_id: pid, name, scene: emptyScene(), play: { vars: {}, nodes: {} } }).select().single());
      return { id: r.id, projectId: pid, name: r.name, updatedAt: r.updated_at, version: r.version, scene: normalizeScene(r.scene), play: r.play };
    },
    async saveSheet(sheet) {
      // controle otimista: só grava se a versão no servidor ainda for a que carregamos
      const res = await sb.from('sheets')
        .update({ name: sheet.name, scene: sheet.scene, play: sheet.play, version: sheet.version + 1, updated_at: new Date().toISOString() })
        .eq('id', sheet.id).eq('version', sheet.version)
        .select('id, version, updated_at');
      const rows = check(res) as any[];
      if (!rows.length) throw new ConflictError();
      return { ...sheet, version: rows[0].version, updatedAt: rows[0].updated_at };
    },
    async renameSheet(id, name) {
      check(await sb.from('sheets').update({ name, updated_at: new Date().toISOString() }).eq('id', id));
    },
    async deleteSheet(id) {
      check(await sb.from('sheets').delete().eq('id', id));
    },

    async listVariables(pid) {
      const data = check(await sb.from('variables').select('*').eq('project_id', pid).order('position'));
      return (data as any[]).map((r): Variable => ({
        id: r.id, name: r.name, type: r.type, initial: r.initial, formula: r.formula ?? '',
        group: r.group_name ?? '', description: r.description ?? '',
      }));
    },
    async saveVariables(pid, vars) {
      const rows = vars.map((v, i) => ({
        id: v.id, project_id: pid, name: v.name, type: v.type, initial: v.initial as any,
        formula: v.formula, group_name: v.group, description: v.description, position: i,
      }));
      if (rows.length) check(await sb.from('variables').upsert(rows));
      const keep = vars.map((v) => v.id);
      const existing = check(await sb.from('variables').select('id').eq('project_id', pid)) as { id: string }[];
      const gone = existing.map((e) => e.id).filter((id) => !keep.includes(id));
      if (gone.length) check(await sb.from('variables').delete().in('id', gone));
    },

    async listCharacters(pid) {
      const data = check(await sb.from('characters').select('id, project_id, sheet_id, name, updated_at').eq('project_id', pid).order('name'));
      return (data as any[]).map((r): CharacterMeta => ({ id: r.id, projectId: r.project_id, sheetId: r.sheet_id, name: r.name, updatedAt: r.updated_at }));
    },
    async getCharacter(id) {
      const r: any = check(await sb.from('characters').select('*').eq('id', id).single(), 'Personagem');
      return { id: r.id, projectId: r.project_id, sheetId: r.sheet_id, name: r.name, updatedAt: r.updated_at, version: r.version, play: r.play ?? { vars: {}, nodes: {} } } satisfies Character;
    },
    async createCharacter(pid, sheetId, name) {
      const r: any = check(await sb.from('characters').insert({ project_id: pid, sheet_id: sheetId, name, play: { vars: {}, nodes: {} } }).select().single());
      return { id: r.id, projectId: pid, sheetId, name: r.name, updatedAt: r.updated_at, version: r.version, play: r.play };
    },
    async saveCharacter(c) {
      const res = await sb.from('characters')
        .update({ name: c.name, play: c.play, version: c.version + 1, updated_at: new Date().toISOString() })
        .eq('id', c.id).eq('version', c.version).select('id, version, updated_at');
      const rows = check(res) as any[];
      if (!rows.length) throw new ConflictError();
      return { ...c, version: rows[0].version, updatedAt: rows[0].updated_at };
    },
    async renameCharacter(id, name) { check(await sb.from('characters').update({ name }).eq('id', id)); },
    async deleteCharacter(id) { check(await sb.from('characters').delete().eq('id', id)); },

    async exportTemplate(pid, sheetId) {
      const project = await this.getProject(pid);
      const sheet = await this.getSheet(sheetId);
      return {
        format: 'gerenciador-rpg/modelo', version: 1, exportedAt: new Date().toISOString(),
        project: { id: project.id, name: project.name, description: project.description, coverUrl: project.coverUrl },
        variables: await this.listVariables(pid),
        sheets: [{ id: sheet.id, name: sheet.name, scene: sheet.scene }],
      };
    },
    async importTemplate() { throw new BundleError('Importar arquivos ainda não está disponível no modo com login. Use o modo local (sem Supabase configurado).'); },
    async exportCharacter(id) {
      const c = await this.getCharacter(id);
      const sheet = await this.getSheet(c.sheetId);
      return { format: 'gerenciador-rpg/personagem', version: 1, exportedAt: new Date().toISOString(), projectId: c.projectId, sheetId: c.sheetId, templateName: sheet.name, character: { id: c.id, name: c.name, play: c.play } };
    },
    async importCharacter() { throw new BundleError('Importar arquivos ainda não está disponível no modo com login. Use o modo local (sem Supabase configurado).'); },

    async listLibraryTypes(pid) {
      const data = check(await sb.from('library_types').select('*').eq('project_id', pid).order('position'));
      return (data as any[]).map((r): LibraryType => ({ id: r.id, projectId: pid, name: r.name, icon: r.icon ?? 'book', fields: r.fields ?? [], position: r.position }));
    },
    async saveLibraryTypes(pid, types) {
      const rows = types.map((t, i) => ({ id: t.id, project_id: pid, name: t.name, icon: t.icon, fields: t.fields as any, position: i }));
      if (rows.length) check(await sb.from('library_types').upsert(rows));
      const existing = check(await sb.from('library_types').select('id').eq('project_id', pid)) as { id: string }[];
      const keep = new Set(types.map((t) => t.id));
      const gone = existing.map((e) => e.id).filter((id) => !keep.has(id));
      if (gone.length) check(await sb.from('library_types').delete().in('id', gone)); // registros caem por ON DELETE CASCADE
    },
    async listLibraryRecords(pid) {
      const data = check(await sb.from('library_records').select('*').eq('project_id', pid));
      return (data as any[]).map((r): LibraryRecord => ({ id: r.id, projectId: pid, typeId: r.type_id, name: r.name, data: r.data ?? {}, updatedAt: r.updated_at }));
    },
    async saveLibraryRecord(rec) {
      check(await sb.from('library_records').upsert({ id: rec.id, project_id: rec.projectId, type_id: rec.typeId, name: rec.name, data: rec.data as any, updated_at: new Date().toISOString() }));
    },
    async deleteLibraryRecord(id) {
      check(await sb.from('library_records').delete().eq('id', id));
    },
  };
}
