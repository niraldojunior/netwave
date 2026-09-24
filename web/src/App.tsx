import React, { useEffect, useState } from 'react';
import Header from './components/layout/Header';
import Sidebar, { type NavItemKey } from './components/layout/Sidebar';
import StrategicOverviewPage from './pages/StrategicOverviewPage';
import SetupPage from './pages/SetupPage';
import PipelineTrackingPage from './pages/PipelineTrackingPage';
import ImportPage from './pages/ImportPage';
import TriagemPage from './pages/TriagemPage';
import OrdersPage from './pages/OrdersPage';
import FieldSchedulePage from './pages/FieldSchedulePage';
import TechniciansPage from './pages/TechniciansPage';
import FieldMigrationPage from './pages/FieldMigrationPage';
import { MigrationApi } from './services/api';
import type { Ma } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavItemKey>('overview');
  const [mas, setMas] = useState<Ma[]>([]);
  const [activeMaId, setActiveMaId] = useState<string>('');

  const loadMas = async () => {
    try {
      const data = await MigrationApi.listMas();
      setMas(data);
      const activeList = data.filter((m) => m.status === 'ACTIVE');
      if (activeList.length > 0) {
        if (!activeMaId || !activeList.some((m) => m.id === activeMaId)) {
          setActiveMaId(activeList[0].id);
        }
      } else {
        setActiveMaId('');
      }
    } catch (e) {
      console.error('Falha ao carregar M&As', e);
    }
  };

  useEffect(() => {
    loadMas();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAFB]">
      <Header
        mas={mas}
        activeMaId={activeMaId}
        onMaChange={(id) => setActiveMaId(id)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onSelectTab={(t) => setActiveTab(t)} />

        <main className="flex-1 overflow-y-auto">
          {/* ESTRATÉGICO */}
          {activeTab === 'overview' && (
            <StrategicOverviewPage
              onSelectMa={(id) => setActiveMaId(id)}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'setup' && (
            <SetupPage
              onRefreshMas={loadMas}
            />
          )}

          {/* OPERACIONAL */}
          {activeTab === 'pipeline' && (
            <PipelineTrackingPage
              maId={activeMaId}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'import' && (
            <ImportPage maId={activeMaId} onNavigate={(tab) => setActiveTab(tab as any)} />
          )}

          {activeTab === 'triagem' && (
            <TriagemPage
              maId={activeMaId}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersPage
              maId={activeMaId}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'technicians' && (
            <TechniciansPage maId={activeMaId} />
          )}

          {activeTab === 'scheduling' && (
            <FieldSchedulePage maId={activeMaId} />
          )}

          {activeTab === 'field-migration' && (
            <FieldMigrationPage maId={activeMaId} />
          )}
        </main>
      </div>
    </div>
  );
}
