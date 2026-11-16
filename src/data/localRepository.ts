import { uid } from '../lib/ids';
import { emptyScene, normalizeScene } from '../editor/sceneOps';
import type { LibraryRecord, LibraryType, Character, CharacterBundle, CharacterMeta, Project, ProjectInput, Sheet, SheetMeta, TemplateBundle, Variable } from '../types';
import { kv } from './kv';
import { BundleError, ConflictError, NotFoundError, Repository } from './repository';

const now = () => new Date().toISOString();

/**
 * Persistência 100% no navegador (IndexedDB). Serve para desenvolver sem backend,
 * para uso offline e como modo "convidado". Os dados ficam isolados por `userKey`.
 */
export function createLocalRepository(userKey = 'local'): Repository {
  const K = {
    projects: `${userKey}:projects`,
    vars: (pid: string) => `${userKey}:vars:${pid}`,
    sheetIndex: (pid: string) => `${userKey}:sheets:${pid}`,
    sheet: (id: string) => `${userKey}:sheet:${id}`,
    charIndex: (pid: string) => `${userKey}:chars:${pid}`,
    char: (id: string) => `${userKey}:char:${id}`,
    libTypes: (pid: string) => `${userKey}:libtypes:${pid}`,
    libRecs: (pid: string) => `${userKey}:librecs:${pid}`,
  };

  const readProjects = async () => (await kv.get<Project[]>(K.projects)) ?? [];

  return {
    kind: 'local',

    async listProjects() {
      return (await readProjects()).map((p) => ({ ...p, kind: p.kind ?? 'own' })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async getProject(id) {
      const p = (await readProjects()).find((x) => x.id === id);
      if (!p) throw new NotFoundError('Projeto');
      return { ...p, kind: p.kind ?? 'own' };
    },
    async createProject(input: ProjectInput) {
      const p: Project = { id: uid(), ...input, kind: 'own', createdAt: now(), updatedAt: now() };
      await kv.set(K.projects, [...(await readProjects()), p]);
      return p;
    },
    async updateProject(id, patch) {
      const all = await readProjects();
      const i = all.findIndex((x) => x.id === id);
      if (i < 0) throw new NotFoundError('Projeto');
      all[i] = { ...all[i], ...patch, updatedAt: now() };
      await kv.set(K.projects, all);
      return all[i];
    },
    async deleteProject(id) {
      const metas = (await kv.get<SheetMeta[]>(K.sheetIndex(id))) ?? [];
      await Promise.all(metas.map((m) => kv.del(K.sheet(m.id))));
      const chars = (await kv.get<CharacterMeta[]>(K.charIndex(id))) ?? [];
      await Promise.all(chars.map((c) => kv.del(K.char(c.id))));
      await kv.del(K.charIndex(id));
      await kv.del(K.sheetIndex(id));
      await kv.del(K.vars(id));
      await kv.del(K.libTypes(id));
      await kv.del(K.libRecs(id));
      await kv.set(K.projects, (await readProjects()).filter((p) => p.id !== id));
    },

    async listSheets(pid) {
      return ((await kv.get<SheetMeta[]>(K.sheetIndex(pid))) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    },
    async getSheet(id) {
      const s = await kv.get<Sheet>(K.sheet(id));
      if (!s) throw new NotFoundError('Ficha');
      return { ...s, scene: normalizeScene(s.scene), play: s.play ?? { vars: {}, nodes: {} } };
    },
    async createSheet(pid, name) {
      const sheet: Sheet = {
        id: uid(), projectId: pid, name, updatedAt: now(), version: 1,
        scene: emptyScene(), play: { vars: {}, nodes: {} },
      };
      await kv.set(K.sheet(sheet.id), sheet);
      const idx = (await kv.get<SheetMeta[]>(K.sheetIndex(pid))) ?? [];
      await kv.set(K.sheetIndex(pid), [...idx, { id: sheet.id, projectId: pid, name, updatedAt: sheet.updatedAt }]);
      return sheet;
    },
    async saveSheet(sheet) {
      const cur = await kv.get<Sheet>(K.sheet(sheet.id));
      if (!cur) throw new NotFoundError('Ficha');
      if (cur.version !== sheet.version) throw new ConflictError();
      const saved: Sheet = { ...sheet, version: cur.version + 1, updatedAt: now() };
      await kv.set(K.sheet(sheet.id), saved);
      const idx = (await kv.get<SheetMeta[]>(K.sheetIndex(sheet.projectId))) ?? [];
      await kv.set(K.sheetIndex(sheet.projectId), idx.map((m) => (m.id === sheet.id ? { ...m, name: saved.name, updatedAt: saved.updatedAt } : m)));
      return saved;
    },
    async renameSheet(id, name) {
      const cur = await kv.get<Sheet>(K.sheet(id));
      if (!cur) throw new NotFoundError('Ficha');
      await kv.set(K.sheet(id), { ...cur, name, updatedAt: now() });
      const idx = (await kv.get<SheetMeta[]>(K.sheetIndex(cur.projectId))) ?? [];
      await kv.set(K.sheetIndex(cur.projectId), idx.map((m) => (m.id === id ? { ...m, name, updatedAt: now() } : m)));
    },
    async deleteSheet(id) {
      const cur = await kv.get<Sheet>(K.sheet(id));
      if (!cur) return;
      await kv.del(K.sheet(id));
      const idx = (await kv.get<SheetMeta[]>(K.sheetIndex(cur.projectId))) ?? [];
      await kv.set(K.sheetIndex(cur.projectId), idx.filter((m) => m.id !== id));
    },

    async listVariables(pid) {
      return (await kv.get<Variable[]>(K.vars(pid))) ?? [];
    },
    async saveVariables(pid, vars) {
      await kv.set(K.vars(pid), vars);
    },

    /* ───── personagens ───── */
    async listCharacters(pid) {
      return ((await kv.get<CharacterMeta[]>(K.charIndex(pid))) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    },
    async getCharacter(id) {
      const c = await kv.get<Character>(K.char(id));
      if (!c) throw new NotFoundError('Personagem');
      return { ...c, play: c.play ?? { vars: {}, nodes: {} } };
    },
    async createCharacter(pid, sheetId, name) {
      const sheet = await kv.get<Sheet>(K.sheet(sheetId));
      if (!sheet || sheet.projectId !== pid) throw new NotFoundError('Modelo de ficha');
      const c: Character = { id: uid(), projectId: pid, sheetId, name, updatedAt: now(), version: 1, play: { vars: {}, nodes: {} } };
      await kv.set(K.char(c.id), c);
      const idx = (await kv.get<CharacterMeta[]>(K.charIndex(pid))) ?? [];
      await kv.set(K.charIndex(pid), [...idx, { id: c.id, projectId: pid, sheetId, name, updatedAt: c.updatedAt }]);
      return c;
    },
    async saveCharacter(c) {
      const cur = await kv.get<Character>(K.char(c.id));
      if (!cur) throw new NotFoundError('Personagem');
      if (cur.version !== c.version) throw new ConflictError();
      const saved: Character = { ...c, version: cur.version + 1, updatedAt: now() };
      await kv.set(K.char(c.id), saved);
      const idx = (await kv.get<CharacterMeta[]>(K.charIndex(c.projectId))) ?? [];
      await kv.set(K.charIndex(c.projectId), idx.map((m) => (m.id === c.id ? { ...m, name: saved.name, updatedAt: saved.updatedAt } : m)));
      return saved;
    },
    async renameCharacter(id, name) {
      const cur = await kv.get<Character>(K.char(id));
      if (!cur) throw new NotFoundError('Personagem');
      await kv.set(K.char(id), { ...cur, name, updatedAt: now() });
      const idx = (await kv.get<CharacterMeta[]>(K.charIndex(cur.projectId))) ?? [];
      await kv.set(K.charIndex(cur.projectId), idx.map((m) => (m.id === id ? { ...m, name } : m)));
    },
    async deleteCharacter(id) {
      const cur = await kv.get<Character>(K.char(id));
      if (!cur) return;
      await kv.del(K.char(id));
      const idx = (await kv.get<CharacterMeta[]>(K.charIndex(cur.projectId))) ?? [];
      await kv.set(K.charIndex(cur.projectId), idx.filter((m) => m.id !== id));
    },

    /* ───── compartilhamento por arquivo ───── */
    async exportTemplate(pid, sheetId) {
      const project = await this.getProject(pid);
      const sheet = await this.getSheet(sheetId);
      if (sheet.projectId !== pid) throw new NotFoundError('Modelo de ficha');
      return {
        format: 'gerenciador-rpg/modelo', version: 1, exportedAt: now(),
        project: { id: project.id, name: project.name, description: project.description, coverUrl: project.coverUrl },
        variables: await this.listVariables(pid),
        sheets: [{ id: sheet.id, name: sheet.name, scene: sheet.scene }],
      };
    },
    async importTemplate(bundle) {
      const existing = (await readProjects()).find((p) => p.id === bundle.project.id);
      if (existing && (existing.kind ?? 'own') === 'own') {
        throw new BundleError('Este modelo foi criado nesta conta (você é o autor). Abra o projeto original em vez de importar.');
      }
      const t = now();
      const project: Project = {
        id: bundle.project.id, name: bundle.project.name, description: bundle.project.description ?? '',
        coverUrl: bundle.project.coverUrl ?? null, kind: 'imported', createdAt: existing?.createdAt ?? t, updatedAt: t,
      };
      const all = await readProjects();
      await kv.set(K.projects, existing ? all.map((p) => (p.id === project.id ? project : p)) : [...all, project]);
      // variáveis e fichas mantêm os mesmos ids: personagens já criados continuam valendo após uma atualização do modelo
      await kv.set(K.vars(project.id), bundle.variables);
      const index = (await kv.get<SheetMeta[]>(K.sheetIndex(project.id))) ?? [];
      for (const s of bundle.sheets) {
        const cur = await kv.get<Sheet>(K.sheet(s.id));
        const sheet: Sheet = { id: s.id, projectId: project.id, name: s.name, updatedAt: t, version: (cur?.version ?? 0) + 1, scene: normalizeScene(s.scene), play: cur?.play ?? { vars: {}, nodes: {} } };
        await kv.set(K.sheet(s.id), sheet);
        const meta: SheetMeta = { id: s.id, projectId: project.id, name: s.name, updatedAt: t };
        const at = index.findIndex((m) => m.id === s.id);
        if (at >= 0) index[at] = meta; else index.push(meta);
      }
      await kv.set(K.sheetIndex(project.id), index);
      return project;
    },
    async exportCharacter(id) {
      const c = await this.getCharacter(id);
      const sheet = await this.getSheet(c.sheetId);
      return {
        format: 'gerenciador-rpg/personagem', version: 1, exportedAt: now(),
        projectId: c.projectId, sheetId: c.sheetId, templateName: sheet.name,
        character: { id: c.id, name: c.name, play: c.play },
      };
    },
    async importCharacter(bundle) {
      const sheet = await kv.get<Sheet>(K.sheet(bundle.sheetId));
      if (!sheet || sheet.projectId !== bundle.projectId) {
        throw new BundleError('O modelo deste personagem não existe aqui. Importe primeiro o modelo de ficha do mestre.');
      }
      const cur = await kv.get<Character>(K.char(bundle.character.id));
      const t = now();
      const c: Character = {
        id: bundle.character.id, projectId: bundle.projectId, sheetId: bundle.sheetId, name: bundle.character.name || 'Personagem',
        updatedAt: t, version: (cur?.version ?? 0) + 1, play: bundle.character.play ?? { vars: {}, nodes: {} },
      };
      await kv.set(K.char(c.id), c);
      const idx = (await kv.get<CharacterMeta[]>(K.charIndex(c.projectId))) ?? [];
      const meta: CharacterMeta = { id: c.id, projectId: c.projectId, sheetId: c.sheetId, name: c.name, updatedAt: t };
      await kv.set(K.charIndex(c.projectId), idx.some((m) => m.id === c.id) ? idx.map((m) => (m.id === c.id ? meta : m)) : [...idx, meta]);
      return c;
    },

    async listLibraryTypes(pid) {
      return ((await kv.get<LibraryType[]>(K.libTypes(pid))) ?? []).sort((a, b) => a.position - b.position);
    },
    async saveLibraryTypes(pid, types) {
      const ids = new Set(types.map((t) => t.id));
      await kv.set(K.libTypes(pid), types.map((t, i) => ({ ...t, projectId: pid, position: i })));
      const recs = (await kv.get<LibraryRecord[]>(K.libRecs(pid))) ?? [];
      const kept = recs.filter((r) => ids.has(r.typeId)); // apagar um tipo apaga seus registros
      if (kept.length !== recs.length) await kv.set(K.libRecs(pid), kept);
    },
    async listLibraryRecords(pid) {
      return (await kv.get<LibraryRecord[]>(K.libRecs(pid))) ?? [];
    },
    async saveLibraryRecord(rec) {
      const all = (await kv.get<LibraryRecord[]>(K.libRecs(rec.projectId))) ?? [];
      const next = { ...rec, updatedAt: now() };
      await kv.set(K.libRecs(rec.projectId), all.some((r) => r.id === rec.id) ? all.map((r) => (r.id === rec.id ? next : r)) : [...all, next]);
    },
    async deleteLibraryRecord(id) {
      // não sabemos o projeto só pelo id: procura nos projetos conhecidos
      for (const p of await readProjects()) {
        const all = (await kv.get<LibraryRecord[]>(K.libRecs(p.id))) ?? [];
        if (all.some((r) => r.id === id)) { await kv.set(K.libRecs(p.id), all.filter((r) => r.id !== id)); return; }
      }
    },
  };
}
