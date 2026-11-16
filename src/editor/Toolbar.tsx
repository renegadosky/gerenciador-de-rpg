import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { CommitInput, SaveBadge } from '../components/ui';
import { useEditor } from '../stores/editor';

export function Toolbar({ projectId }: { projectId: string }) {
  const sheet = useEditor((s) => s.sheet);
  const mode = useEditor((s) => s.mode);
  const tool = useEditor((s) => s.tool);
  const status = useEditor((s) => s.status);
  const saveError = useEditor((s) => s.saveError);
  const settings = useEditor((s) => s.settings);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasSel = useEditor((s) => s.selection.length > 0);
  const hasClip = useEditor((s) => !!s.clipboard);
  const multi = useEditor((s) => s.selection.length > 1);
  const hasGroup = useEditor((s) => s.selection.some((id) => s.scene.nodes[id]?.type === 'group'));
  const st = useEditor.getState;
  const edit = mode === 'edit';

  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-g-700 bg-g-850 px-2">
      <Link to={`/p/${projectId}/sheets`} className="icon-btn" title="Voltar ao projeto" onClick={() => void st().flush()}><Icon name="back" /></Link>
      <CommitInput
        className="w-44 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold hover:border-g-700 focus:border-accent focus:outline-none"
        value={sheet?.name ?? ''} onCommit={(v) => st().rename(v)} aria-label="Nome da ficha"
      />
      <span className="mx-1 h-5 w-px bg-g-700" />

      <button className="icon-btn" disabled={!edit} data-active={tool === 'select'} title="Selecionar (V)" onClick={() => st().setTool('select')}><Icon name="mouse-pointer" /></button>
      <button className="icon-btn" data-active={tool === 'hand'} title="Mover a tela (H ou Espaço)" onClick={() => st().setTool('hand')}><Icon name="hand" /></button>
      <span className="mx-1 h-5 w-px bg-g-700" />
      <button className="icon-btn" disabled={!edit || !canUndo} title="Desfazer (Ctrl+Z)" onClick={() => st().undo()}><Icon name="undo" /></button>
      <button className="icon-btn" disabled={!edit || !canRedo} title="Refazer (Ctrl+Shift+Z)" onClick={() => st().redo()}><Icon name="redo" /></button>
      <span className="mx-1 h-5 w-px bg-g-700" />
      <button className="icon-btn" disabled={!edit || !hasSel} title="Copiar (Ctrl+C)" onClick={() => st().copySelection()}><Icon name="copy" /></button>
      <button className="icon-btn" disabled={!edit || !hasClip} title="Colar (Ctrl+V)" onClick={() => st().paste()}><Icon name="paste" /></button>
      <button className="icon-btn" disabled={!edit || !multi} title="Agrupar (Ctrl+G)" onClick={() => st().groupSelection()}><Icon name="group" /></button>
      <button className="icon-btn" disabled={!edit || !hasGroup} title="Desagrupar (Ctrl+Shift+G)" onClick={() => st().ungroupSelection()}><Icon name="ungroup" /></button>
      <span className="mx-1 h-5 w-px bg-g-700" />
      <button className="icon-btn" disabled={!edit} data-active={settings.grid} title="Grade (Ctrl+')" onClick={() => st().setSettings({ grid: !settings.grid })}><Icon name="grid" /></button>
      <button className="icon-btn" disabled={!edit} data-active={settings.snap} title="Encaixe e guias" onClick={() => st().setSettings({ snap: !settings.snap })}><Icon name="magnet" /></button>
      <button className="icon-btn" disabled={!edit} data-active={settings.rulers} title="Réguas" onClick={() => st().setSettings({ rulers: !settings.rulers })}><Icon name="ruler" /></button>

      <div className="flex-1" />
      <SaveBadge status={status} error={saveError} />
      <ThemeSwitcher />
      <div className="ml-3 flex rounded-lg border border-g-700 p-0.5">
        <button className={`btn btn-ghost !py-1 ${edit ? '!bg-g-700' : ''}`} onClick={() => st().setMode('edit')}><Icon name="pencil" size={13} /> Editar</button>
        <button className={`btn btn-ghost !py-1 ${!edit ? '!bg-accent-strong !text-[rgb(var(--on-accent))]' : ''}`} title="Testar o modelo como um jogador veria (dados de teste, não são de nenhum personagem)" onClick={() => st().setMode('play')}><Icon name="play" size={13} /> Testar</button>
      </div>
    </header>
  );
}
