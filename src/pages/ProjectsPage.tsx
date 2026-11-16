import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useRepo } from '../components/AuthProvider';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { ConfirmModal, ErrorState, FullCenter, Modal, Spinner } from '../components/ui';
import { fileToScaledDataUrl } from '../lib/image';
import { parseTemplateBundle } from '../data';
import { readJsonFile } from '../lib/files';
import { errMsg, toast } from '../stores/toast';
import type { Project } from '../types';

export default function ProjectsPage() {
  const repo = useRepo();
  const { user, mode, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const navigate = useNavigate();

  const importModel = async (file: File) => {
    try {
      const project = await repo.importTemplate(parseTemplateBundle(await readJsonFile(file)));
      toast.success(`“${project.name}” importado. Crie seu personagem.`);
      navigate(`/p/${project.id}/characters`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const load = useCallback(async () => {
    try { setProjects(await repo.listProjects()); setError(''); } catch (e) { setError(errMsg(e)); }
  }, [repo]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="glow-bg flex h-full flex-col overflow-hidden bg-g-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-g-700/70 bg-g-900/60 px-6 backdrop-blur">
        <div className="flex items-center gap-2.5 font-display text-lg font-bold tracking-wide"><Logo size={26} /> Gerenciador de RPG</div>
        <div className="flex items-center gap-3 text-xs text-g-400">
          {mode === 'local' ? <span title="Seus dados ficam salvos neste navegador. Configure o Supabase para entrar com conta e sincronizar.">Modo local · dados neste navegador</span> : <span>{user?.email}</span>}
          {mode === 'supabase' && <button className="btn btn-ghost !py-1" onClick={() => void signOut()}><Icon name="logout" size={13} /> Sair</button>}
          <ThemeSwitcher label />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-6 flex items-end justify-between">
            <div><h1 className="font-display text-3xl font-bold">Seus projetos</h1><p className="text-sm text-g-400">Cada projeto é um sistema ou universo independente, com regras, fichas e biblioteca próprias.</p></div>
            <div className="flex gap-2">
              <label className="btn cursor-pointer" title="Recebeu um arquivo de modelo do seu mestre? Importe aqui para criar seu personagem.">
                <Icon name="upload" size={14} /> Importar modelo do mestre
                <input type="file" accept=".json,application/json" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importModel(f); }} />
              </label>
              <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={14} /> Novo projeto</button>
            </div>
          </div>
          {error ? <ErrorState title="Não foi possível carregar os projetos" message={error} action={<button className="btn" onClick={() => void load()}>Tentar de novo</button>} />
            : !projects ? <FullCenter><Spinner size={22} /></FullCenter>
            : projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-g-600 p-12 text-center">
                <Icon name="layers" size={30} className="mx-auto mb-3 text-g-500" />
                <div className="mb-1 text-base font-semibold">Nenhum projeto ainda</div>
                <p className="mb-4 text-sm text-g-400">Comece com um projeto em branco: nada é pré-definido, você cria atributos, fichas e regras do zero.</p>
                <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={14} /> Criar primeiro projeto</button>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
                {projects.map((p) => (
                  <div key={p.id} className="card-lift group relative overflow-hidden rounded-2xl border border-g-700 bg-g-850 hover:border-accent/60">
                    <Link to={`/p/${p.id}`} className="block">
                      <div className="h-36 bg-g-800 bg-cover bg-center" style={p.coverUrl ? { backgroundImage: `url(${p.coverUrl})` } : undefined}>
                        {!p.coverUrl && <div className="flex h-full items-center justify-center text-g-600"><Icon name="shapes" size={34} /></div>}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-2"><div className="truncate text-base font-semibold">{p.name}</div>{p.kind === 'imported' && <span className="shrink-0 rounded bg-accent-soft px-1.5 text-2xs text-accent">do mestre</span>}</div>
                        <div className="line-clamp-2 min-h-[36px] text-sm text-g-400">{p.description || 'Sem descrição'}</div>
                        <div className="mt-2 text-xs text-g-500">Atualizado em {new Date(p.updatedAt).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </Link>
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button className="icon-btn bg-g-900/80" title="Editar" onClick={() => setEditing(p)}><Icon name="pencil" size={14} /></button>
                      <button className="icon-btn bg-g-900/80 hover:!text-red-400" title="Excluir" onClick={() => setDeleting(p)}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </main>
      {editing && <ProjectForm project={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
      {deleting && (
        <ConfirmModal title="Excluir projeto" confirmLabel="Excluir projeto"
          message={`“${deleting.name}” e todas as suas fichas, regras e conteúdo serão apagados permanentemente.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => { try { await repo.deleteProject(deleting.id); toast.success('Projeto excluído.'); void load(); } catch (e) { toast.error(errMsg(e)); } }} />
      )}
    </div>
  );
}

function ProjectForm({ project, onClose, onSaved }: { project: Project | null; onClose: () => void; onSaved: () => void }) {
  const repo = useRepo();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(project?.coverUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const n = name.trim();
    if (!n) return setError('Dê um nome ao projeto.');
    if (n.length > 120) return setError('O nome é longo demais (máx. 120 caracteres).');
    setBusy(true);
    try {
      if (project) await repo.updateProject(project.id, { name: n, description: description.trim(), coverUrl });
      else await repo.createProject({ name: n, description: description.trim(), coverUrl });
      onSaved();
    } catch (e) { setError(errMsg(e)); setBusy(false); }
  };

  return (
    <Modal title={project ? 'Editar projeto' : 'Novo projeto'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs text-g-400">Nome</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} /></label>
        <label className="block"><span className="mb-1 block text-xs text-g-400">Descrição</span><textarea className="field min-h-[72px]" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div>
          <span className="mb-1 block text-xs text-g-400">Imagem de capa</span>
          <div className="flex items-center gap-3">
            <div className="h-16 w-28 rounded-md border border-g-700 bg-g-800 bg-cover bg-center" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined} />
            <label className="btn cursor-pointer"><Icon name="upload" size={13} /> Escolher
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (!f) return;
                try { setCoverUrl((await fileToScaledDataUrl(f, 900)).dataUrl); } catch (err) { setError(errMsg(err)); }
              }} /></label>
            {coverUrl && <button type="button" className="btn btn-ghost" onClick={() => setCoverUrl(null)}>Remover</button>}
          </div>
        </div>
        {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</div>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
      </form>
    </Modal>
  );
}
