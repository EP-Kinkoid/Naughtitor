import React, { useState, useCallback, useEffect } from 'react';
import type { AuditRecord, Registry, EvidenceItem } from '../types';
import { EvidenceViewer } from './EvidenceViewer';
import { useEvidenceStore } from '../store/evidenceStore';

interface Props {
  audit: AuditRecord;
  registry: Registry;
  onBack: () => void;
  onRefreshRegistry: () => void;
  addAuditControlApp: (auditId: string, controlId: string, appId: string) => Promise<Registry>;
  removeAuditControlApp: (auditId: string, controlId: string, appId: string) => Promise<Registry>;
}

export function AuditWorkspace({ audit, registry, onBack, onRefreshRegistry, addAuditControlApp, removeAuditControlApp }: Props) {
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [addControlId, setAddControlId] = useState('');
  const [addAppId, setAddAppId] = useState('');
  const { evidence, loadEvidence, clearEvidence } = useEvidenceStore();

  const activeControls = registry.controls.filter(c => !c.archived);
  const activeApps = registry.applications.filter(a => !a.archived);

  // Distinct controls in scope
  const scopeControlIds = [...new Set(audit.controlApps.map(ca => ca.controlId))];

  // Apps for the selected control in scope
  const scopeAppsForControl = selectedControlId
    ? audit.controlApps.filter(ca => ca.controlId === selectedControlId)
    : [];

  const selectedCa = audit.controlApps.find(
    ca => ca.controlId === selectedControlId && ca.appId === selectedAppId
  );
  const selectedAppRecord = registry.applications.find(a => a.id === selectedAppId);

  const refreshEvidence = useCallback(() => {
    if (selectedControlId && selectedAppId) {
      loadEvidence(audit.id, selectedControlId, selectedAppId);
    }
  }, [audit.id, selectedControlId, selectedAppId, loadEvidence]);

  useEffect(() => {
    if (selectedControlId && selectedAppId) {
      loadEvidence(audit.id, selectedControlId, selectedAppId);
    } else {
      clearEvidence();
    }
  }, [audit.id, selectedControlId, selectedAppId, loadEvidence, clearEvidence]);

  const handleAddScope = async () => {
    if (!addControlId || !addAppId) return;
    await addAuditControlApp(audit.id, addControlId, addAppId);
    setAddControlId('');
    setAddAppId('');
  };

  const handleRemoveScope = async (controlId: string, appId: string) => {
    await removeAuditControlApp(audit.id, controlId, appId);
    if (selectedControlId === controlId && selectedAppId === appId) {
      setSelectedAppId(null);
    }
  };

  const handleExport = async () => {
    const result = await window.naughtitor.exportAudit(audit.id);
    if (result) alert(`Exported to ${result}`);
  };

  return (
    <div className="audit-workspace">
      <div className="workspace-sidebar">
        <div className="sidebar-header">
          <button className="small-btn" onClick={onBack}>Back</button>
          <h2>{audit.name}</h2>
          <button className="small-btn" onClick={handleExport}>Export ZIP</button>
        </div>

        {/* Add scope */}
        <div className="add-scope">
          <h4>Add to Scope</h4>
          <select value={addControlId} onChange={e => setAddControlId(e.target.value)}>
            <option value="">Select control...</option>
            {activeControls.map(c => (
              <option key={c.id} value={c.id}>{c.id} - {c.description}</option>
            ))}
          </select>
          <select value={addAppId} onChange={e => setAddAppId(e.target.value)}>
            <option value="">Select application...</option>
            {(addControlId
              ? activeApps.filter(a => {
                  const ctrl = registry.controls.find(c => c.id === addControlId);
                  return ctrl?.appIds.includes(a.id);
                })
              : activeApps
            ).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button onClick={handleAddScope} disabled={!addControlId || !addAppId}>Add</button>
        </div>

        {/* Scope tree */}
        <div className="scope-tree">
          <h4>Audit Scope</h4>
          {scopeControlIds.map(controlId => {
            const control = registry.controls.find(c => c.id === controlId);
            const apps = audit.controlApps.filter(ca => ca.controlId === controlId);
            return (
              <div key={controlId} className="scope-control">
                <div
                  className={`scope-control-header ${selectedControlId === controlId ? 'selected' : ''}`}
                  onClick={() => { setSelectedControlId(controlId); setSelectedAppId(null); clearEvidence(); }}
                >
                  <span className="control-id">{controlId}</span>
                  {control && <span className="control-desc">{control.description}</span>}
                </div>
                <div className="scope-apps">
                  {apps.map(ca => {
                    const app = registry.applications.find(a => a.id === ca.appId);
                    return (
                      <div
                        key={ca.appId}
                        className={`scope-app ${selectedControlId === controlId && selectedAppId === ca.appId ? 'selected' : ''}`}
                        onClick={() => { setSelectedControlId(controlId); setSelectedAppId(ca.appId); }}
                      >
                        <span className="scope-app-name">{app?.name || ca.appId}</span>
                        <button
                          className="remove-btn"
                          onClick={e => { e.stopPropagation(); handleRemoveScope(controlId, ca.appId); }}
                          title="Remove from scope"
                        >x</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {scopeControlIds.length === 0 && (
            <p className="empty">No control+app pairs in scope. Add some above.</p>
          )}
        </div>
      </div>

      <div className="workspace-main">
        {selectedCa && selectedAppRecord ? (
          <EvidenceViewer
            auditId={audit.id}
            controlId={selectedControlId!}
            appId={selectedAppId!}
            appRecord={selectedAppRecord}
            requirements={selectedCa.evidenceRequirements}
            evidence={evidence}
            onRefreshEvidence={refreshEvidence}
            onRefreshRegistry={onRefreshRegistry}
          />
        ) : (
          <div className="placeholder">
            <p>Select a control and application from the scope to collect evidence.</p>
          </div>
        )}
      </div>
    </div>
  );
}
