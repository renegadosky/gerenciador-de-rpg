import { create } from 'zustand';
import type { Repository } from '../data';
import { Autosaver, SaveStatus } from '../lib/autosave';
import { uid } from '../lib/ids';
import type { Variable } from '../types';

interface RulesState {
  projectId: string | null;
  variables: Variable[];
  loading: boolean;
  loadError: string | null;
  status: SaveStatus;
  saveError: string | null;
  load: (repo: Repository, projectId: string) => Promise<void>;
  update: (fn: (v: Variable[]) => Variable[]) => void;
  addVariable: (partial?: Partial<Variable>) => Variable;
  flush: () => Promise<void>;
  reset: () => void;
}

let saver: Autosaver | null = null;

export const newVariable = (partial: Partial<Variable> = {}): Variable => ({
  id: uid(), name: '', type: 'number', initial: 0, formula: '', group: '', description: '', ...partial,
});

export const useRules = create<RulesState>((set, get) => ({
  projectId: null, variables: [], loading: false, loadError: null, status: 'idle', saveError: null,

  async load(repo, projectId) {
    saver?.dispose();
    set({ projectId, loading: true, loadError: null, variables: [], status: 'idle' });
    try {
      const variables = await repo.listVariables(projectId);
      if (get().projectId !== projectId) return; // usuário trocou de projeto durante o carregamento
      set({ variables, loading: false });
      saver = new Autosaver({
        delay: 600,
        save: async () => {
          const s = get();
          if (s.projectId) await repo.saveVariables(s.projectId, s.variables);
        },
        onStatus: (status, e) => set({ status, saveError: e?.message ?? null }),
      });
    } catch (e) {
      set({ loading: false, loadError: e instanceof Error ? e.message : String(e) });
    }
  },

  update(fn) {
    set({ variables: fn(get().variables) });
    saver?.touch();
  },

  addVariable(partial) {
    const v = newVariable(partial);
    get().update((vs) => [...vs, v]);
    return v;
  },

  async flush() { await saver?.flush(); },

  reset() {
    saver?.dispose();
    saver = null;
    set({ projectId: null, variables: [], status: 'idle', loading: false, loadError: null });
  },
}));
