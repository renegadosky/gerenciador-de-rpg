import { useEffect } from 'react';
import { useEditor } from '../stores/editor';
import { addImageFromFile } from './imageActions';
import { ELEMENTS } from './defaults';
import { runtime } from './runtime';
import { zoomAt } from './viewport';

const typing = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('input,textarea,select,[contenteditable=true]');

const TOOL_KEYS: Record<string, string> = Object.fromEntries(ELEMENTS.filter((e) => e.shortcut).map((e) => [e.shortcut!.toLowerCase(), e.type]));

export function useEditorShortcuts() {
  useEffect(() => {
    const zoomTo = (f: (z: number) => number) => {
      const st = useEditor.getState();
      st.setViewport(zoomAt(st.viewport, f(st.viewport.zoom), runtime.stage.w / 2, runtime.stage.h / 2));
    };
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); void st.flush(); return; }
      if (typing(e.target)) return;
      if (mod && k === '0') { e.preventDefault(); zoomTo(() => 1); return; }
      if (mod && k === '1') { e.preventDefault(); window.dispatchEvent(new Event('rpg:fit')); return; }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomTo((z) => z * 1.25); return; }
      if (mod && k === '-') { e.preventDefault(); zoomTo((z) => z / 1.25); return; }
      if (st.mode === 'play') return;
      if (mod) {
        if (k === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); }
        else if (k === 'y') { e.preventDefault(); st.redo(); }
        else if (k === 'c') { e.preventDefault(); st.copySelection(); }
        else if (k === 'x') { e.preventDefault(); st.cutSelection(); }
        else if (k === 'd') { e.preventDefault(); st.duplicateSelection(); }
        else if (k === 'a') { e.preventDefault(); st.selectAll(); }
        else if (k === 'g') { e.preventDefault(); e.shiftKey ? st.ungroupSelection() : st.groupSelection(); }
        else if (k === ']') { e.preventDefault(); st.reorderSelection(e.shiftKey ? 'front' : 'forward'); }
        else if (k === '[') { e.preventDefault(); st.reorderSelection(e.shiftKey ? 'back' : 'backward'); }
        else if (k === 'l' && e.shiftKey) { e.preventDefault(); const sel = st.selection; const all = sel.every((id) => st.scene.nodes[id]?.locked); st.setFlag(sel, 'locked', !all); }
        else if (k === 'h' && e.shiftKey) { e.preventDefault(); st.setFlag(st.selection, 'hidden', true); }
        else if (k === "'") { e.preventDefault(); st.setSettings({ grid: !st.settings.grid }); }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); st.deleteSelection(); return; }
      if (e.key === 'Escape') { st.select([]); st.setTool('select'); return; }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        st.nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
        return;
      }
      if (k === 'v') st.setTool('select');
      else if (k === 'h') st.setTool('hand');
      else if (TOOL_KEYS[k]) st.setTool(TOOL_KEYS[k] as never);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (typing(e.target)) return;
      const st = useEditor.getState();
      if (st.mode !== 'edit') return;
      const img = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (img) { e.preventDefault(); void addImageFromFile(img); return; }
      st.paste();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste); };
  }, []);
}
