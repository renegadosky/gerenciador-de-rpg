import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ErrorBoundary, FullCenter, Spinner, Toasts } from './components/ui';
import LoginPage from './pages/LoginPage';
import ProjectLoader from './pages/ProjectLoader';
import ProjectShell from './pages/ProjectShell';
import ProjectsPage from './pages/ProjectsPage';
import RulesPage from './pages/RulesPage';
import SheetsPage from './pages/SheetsPage';
import LibraryPage from './pages/LibraryPage';
import SoonPage from './pages/SoonPage';
import CharactersPage from './pages/CharactersPage';
import { Navigate as Nav2 } from 'react-router-dom';
import { useProject } from './pages/ProjectLoader';
import PlayPage from './pages/PlayPage';

// o editor é a parte mais pesada: carregado sob demanda
const EditorPage = lazy(() => import('./pages/EditorPage'));

function ProjectHome() {
  const { project } = useProject();
  return <Nav2 to={project.kind === 'imported' ? 'characters' : 'sheets'} replace />;
}

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<FullCenter><Spinner size={22} /></FullCenter>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Protected><ProjectsPage /></Protected>} />
            <Route path="/p/:projectId" element={<Protected><ProjectLoader /></Protected>}>
              <Route element={<ProjectShell />}>
                <Route index element={<ProjectHome />} />
                <Route path="characters" element={<CharactersPage />} />
                <Route path="sheets" element={<SheetsPage />} />
                <Route path="rules" element={<RulesPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="relations" element={<SoonPage title="Relações" stage="Etapa 8" text="Vínculos navegáveis entre registros e grafo de conexões do universo." />} />
                <Route path="docs" element={<SoonPage title="Documentação" stage="Etapa 9" text="Páginas e pastas com editor de texto rico e links para registros." />} />
              </Route>
              <Route path="sheets/:sheetId" element={<EditorPage />} />
              <Route path="play/:characterId" element={<PlayPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
      <Toasts />
    </ErrorBoundary>
  );
}
