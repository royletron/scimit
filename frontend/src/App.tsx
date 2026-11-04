import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Toaster } from './components/common/toast';
import { CommandPalette } from './components/common/CommandPalette';
import { UsersPage } from './pages/UsersPage';
import { GroupsPage } from './pages/GroupsPage';
import { LogsPage } from './pages/LogsPage';
import { ConnectorPage } from './pages/ConnectorPage';
import { PlaybackPage } from './pages/PlaybackPage';
import { ChangelogPage } from './pages/ChangelogPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen md:flex">
          <Sidebar />
          <main className="flex-1 min-w-0 py-8 md:py-10">
            <Routes>
              <Route path="/" element={<Navigate to="/users" replace />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/connector" element={<ConnectorPage />} />
              <Route path="/playback" element={<PlaybackPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
            </Routes>
          </main>
          <Toaster />
          <CommandPalette />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
