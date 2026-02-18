import React, { useState } from 'react';
import { useRegistryStore } from './store/registryStore';
import { NavBar, View } from './components/NavBar';
import { HomeView } from './components/HomeView';
import { ApplicationsView } from './components/ApplicationsView';
import { ControlsView } from './components/ControlsView';
import { AuditsView } from './components/AuditsView';

export function App() {
  const store = useRegistryStore();
  const [view, setView] = useState<View>('home');

  if (store.loading) {
    return <div className="placeholder"><p>Loading...</p></div>;
  }

  const renderView = () => {
    switch (view) {
      case 'home':
        return <HomeView registry={store.registry} onNavigate={setView} />;
      case 'applications':
        return (
          <ApplicationsView
            registry={store.registry}
            onRefreshRegistry={store.refresh}
            createApp={store.createApp}
            updateApp={store.updateApp}
            archiveApp={store.archiveApp}
            saveAppDbConfig={store.saveAppDbConfig}
          />
        );
      case 'controls':
        return (
          <ControlsView
            registry={store.registry}
            onRefreshRegistry={store.refresh}
            createControl={store.createControl}
            updateControl={store.updateControl}
            archiveControl={store.archiveControl}
            linkAppToControl={store.linkAppToControl}
            unlinkAppFromControl={store.unlinkAppFromControl}
          />
        );
      case 'audits':
        return (
          <AuditsView
            registry={store.registry}
            onRefreshRegistry={store.refresh}
            createAudit={store.createAudit}
            archiveAudit={store.archiveAudit}
            addAuditControlApp={store.addAuditControlApp}
            removeAuditControlApp={store.removeAuditControlApp}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <NavBar currentView={view} onNavigate={setView} />
      <div className="app-content">
        {renderView()}
      </div>
    </div>
  );
}
