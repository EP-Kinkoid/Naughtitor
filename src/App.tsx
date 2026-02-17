import React from 'react';
import { useAuditStore } from './store/auditStore';
import { AuditSelector } from './components/AuditSelector';
import { ControlList } from './components/ControlList';
import { ApplicationList } from './components/ApplicationList';
import { EvidenceViewer } from './components/EvidenceViewer';

export function App() {
  const store = useAuditStore();

  if (!store.currentAudit || !store.auditMeta) {
    return <AuditSelector onSelect={store.openAudit} />;
  }

  const handleExport = async () => {
    const result = await window.naughtitor.exportAudit(store.currentAudit!);
    if (result) {
      alert(`Exported to ${result}`);
    }
  };

  const selectedControlMeta = store.auditMeta.controls.find(c => c.id === store.selectedControl);
  const selectedAppMeta = selectedControlMeta?.applications.find(a => a.id === store.selectedApplication);

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>{store.auditMeta.name}</h2>
          <div className="sidebar-actions">
            <button className="small-btn" onClick={handleExport}>Export ZIP</button>
            <button className="small-btn" onClick={store.closeAudit}>Close</button>
          </div>
        </div>
        <ControlList
          auditName={store.currentAudit}
          controls={store.auditMeta.controls}
          selectedControl={store.selectedControl}
          onSelect={store.selectControl}
          onRefresh={store.refreshAudit}
        />
        {store.selectedControl && selectedControlMeta && (
          <ApplicationList
            auditName={store.currentAudit}
            controlId={store.selectedControl}
            applications={selectedControlMeta.applications}
            selectedApplication={store.selectedApplication}
            onSelect={store.selectApplication}
            onRefresh={store.refreshAudit}
          />
        )}
      </div>
      <div className="main-content">
        {store.selectedApplication && selectedAppMeta ? (
          <EvidenceViewer
            auditName={store.currentAudit}
            controlId={store.selectedControl!}
            appId={store.selectedApplication}
            application={selectedAppMeta}
            evidence={store.evidence}
            onRefresh={store.refreshEvidence}
            onAuditRefresh={store.refreshAudit}
          />
        ) : (
          <div className="placeholder">
            <p>
              {!store.selectedControl
                ? 'Select a control from the sidebar to get started.'
                : 'Select an application to view or capture evidence.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
