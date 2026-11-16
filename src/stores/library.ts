import { create } from 'zustand';
import type { Repository } from '../data';
import { Autosaver, SaveStatus } from '../lib/autosave';
import { uid } from '../lib/ids';
import { markSeeded, seedLibraryTypes, wasSeeded } from '../lib/librarySeed';
import type { FieldDef, LibraryRecord, LibraryType } from '../types';
export { backlinks } from '../lib/libraryLinks';

interface LibState {
  projectId: string | null;
  types: LibraryType[];
  records: LibraryRecord[];
  loading: boolean;
  loadError: string | null;
  status: SaveStatus;
  saveError: string | null;

  load: (repo: Repository, projectId: string) => Promise<void>;
  updateTypes: (fn: (t: LibraryType[]) => LibraryType[]) => void;
  addType: (name: string) => LibraryType;
  patchType: (id: string, patch: Partial<LibraryType>) => void;
  removeType: (id: string) => void;
  addRecord: (typeId: string, name?: string) => LibraryRecord;
  patchRecord: (id: string, patch: Partial<LibraryRecord>) => void;
  setField: (recordId: string, fieldId: string, value: unknown) => void;
  removeRecord: (id: string) => void;
  flush: () => Promise<void>;
  reset: () => void;
}

let saver: Autosaver | null = null;
let typesDirty = false;
const dirty = new Set<string>();
const deleted = new Set<string>();

export const newField = (name = 'Novo campo', kind: FieldDef['kind'] = 'text'): FieldDef => ({ id: uid(), name, kind });

export const useLibrary = create<LibState>((set, get) => {
  const touch = () => saver?.touch();
  return {
    projectId: null, types: [], records: [], loading: false, loadError: null, status: 'idle', saveError: null,

    async load(repo, projectId) {
      saver?.dispose();
      typesDirty = false; dirty.clear(); deleted.clear();
      set({ projectId, loading: true, loadError: null, types: [], records: [], status: 'idle' });
      try {
        let [types, records] = await Promise.all([repo.listLibraryTypes(projectId), repo.listLibraryRecords(projectId)]);
        // primeira abertura: oferece as categorias iniciais (editáveis e removíveis). Só uma vez por projeto.
        let seeded = false;
        if (!types.length && !records.length && !wasSeeded(projectId)) {
          types = seedLibraryTypes(projectId);
          await repo.saveLibraryTypes(projectId, types);
          seeded = true;
        }
        if (seeded || types.length) markSeeded(projectId);
        if (get().projectId !== projectId) return;
        set({ types, records, loading: false });
        saver = new Autosaver({
          delay: 700,
          onStatus: (status, e) => set({ status, saveError: e?.message ?? null }),
          save: async () => {
            const pid = get().projectId;
            if (!pid) return;
            const doTypes = typesDirty, ids = [...dirty], gone = [...deleted];
            typesDirty = false; dirty.clear(); deleted.clear();
            try {
              if (doTypes) await repo.saveLibraryTypes(pid, get().types);
              for (const id of ids) { const r = get().records.find((x) => x.id === id); if (r) await repo.saveLibraryRecord(r); }
              for (const id of gone) await repo.deleteLibraryRecord(id);
            } catch (e) { // devolve à fila para a próxima tentativa
              typesDirty ||= doTypes; ids.forEach((i) => dirty.add(i)); gone.forEach((i) => deleted.add(i));
              throw e;
            }
          },
        });
      } catch (e) {
        set({ loading: false, loadError: e instanceof Error ? e.message : String(e) });
      }
    },

    updateTypes(fn) { set({ types: fn(get().types) }); typesDirty = true; touch(); },
    addType(name) {
      const t: LibraryType = { id: uid(), projectId: get().projectId ?? '', name, icon: 'book', fields: [newField('Descrição', 'longtext')], position: get().types.length };
      get().updateTypes((ts) => [...ts, t]);
      return t;
    },
    patchType(id, patch) { get().updateTypes((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))); },
    removeType(id) {
      const gone = get().records.filter((r) => r.typeId === id).map((r) => r.id);
      gone.forEach((g) => dirty.delete(g));
      set({ records: get().records.filter((r) => r.typeId !== id) });
      get().updateTypes((ts) => ts.filter((t) => t.id !== id)); // o repositório apaga os registros do tipo
    },

    addRecord(typeId, name = 'Novo registro') {
      const r: LibraryRecord = { id: uid(), projectId: get().projectId ?? '', typeId, name, data: {}, updatedAt: new Date().toISOString() };
      set({ records: [...get().records, r] });
      dirty.add(r.id); touch();
      return r;
    },
    patchRecord(id, patch) {
      set({ records: get().records.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
      dirty.add(id); touch();
    },
    setField(recordId, fieldId, value) {
      const r = get().records.find((x) => x.id === recordId);
      if (r) get().patchRecord(recordId, { data: { ...r.data, [fieldId]: value } });
    },
    removeRecord(id) {
      // tira vínculos que apontavam para ele
      const next = get().records.filter((r) => r.id !== id).map((r) => {
        let changed = false;
        const data = { ...r.data };
        for (const [k, v] of Object.entries(data)) if (Array.isArray(v) && v.includes(id)) { data[k] = v.filter((x) => x !== id); changed = true; }
        if (changed) dirty.add(r.id);
        return changed ? { ...r, data } : r;
      });
      set({ records: next });
      dirty.delete(id); deleted.add(id); touch();
    },

    async flush() { await saver?.flush(); },
    reset() { saver?.dispose(); saver = null; typesDirty = false; dirty.clear(); deleted.clear(); set({ projectId: null, types: [], records: [], status: 'idle', loading: false, loadError: null }); },
  };
});
