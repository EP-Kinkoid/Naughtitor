import React, { useState, useEffect } from 'react';
import type { EvidenceItem, EvidenceRequirement, EvidenceType, AppRecord } from '../types';
import { EvidenceActions } from './EvidenceActions';
import { EvidenceCard } from './EvidenceCard';
import { DbQueryDialog } from './DbQueryDialog';

interface Props {
  auditId: string;
  controlId: string;
  appId: string;
  appRecord: AppRecord;
  requirements: EvidenceRequirement[];
  evidence: EvidenceItem[];
  onRefreshEvidence: () => void;
  onRefreshRegistry: () => void;
}

export function EvidenceViewer({ auditId, controlId, appId, appRecord, requirements, evidence, onRefreshEvidence, onRefreshRegistry }: Props) {
  const [showDbDialog, setShowDbDialog] = useState(false);
  const [reqLabel, setReqLabel] = useState('');
  const [reqType, setReqType] = useState<EvidenceType>('screenshot');

  useEffect(() => {
    const cleanup = window.naughtitor.onTriggerCapture(async () => {
      await window.naughtitor.captureScreenshot(auditId, controlId, appId);
      onRefreshEvidence();
    });
    return cleanup;
  }, [auditId, controlId, appId, onRefreshEvidence]);

  const handleAddRequirement = async () => {
    if (!reqLabel.trim()) return;
    await window.naughtitor.addRequirement(auditId, controlId, appId, reqLabel.trim(), reqType);
    setReqLabel('');
    onRefreshRegistry();
  };

  const handleRemoveRequirement = async (reqId: string) => {
    await window.naughtitor.removeRequirement(auditId, controlId, appId, reqId);
    onRefreshRegistry();
  };

  const isFulfilled = (req: EvidenceRequirement) => {
    return evidence.some(e => e.type === req.type);
  };

  return (
    <div className="evidence-viewer">
      <div className="evidence-header">
        <h3>{appRecord.name}</h3>
        <EvidenceActions
          auditId={auditId}
          controlId={controlId}
          appId={appId}
          onCaptured={onRefreshEvidence}
          onQueryClick={() => setShowDbDialog(true)}
        />
        <span className="hotkey-hint">Ctrl+Shift+S</span>
      </div>

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
        {requirements.length > 0 && (
          <ul className="requirements-list">
            {requirements.map(req => (
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

      <div className="evidence-grid">
        {evidence.map(item => (
          <EvidenceCard
            key={item.filename}
            auditId={auditId}
            controlId={controlId}
            appId={appId}
            item={item}
            onArchived={onRefreshEvidence}
            onNoteUpdated={onRefreshEvidence}
          />
        ))}
        {evidence.length === 0 && (
          <p className="empty">No evidence collected yet. Use the buttons above to capture screenshots, run queries, or import files.</p>
        )}
      </div>

      {showDbDialog && (
        <DbQueryDialog
          auditId={auditId}
          controlId={controlId}
          appId={appId}
          initialConfig={appRecord.dbConfig}
          onClose={() => setShowDbDialog(false)}
          onSaved={() => { onRefreshEvidence(); onRefreshRegistry(); }}
        />
      )}
    </div>
  );
}
