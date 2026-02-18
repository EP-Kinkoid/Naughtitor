import React, { useState } from 'react';
import type { Registry } from '../types';
import { AuditWorkspace } from './AuditWorkspace';
import { ArchiveToggle } from './ArchiveToggle';

interface Props {
  registry: Registry;
  onRefreshRegistry: () => void;
  createAudit: (name: string) => Promise<Registry>;
  archiveAudit: (auditId: string) => Promise<Registry>;
  addAuditControlApp: (auditId: string, controlId: string, appId: string) => Promise<Registry>;
  removeAuditControlApp: (auditId: string, controlId: string, appId: string) => Promise<Registry>;
}

export function AuditsView({ registry, onRefreshRegistry, createAudit, archiveAudit, addAuditControlApp, removeAuditControlApp }: Props) {
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const audits = showArchived
    ? registry.audits
    : registry.audits.filter(a => !a.archived);

  const selectedAudit = registry.audits.find(a => a.id === selectedAuditId);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setError('');
    try {
      const reg = await createAudit(name);
      const created = reg.audits.find(a => a.name === name);
      if (created) setSelectedAuditId(created.id);
      setNewName('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleArchive = async (auditId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Archive this audit?')) return;
    await archiveAudit(auditId);
    if (selectedAuditId === auditId) setSelectedAuditId(null);
  };

  if (selectedAudit) {
    return (
      <AuditWorkspace
        audit={selectedAudit}
        registry={registry}
        onBack={() => setSelectedAuditId(null)}
        onRefreshRegistry={onRefreshRegistry}
        addAuditControlApp={addAuditControlApp}
        removeAuditControlApp={removeAuditControlApp}
      />
    );
  }

  return (
    <div className="entity-list-view">
      <div className="entity-list-header">
        <h2>Audits</h2>
        <ArchiveToggle show={showArchived} onToggle={setShowArchived} />
      </div>

      <div className="add-entity">
        <div className="input-row">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder='Audit name (e.g. "Q1 2026 SOX")'
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button onClick={handleCreate} disabled={!newName.trim()}>Create</button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>

      <div className="entity-items">
        {audits.map(audit => (
          <div
            key={audit.id}
            className={`entity-item ${audit.archived ? 'archived' : ''}`}
            onClick={() => !audit.archived && setSelectedAuditId(audit.id)}
          >
            <div className="entity-item-info">
              <span className="entity-item-name">{audit.name}</span>
              <span className="entity-item-meta">
                {audit.controlApps.length} scope items
                {audit.archived && <span className="archive-badge">Archived</span>}
              </span>
            </div>
            {!audit.archived && (
              <button className="remove-btn" onClick={e => handleArchive(audit.id, e)} title="Archive">x</button>
            )}
          </div>
        ))}
        {audits.length === 0 && <p className="empty">No audits yet. Create one above.</p>}
      </div>
    </div>
  );
}
