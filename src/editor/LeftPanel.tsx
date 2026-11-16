import { useState } from 'react';
import { Icon } from '../components/Icon';
import { CommitInput } from '../components/ui';
import { useEditor } from '../stores/editor';
import { ELEMENTS } from './defaults';
import * as ops from './sceneOps';

const TYPE_ICON: Record<string, string> = Object.fromEntries([...ELEMENTS.map((e) => [e.type, e.icon]), ['group', 'group']]);

export function LeftPanel() {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-g-700 bg-g-850">
      <Palette />
      <Layers />
    </aside>
  );
}

function Palette() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  return (
    <div className="border-b border-g-700 pb-2">
      <div className="section-title">Elementos</div>
      <div className="grid grid-cols-3 gap-1 px-2">
        {ELEMENTS.map((e) => (
          <button
            key={e.type} data-active={tool === e.type}
            title={`${e.label}${e.shortcut ? ` (${e.shortcut})` : ''} — clique ou arraste na área de trabalho`}
            onClick={() => setTool(tool === e.type ? 'select' : e.type)}
            className="flex h-[52px] flex-col items-center justify-center gap-1 rounded-md border border-transparent text-g-300 hover:bg-g-750 hover:text-g-100 data-[active=true]:border-accent/60 data-[active=true]:bg-accent-soft data-[active=true]:text-accent"
          >
            <Icon name={e.icon} size={17} />
            <span className="max-w-full truncate px-0.5 text-2xs">{e.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Layers() {
  const scene = useEditor((s) => s.scene);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const commit = useEditor((s) => s.commit);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const row = (id: string, depth: number): React.ReactNode => {
    const n = scene.nodes[id];
    if (!n) return null;
    const isGroup = n.type === 'group';
    const sel = selection.includes(id);
    const kids = isGroup ? [...(n.children ?? [])].reverse() : [];
    return (
      <div key={id}>
        <div
          draggable={renaming !== id}
          onDragStart={(e) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
          onDragEnd={() => { setDragId(null); setDrop(null); }}
          onDragOver={(e) => {
            if (!dragId || dragId === id) return;
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            setDrop({ id, after: e.clientY < r.top + r.height / 2 }); // lista invertida: metade de cima = acima = depois no array
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && drop) commit((s) => ops.moveBefore(s, dragId, drop.id, drop.after));
            setDragId(null); setDrop(null);
          }}
          onClick={(e) => {
            if (e.shiftKey || e.metaKey || e.ctrlKey) useEditor.getState().toggleSelect(id); else select([id]);
          }}
          onDoubleClick={() => setRenaming(id)}
          className={`group relative flex h-7 cursor-default items-center gap-1 pr-1 text-sm ${sel ? 'bg-accent-soft text-g-100' : 'text-g-300 hover:bg-g-800'} ${n.hidden ? 'opacity-50' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          {drop?.id === id && <div className={`pointer-events-none absolute left-0 right-0 h-0.5 bg-accent ${drop.after ? 'top-0' : 'bottom-0'}`} />}
          {isGroup ? (
            <button className="icon-btn !h-5 !w-5" onClick={(e) => { e.stopPropagation(); setCollapsed({ ...collapsed, [id]: !collapsed[id] }); }} aria-label="Expandir grupo">
              <Icon name={collapsed[id] ? 'right' : 'down'} size={12} />
            </button>
          ) : <span className="w-5" />}
          <Icon name={TYPE_ICON[n.type] ?? 'square'} size={13} className="shrink-0 text-g-400" />
          {renaming === id ? (
            <CommitInput
              autoFocus className="field !h-5 !py-0" value={n.name}
              onCommit={(v) => { if (v.trim()) commit((s) => ops.updateNode(s, id, { name: v.trim() })); setRenaming(null); }}
              onBlur={() => setRenaming(null)}
            />
          ) : <span className="min-w-0 flex-1 truncate">{n.name}</span>}
          <button className={`icon-btn !h-5 !w-5 ${n.locked ? '' : 'opacity-0 group-hover:opacity-100'}`} title={n.locked ? 'Destravar' : 'Travar'}
            onClick={(e) => { e.stopPropagation(); commit((s) => ops.setFlag(s, [id], 'locked', !n.locked)); }}>
            <Icon name={n.locked ? 'lock' : 'unlock'} size={12} />
          </button>
          <button className={`icon-btn !h-5 !w-5 ${n.hidden ? '' : 'opacity-0 group-hover:opacity-100'}`} title={n.hidden ? 'Mostrar' : 'Ocultar'}
            onClick={(e) => { e.stopPropagation(); commit((s) => ops.setFlag(s, [id], 'hidden', !n.hidden)); }}>
            <Icon name={n.hidden ? 'eye-off' : 'eye'} size={12} />
          </button>
        </div>
        {isGroup && !collapsed[id] && kids.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="section-title">Camadas</div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2" onClick={(e) => { if (e.target === e.currentTarget) select([]); }}>
        {scene.order.length === 0 && <p className="px-3 py-2 text-xs text-g-500">A área de trabalho está vazia. Escolha um elemento acima e clique ou arraste na tela.</p>}
        {[...scene.order].reverse().map((id) => row(id, 0))}
      </div>
    </div>
  );
}
