import { useEffect, useState } from 'react';
import { Link, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useRepo } from '../components/AuthProvider';
import { ErrorState, FullCenter, Spinner } from '../components/ui';
import { useRules } from '../stores/rules';
import type { Project } from '../types';

export interface ProjectCtx { project: Project; setProject: (p: Project) => void }
export const useProject = () => useOutletContext<ProjectCtx>();

/** Carrega o projeto e suas regras uma vez; todas as telas do projeto compartilham isso. */
export default function ProjectLoader() {
  const { projectId = '' } = useParams();
  const repo = useRepo();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const rulesLoading = useRules((s) => s.loading);
  const rulesError = useRules((s) => s.loadError);
  const rulesProject = useRules((s) => s.projectId);

  useEffect(() => {
    let alive = true;
    setProject(null); setError('');
    repo.getProject(projectId).then((p) => alive && setProject(p)).catch((e) => alive && setError(e.message));
    void useRules.getState().load(repo, projectId);
    return () => {
      alive = false;
      // só limpa se o store ainda for deste projeto (evita apagar o projeto seguinte ao trocar de rota)
      void useRules.getState().flush().catch(() => {}).finally(() => { if (useRules.getState().projectId === projectId) useRules.getState().reset(); });
    };
  }, [repo, projectId]);

  if (error) return <ErrorState title="Projeto não encontrado" message={error} action={<Link className="btn" to="/">Voltar aos projetos</Link>} />;
  if (rulesError) return <ErrorState title="Não foi possível carregar as regras" message={rulesError} action={<Link className="btn" to="/">Voltar</Link>} />;
  if (!project || rulesLoading || rulesProject !== projectId) return <FullCenter><Spinner size={22} /></FullCenter>;
  return <Outlet context={{ project, setProject } satisfies ProjectCtx} />;
}
