import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoadingScreen } from './components/system/LoadingScreen';
import { AdminGate } from './components/system/AdminGate';
import { ErrorDialog } from './components/dialogs/ErrorDialog';
import { useAppStore } from './stores/appStore';
import { useAccountStore } from './stores/accountStore';

const HomePage = lazy(() => import('./pages/HomePage'));
const GeneralPage = lazy(() => import('./pages/GeneralPage'));
const HardwarePage = lazy(() => import('./pages/HardwarePage'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const DebloatPage = lazy(() => import('./pages/DebloatPage'));
const AdvancedPage = lazy(() => import('./pages/AdvancedPage'));
const BiosPage = lazy(() => import('./pages/BiosPage'));
const GameModePage = lazy(() => import('./pages/GameModePage'));
const BackupsFixesPage = lazy(() => import('./pages/BackupsFixesPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  const { isBooting, setBooting } = useAppStore();
  const [elevationChecked, setElevationChecked] = useState(false);
  const [elevated, setElevated] = useState(true);
  const initAccount = useAccountStore((s) => s.init);

  useEffect(() => {
    initAccount();
  }, [initAccount]);

  useEffect(() => {
    if (isBooting) return;
    window.frontier.system.isElevated().then((res) => {
      setElevated(res.success ? Boolean(res.data) : true);
      setElevationChecked(true);
    });
  }, [isBooting]);

  if (isBooting) {
    return <LoadingScreen onDone={() => setBooting(false)} />;
  }

  if (!elevationChecked) {
    return <LoadingScreen onDone={() => {}} />;
  }

  if (!elevated) {
    return <AdminGate />;
  }

  return (
    <>
      <AppShell>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/general" element={<GeneralPage />} />
            <Route path="/hardware" element={<HardwarePage />} />
            <Route path="/debloat" element={<DebloatPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/advanced" element={<AdvancedPage />} />
            <Route path="/bios" element={<BiosPage />} />
            <Route path="/game-mode" element={<GameModePage />} />
            <Route path="/backups" element={<BackupsFixesPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </AppShell>
      <ErrorDialog />
    </>
  );
}
