import React, { useState, useEffect } from 'react';
import type { EvidenceItem, EvidenceRequirement, EvidenceType, Application } from '../types';
import { EvidenceActions } from './EvidenceActions';
import { EvidenceCard } from './EvidenceCard';
import { DbQueryDialog } from './DbQueryDialog';

interface Props {
  auditName: string;
  controlId: string;
  appId: string;
  application: Application;
  evidence: EvidenceItem[];
  onRefresh: () => void;
  onAuditRefresh: () => void;
}

export function EvidenceViewer({ auditName, controlId, appId, application, evidence, onRefresh, onAuditRefresh }: Props) {
  const [showDbDialog, setShowDbDialog] = useState(false);
  const [reqLabel, setReqLabel] = useState('');
  const [reqType, setReqType] = useState<EvidenceType>('screenshot');

  useEffect(() => {
    const cleanup = window.naughtitor.onTriggerCapture(async () => {
      await window.naughtitor.captureScreenshot(auditName, controlId, appId);
      onRefresh();
    });
    return cleanup;
  }, [auditName, controlId, appId, onRefresh]);

  const handleAddRequirement = async () => {
    if (!reqLabel.trim()) return;
    await window.naughtitor.addRequirement(auditName, controlId, appId, reqLabel.trim(), reqType);
    setReqLabel('');
    onAuditRefresh();
  };

  const handleRemoveRequirement = async (reqId: string) => {
    await window.naughtitor.removeRequirement(auditName, controlId, appId, reqId);
    onAuditRefresh();
  };

  const isFulfilled = (req: EvidenceRequirement) => {
    return evidence.some(e => e.type === req.type);
  };

  return (
    <div className="evidence-viewer">
      <div className="evidence-header">
        <h3>{application.name}</h3>
        <EvidenceActions
          auditName={auditName}
          controlId={controlId}
          appId={appId}
          onCaptured={onRefresh}
          onQueryClick={() => setShowDbDialog(true)}
        />
        <span className="hotkey-hint">Ctrl+Shift+S</span>
      </div>

      {/* Evidence Requirements Checklist */}
      <div className="requirements-section">
        <h4>Evidence Checklist</h4>
        <div className="add-requirement">
          <input
            type="text"
            value={reqLabel}
            onChange={e => setReqLabel(e.target.value)}
            placeholder="Requirement label"
            onKeyDown={e => e.key === 'Enter' && handleAddRequirement()}
          />
          <select value={reqType} onChange={e => setReqType(e.target.value as EvidenceType)}>
            <option value="screenshot">Screenshot</option>
            <option value="db-query">DB Query</option>
            <option value="file">File</option>
          </select>
          <button onClick={handleAddRequirement} disabled={!reqLabel.trim()}>Add</button>
        </div>
        {application.evidenceRequirements.length > 0 && (
          <ul className="requirements-list">
            {application.evidenceRequirements.map(req => (
              <li key={req.id} className={isFulfilled(req) ? 'fulfilled' : ''}>
                <span className="req-check">{isFulfilled(req) ? '\u2713' : '\u25CB'}</span>
                <span className="req-label">{req.label}</span>
                <span className="req-type-badge">{req.type}</span>
                <button className="remove-btn" onClick={() => handleRemoveRequirement(req.id)}>x</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Evidence Grid */}
      <div className="evidence-grid">
        {evidence.map(item => (
          <EvidenceCard
            key={item.filename}
            auditName={auditName}
            controlId={controlId}
            appId={appId}
            item={item}
            onDeleted={onRefresh}
            onNoteUpdated={onRefresh}
          />
        ))}
        {evidence.length === 0 && (
          <p className="empty">No evidence collected yet. Use the buttons above to capture screenshots, run queries, or import files.</p>
        )}
      </div>

      {showDbDialog && (
        <DbQueryDialog
          auditName={auditName}
          controlId={controlId}
          appId={appId}
          initialConfig={application.dbConfig}
          onClose={() => setShowDbDialog(false)}
          onSaved={() => { onRefresh(); onAuditRefresh(); }}
        />
      )}
    </div>
  );
}
