import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepo } from '../components/AuthProvider';
import { Icon } from '../components/Icon';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { CommitInput, ErrorState, FullCenter, SaveBadge, Spinner, useBeforeUnload } from '../components/ui';
import { EditorCanvas } from '../editor/EditorCanvas';
import { PlayPanel } from '../editor/PlayPanel';
import { useEditorShortcuts } from '../editor/shortcuts';
import { downloadJson, safeFileName } from '../lib/files';
import { useEditor } from '../stores/editor';
import { errMsg, toast } from '../stores/toast';

/** Tela do jogador: o modelo em modo de preenchimento, sem nenhuma ferramenta de edição. */
export default function PlayPage() {
  const { projectId = '', characterId = '' } = useParams();
  const repo = useRepo();
  const loading = useEditor((s) => s.loading);
  const loadError = useEditor((s) => s.loadError);
  const character = useEditor((s) => s.character);
  const status = useEditor((s) => s.status);
  const saveError = useEditor((s) => s.saveError);
  useEditorShortcuts();
  useBeforeUnload(status === 'dirty' || status === 'saving' || status === 'error' || status === 'conflict');

  useEffect(() => {
    void useEditor.getState().loadCharacter(repo, characterId);
    return () => { void useEditor.getState().unload(); };
  }, [repo, characterId]);

  if (loadError) return <ErrorState title="Não foi possível abrir o personagem" message={loadError} action={<Link className="btn" to={`/p/${projectId}/characters`}>Voltar</Link>} />;
  if (loading || !character) return <FullCenter><Spinner size={22} /></FullCenter>;

  const exportIt = async () => {
    try {
      await useEditor.getState().flush();
      downloadJson(`personagem-${safeFileName(character.name)}.rpg.json`, await repo.exportCharacter(character.id));
      toast.success('Arquivo baixado. Envie ao seu mestre para ele ver sua ficha.');
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <header className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-g-700 bg-g-850 px-2">
        <Link to={`/p/${projectId}/characters`} className="icon-btn" title="Voltar" onClick={() => void useEditor.getState().flush()}><Icon name="back" /></Link>
        <Icon name="smile" className="text-accent" size={16} />
        <CommitInput className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-base font-bold hover:border-g-700 focus:border-accent focus:outline-none"
          value={character.name} onCommit={(v) => useEditor.getState().rename(v)} aria-label="Nome do personagem" />
        <div className="flex-1" />
        <SaveBadge status={status} error={saveError} />
        <ThemeSwitcher />
        {status === 'conflict' && <button className="btn" onClick={() => location.reload()}>Recarregar</button>}
        <button className="btn" onClick={() => void exportIt()} title="Baixar um arquivo para enviar ao mestre"><Icon name="upload" size={14} className="rotate-180" /> Exportar</button>
      </header>
      <div className="flex min-h-0 flex-1 gap-2">
        <main className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-g-700"><EditorCanvas /></main>
        <PlayPanel projectId={projectId} player />
      </div>
    </div>
  );
}
