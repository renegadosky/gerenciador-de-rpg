import { create } from 'zustand';
import type { Repository } from '../data';
import { createNode } from '../editor/defaults';
import type { Guide } from '../editor/geometry';
import * as ops from '../editor/sceneOps';
import { Autosaver, SaveStatus } from '../lib/autosave';
import type { NodeType, PlayState, Scene, SceneNode, Value } from '../types';

export interface RollEntry { id: number; label: string; text: string; total: number; ok: boolean; error?: string; at: number }
interface CharacterInfo { id: string; projectId: string; sheetId: string; name: string; version: number; updatedAt: string }

export type Tool = 'select' | 'hand' | Exclude<NodeType, 'group'>;
export type Mode = 'edit' | 'play';

export interface Viewport { zoom: number; x: number; y: number }
export interface EditorSettings { grid: boolean; snap: boolean; gridSize: number; rulers: boolean; guides: boolean }

interface SheetInfo { id: string; projectId: string; name: string; version: number; updatedAt: string }

interface EditorState {
  sheet: SheetInfo | null;
  /** quando preenchido, o modo é "jogador": layout travado, valores gravados no personagem */
  character: CharacterInfo | null;
  rolls: RollEntry[];
  scene: Scene;
  play: PlayState;
  loading: boolean;
  loadError: string | null;
  status: SaveStatus;
  saveError: string | null;

  selection: string[];
  mode: Mode;
  tool: Tool;
  viewport: Viewport;
  settings: EditorSettings;
  editingTextId: string | null;
  clipboard: ops.Clipboard | null;
  guides: Guide[];
  past: Scene[];
  future: Scene[];

  load: (repo: Repository, sheetId: string) => Promise<void>;
  loadCharacter: (repo: Repository, characterId: string) => Promise<void>;
  addRoll: (r: Omit<RollEntry, 'id' | 'at'>) => void;
  clearRolls: () => void;
  unload: () => Promise<void>;
  flush: () => Promise<void>;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setMode: (m: Mode) => void;
  setTool: (t: Tool) => void;
  setViewport: (v: Partial<Viewport>) => void;
  setSettings: (s: Partial<EditorSettings>) => void;
  setGuides: (g: Guide[]) => void;
  setEditingText: (id: string | null) => void;

  /** altera a cena registrando um passo no histórico (`key` junta edições seguidas do mesmo campo) */
  commit: (fn: (s: Scene) => Scene, key?: string) => void;
  beginGesture: () => void;
  liveUpdate: (fn: (s: Scene) => Scene) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  undo: () => void;
  redo: () => void;

  addElement: (type: Exclude<SceneNode['type'], 'group'>, at: { x: number; y: number }, size?: { w: number; h: number }) => string;
  addNodes: (nodes: SceneNode[]) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  paste: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  reorderSelection: (m: ops.OrderMove) => void;
  alignSelection: (m: ops.AlignMode) => void;
  distributeSelection: (axis: 'x' | 'y', gap?: number) => void;
  setFlag: (ids: string[], flag: 'locked' | 'hidden', value: boolean) => void;
  nudge: (dx: number, dy: number) => void;
  selectAll: () => void;

  setPlayVar: (varId: string, v: Value) => void;
  setPlayNode: (nodeId: string, v: unknown) => void;
  resetPlay: () => void;
  rename: (name: string) => void;
}

const HISTORY_LIMIT = 100;
let saver: Autosaver | null = null;
let gestureBase: Scene | null = null;
let lastKey: string | null = null;
let lastKeyAt = 0;

const emptyPlay = (): PlayState => ({ vars: {}, nodes: {} });

