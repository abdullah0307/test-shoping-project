import { useEffect, useState } from 'react';
import { AdminConsole } from './components/AdminConsole';
import { ClientPortal } from './components/ClientPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { LoginView } from './components/LoginView';
import { Navbar, type ActiveRoute } from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppShell() {
  const { user, isAdmin, authReady } = useAuth();
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('landing');
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);

  const handleNavigate = (route: ActiveRoute, sectionId?: string) => {
    setActiveRoute(route);
    if (route === 'landing' && sectionId) {
      setPendingSectionId(sectionId);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (activeRoute === 'landing' && pendingSectionId) {
      const timer = window.setTimeout(() => {
        const el = document.getElementById(pendingSectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
        setPendingSectionId(null);
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [activeRoute, pendingSectionId]);

  useEffect(() => {
    if (!authReady) return;
    if ((activeRoute === 'portal' || activeRoute === 'admin') && !user) {
      setActiveRoute('login');
    } else if (activeRoute === 'admin' && user && !isAdmin) {
      setActiveRoute('portal');
    }
  }, [authReady, activeRoute, user, isAdmin]);

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e]">
      <Navbar activeRoute={activeRoute} onNavigate={handleNavigate} />
      <main className="w-full pt-20">
        {activeRoute === 'landing' && (
          <LandingPage onNavigate={handleNavigate} />
        )}
        {activeRoute === 'login' && <LoginView onNavigate={handleNavigate} />}
        {activeRoute === 'portal' && (
          <ClientPortal onNavigate={handleNavigate} />
        )}
        {activeRoute === 'admin' && (
          <AdminConsole onNavigate={handleNavigate} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
