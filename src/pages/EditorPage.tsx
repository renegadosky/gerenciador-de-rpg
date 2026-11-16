import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepo } from '../components/AuthProvider';
import { ErrorState, FullCenter, Spinner, useBeforeUnload } from '../components/ui';
import { EditorCanvas } from '../editor/EditorCanvas';
import { LeftPanel } from '../editor/LeftPanel';
import { PlayPanel } from '../editor/PlayPanel';
import { PropertiesPanel } from '../editor/PropertiesPanel';
import { useEditorShortcuts } from '../editor/shortcuts';
import { Toolbar } from '../editor/Toolbar';
import { useEditor } from '../stores/editor';

export default function EditorPage() {
  const { projectId = '', sheetId = '' } = useParams();
  const repo = useRepo();
  const loading = useEditor((s) => s.loading);
  const loadError = useEditor((s) => s.loadError);
  const sheet = useEditor((s) => s.sheet);
  const mode = useEditor((s) => s.mode);
  const status = useEditor((s) => s.status);
  useEditorShortcuts();
  useBeforeUnload(status === 'dirty' || status === 'saving' || status === 'error' || status === 'conflict');

  useEffect(() => {
    void useEditor.getState().load(repo, sheetId);
    return () => { void useEditor.getState().unload(); };
  }, [repo, sheetId]);

  if (loadError) {
    return <ErrorState title="Não foi possível abrir a ficha" message={loadError} action={<Link className="btn" to={`/p/${projectId}/sheets`}>Voltar</Link>} />;
  }
  if (loading || !sheet) return <FullCenter><Spinner size={22} /></FullCenter>;

  return (
    <div className="flex h-full flex-col">
      <Toolbar projectId={projectId} />
      {status === 'conflict' && (
        <div className="bg-red-500/15 px-3 py-1.5 text-center text-sm text-red-200" role="alert">
          Esta ficha foi alterada em outra aba ou dispositivo. Suas últimas alterações não foram salvas — recarregue a página para continuar.
          <button className="btn ml-3 !py-0.5" onClick={() => location.reload()}>Recarregar</button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && <LeftPanel />}
        <main className="relative min-w-0 flex-1"><EditorCanvas /></main>
        {mode === 'edit' ? <PropertiesPanel /> : <PlayPanel projectId={projectId} />}
      </div>
    </div>
  );
}