export const useEditor = create<EditorState>((set, get) => {
  const touch = () => saver?.touch();

  /** grava o personagem (modo jogador) ou o modelo, conforme o que está aberto */
  const makeSaver = (repo: Repository) => new Autosaver({
    delay: 800,
    save: async () => {
      const st = get();
      if (st.character) {
        const saved = await repo.saveCharacter({ ...st.character, play: st.play });
        set((cur) => ({ character: cur.character ? { ...cur.character, version: saved.version, updatedAt: saved.updatedAt } : null }));
      } else if (st.sheet) {
        const saved = await repo.saveSheet({ ...st.sheet, scene: st.scene, play: st.play });
        set((cur) => ({ sheet: cur.sheet ? { ...cur.sheet, version: saved.version, updatedAt: saved.updatedAt } : null }));
      }
    },
    onStatus: (status, e) => set({ status, saveError: e?.message ?? null }),
  });

  const pushHistory = (prev: Scene) => {
    const past = [...get().past, prev];
    set({ past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past, future: [] });
  };

  /** mantém a seleção apenas com ids que ainda existem */
  const pruneSelection = (scene: Scene, sel: string[]) => sel.filter((id) => scene.nodes[id]);

  return {
    sheet: null, character: null, rolls: [], scene: ops.emptyScene(), play: emptyPlay(),
    loading: false, loadError: null, status: 'idle', saveError: null,
    selection: [], mode: 'edit', tool: 'select',
    viewport: { zoom: 1, x: 80, y: 60 },
    settings: { grid: false, snap: true, gridSize: 8, rulers: true, guides: true },
    editingTextId: null, clipboard: null, guides: [], past: [], future: [],

    async load(repo, sheetId) {
      saver?.dispose();
      set({ loading: true, loadError: null, sheet: null, character: null, rolls: [], selection: [], past: [], future: [], status: 'idle', mode: 'edit', tool: 'select' });
      try {
        const s = await repo.getSheet(sheetId);
        set({
          loading: false, scene: s.scene, play: s.play,
          sheet: { id: s.id, projectId: s.projectId, name: s.name, version: s.version, updatedAt: s.updatedAt },
        });
        saver = makeSaver(repo);
      } catch (e) {
        set({ loading: false, loadError: e instanceof Error ? e.message : String(e) });
      }
    },
    async loadCharacter(repo, characterId) {
      saver?.dispose();
      set({ loading: true, loadError: null, sheet: null, character: null, selection: [], past: [], future: [], status: 'idle', mode: 'play', tool: 'select', rolls: [] });
      try {
        const c = await repo.getCharacter(characterId);
        const s = await repo.getSheet(c.sheetId);
        set({
          loading: false, scene: s.scene, play: c.play, mode: 'play',
          sheet: { id: s.id, projectId: s.projectId, name: s.name, version: s.version, updatedAt: s.updatedAt },
          character: { id: c.id, projectId: c.projectId, sheetId: c.sheetId, name: c.name, version: c.version, updatedAt: c.updatedAt },
        });
        saver = makeSaver(repo);
      } catch (e) {
        set({ loading: false, loadError: e instanceof Error ? e.message : String(e) });
      }
    },
    addRoll(r) {
      const id = (get().rolls[0]?.id ?? 0) + 1;
      set({ rolls: [{ ...r, id, at: Date.now() }, ...get().rolls].slice(0, 40) });
    },
    clearRolls() { set({ rolls: [] }); },
    async unload() {
      await saver?.flush().catch(() => {});
      saver?.dispose();
      saver = null;
      gestureBase = null;
      set({ sheet: null, character: null, rolls: [], scene: ops.emptyScene(), play: emptyPlay(), selection: [], past: [], future: [], status: 'idle' });
    },
    async flush() { await saver?.flush(); },

    select: (ids) => set({ selection: ids, editingTextId: null }),
    toggleSelect: (id) => {
      const sel = get().selection;
      set({ selection: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
    },
    setMode: (mode) => { if (get().character) return; set({ mode, selection: [], tool: 'select', editingTextId: null }); },
    setTool: (tool) => set({ tool, editingTextId: null }),
    setViewport: (v) => set({ viewport: { ...get().viewport, ...v } }),
    setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
    setGuides: (guides) => set({ guides }),
    setEditingText: (id) => set({ editingTextId: id }),

    commit(fn, key) {
      const prev = get().scene;
      const next = fn(prev);
      if (next === prev) return;
      const t = Date.now();
      if (!(key && key === lastKey && t - lastKeyAt < 900)) pushHistory(prev);
      lastKey = key ?? null;
      lastKeyAt = t;
      set({ scene: next, selection: pruneSelection(next, get().selection) });
      touch();
    },
    beginGesture() { gestureBase = get().scene; lastKey = null; },
    liveUpdate(fn) {
      // durante um gesto, `fn` recebe sempre a cena do início do gesto (evita acumular erro de arredondamento)
      const next = fn(gestureBase ?? get().scene);
      if (next !== get().scene) set({ scene: next });
    },
    endGesture() {
      const base = gestureBase;
      gestureBase = null;
      set({ guides: [] });
      if (base && base !== get().scene) { pushHistory(base); touch(); }
    },
    cancelGesture() {
      if (gestureBase) set({ scene: gestureBase, guides: [] });
      gestureBase = null;
    },
    undo() {
      const { past, future, scene } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      lastKey = null;
      set({ scene: prev, past: past.slice(0, -1), future: [scene, ...future], selection: pruneSelection(prev, get().selection) });
      touch();
    },
    redo() {
      const { past, future, scene } = get();
      if (!future.length) return;
      const [next, ...rest] = future;
      lastKey = null;
      set({ scene: next, past: [...past, scene], future: rest, selection: pruneSelection(next, get().selection) });
      touch();
    },

    addElement(type, at, size) {
      const node = createNode(type, at, size);
      get().commit((s) => ops.addNode(s, node));
      set({ selection: [node.id], tool: 'select' });
      return node.id;
    },
    addNodes(nodes) {
      get().commit((s) => nodes.reduce((acc, n) => ops.addNode(acc, n), s));
      set({ selection: nodes.map((n) => n.id) });
    },
    deleteSelection() {
      const { selection, scene } = get();
      const ids = selection.filter((id) => !ops.isEffectivelyLocked(scene, id));
      if (!ids.length) return;
      get().commit((s) => ops.removeNodes(s, ids));
      set({ selection: [] });
    },
    duplicateSelection() {
      const { selection, scene } = get();
      if (!selection.length) return;
      const r = ops.duplicateNodes(scene, ops.topLevelOnly(scene, selection));
      get().commit(() => r.scene);
      set({ selection: r.newIds });
    },
    copySelection() {
      const { selection, scene } = get();
      if (selection.length) set({ clipboard: ops.extractClipboard(scene, selection) });
    },
    cutSelection() { get().copySelection(); get().deleteSelection(); },
    paste() {
      const { clipboard, scene } = get();
      if (!clipboard) return;
      const r = ops.pasteClipboard(scene, clipboard);
      get().commit(() => r.scene);
      // cada colagem seguinte desloca mais um pouco
      set({ selection: r.newIds, clipboard: { ...clipboard, nodes: clipboard.nodes.map((n) => ({ ...n, x: n.x + 16, y: n.y + 16 })) } });
    },
    groupSelection() {
      const { selection, scene } = get();
      const r = ops.groupNodes(scene, selection);
      if (!r.groupId) return;
      get().commit(() => r.scene);
      set({ selection: [r.groupId] });
    },
    ungroupSelection() {
      const { selection, scene } = get();
      const groups = selection.filter((id) => scene.nodes[id]?.type === 'group');
      if (!groups.length) return;
      const r = ops.ungroup(scene, groups);
      get().commit(() => r.scene);
      set({ selection: r.freed });
    },
    reorderSelection(m) { const { selection } = get(); get().commit((s) => ops.reorder(s, selection, m)); },
    alignSelection(m) { const { selection } = get(); get().commit((s) => ops.alignNodes(s, selection, m)); },
    distributeSelection(axis, gap) { const { selection } = get(); get().commit((s) => ops.distributeNodes(s, selection, axis, gap)); },
    setFlag(ids, flag, value) { get().commit((s) => ops.setFlag(s, ids, flag, value)); },
    nudge(dx, dy) {
      const { selection, scene } = get();
      const ids = selection.filter((id) => !ops.isEffectivelyLocked(scene, id));
      if (ids.length) get().commit((s) => ops.moveNodes(s, ids, dx, dy), 'nudge');
    },
    selectAll() { set({ selection: get().scene.order.filter((id) => !get().scene.nodes[id].locked) }); },

    setPlayVar(varId, v) { set({ play: { ...get().play, vars: { ...get().play.vars, [varId]: v } } }); touch(); },
    setPlayNode(nodeId, v) { set({ play: { ...get().play, nodes: { ...get().play.nodes, [nodeId]: v } } }); touch(); },
    resetPlay() { set({ play: emptyPlay() }); touch(); },
    rename(name) {
      if (!name.trim()) return;
      const ch = get().character;
      if (ch) { set({ character: { ...ch, name: name.trim() } }); touch(); return; }
      const sh = get().sheet;
      if (!sh) return;
      set({ sheet: { ...sh, name: name.trim() } });
      touch();
    },
  };
});

export const selectedNodes = (s: Pick<EditorState, 'scene' | 'selection'>) =>
  s.selection.map((id) => s.scene.nodes[id]).filter(Boolean) as SceneNode[];
