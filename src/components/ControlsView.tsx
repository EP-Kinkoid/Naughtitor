import React, { useState } from 'react';
import type { Registry, ControlRecord } from '../types';
import { ArchiveToggle } from './ArchiveToggle';

interface Props {
  registry: Registry;
  onRefreshRegistry: () => void;
  createControl: (id: string, description: string) => Promise<Registry>;
  updateControl: (controlId: string, updates: Partial<ControlRecord>) => Promise<Registry>;
  archiveControl: (controlId: string) => Promise<Registry>;
  linkAppToControl: (controlId: string, appId: string) => Promise<Registry>;
  unlinkAppFromControl: (controlId: string, appId: string) => Promise<Registry>;
}

export function ControlsView({ registry, onRefreshRegistry, createControl, updateControl, archiveControl, linkAppToControl, unlinkAppFromControl }: Props) {
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newId, setNewId] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [error, setError] = useState('');
  const [linkAppId, setLinkAppId] = useState('');

  const controls = showArchived
    ? registry.controls
    : registry.controls.filter(c => !c.archived);

  const selectedControl = registry.controls.find(c => c.id === selectedControlId);
  const activeApps = registry.applications.filter(a => !a.archived);

  const handleCreate = async () => {
    const id = newId.trim();
    if (!id) return;
    setError('');
    try {
      await createControl(id, newDesc.trim());
      setNewId('');
      setNewDesc('');
      setSelectedControlId(id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSave = async () => {
    if (!selectedControl) return;
    setError('');
    try {
      await updateControl(selectedControl.id, { description: editDesc });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleArchive = async (controlId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Archive this control?')) return;
    await archiveControl(controlId);
    if (selectedControlId === controlId) setSelectedControlId(null);
  };

  const handleLinkApp = async () => {
    if (!selectedControl || !linkAppId) return;
    await linkAppToControl(selectedControl.id, linkAppId);
    setLinkAppId('');
  };

  const handleUnlinkApp = async (appId: string) => {
    if (!selectedControl) return;
    await unlinkAppFromControl(selectedControl.id, appId);
  };

  const selectControl = (c: ControlRecord) => {
    setSelectedControlId(c.id);
    setEditDesc(c.description);
    setError('');
  };

  const linkedApps = selectedControl
    ? selectedControl.appIds.map(id => registry.applications.find(a => a.id === id)).filter(Boolean)
    : [];

  const unlinkableApps = selectedControl
    ? activeApps.filter(a => !selectedControl.appIds.includes(a.id))
    : [];

  return (
    <div className="entity-split-view">
      <div className="entity-list-panel">
        <div className="entity-list-header">
          <h2>Controls</h2>
          <ArchiveToggle show={showArchived} onToggle={setShowArchived} />
        </div>
        <div className="add-entity">
          <input
            type="text"
            value={newId}
            onChange={e => setNewId(e.target.value)}
            placeholder="Control ID (e.g. ITGC-01)"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <input
            type="text"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button onClick={handleCreate} disabled={!newId.trim()}>Add</button>
        </div>
        <div className="entity-items">
          {controls.map(c => (
            <div
              key={c.id}
              className={`entity-item ${selectedControlId === c.id ? 'selected' : ''} ${c.archived ? 'archived' : ''}`}
              onClick={() => !c.archived && selectControl(c)}
            >
              <div className="entity-item-info">
                <span className="entity-item-name">{c.id}</span>
                <span className="entity-item-meta">
                  {c.description}
                  {c.archived && <span className="archive-badge">Archived</span>}
                </span>
              </div>
              {!c.archived && (
                <button className="remove-btn" onClick={e => handleArchive(c.id, e)} title="Archive">x</button>
              )}
            </div>
          ))}
          {controls.length === 0 && <p className="empty">No controls yet.</p>}
        </div>
      </div>

      <div className="entity-detail-panel">
        {selectedControl ? (
          <div className="control-detail">
            <h3>{selectedControl.id}</h3>

            <div className="form-row">
              <label>Description</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
              <button className="small-btn" onClick={handleSave} style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}>Save</button>
            </div>

            {error && <p className="error-message">{error}</p>}

            <div className="linked-apps-section">
              <h4>Linked Applications</h4>
              <div className="link-app-row">
                <select value={linkAppId} onChange={e => setLinkAppId(e.target.value)}>
                  <option value="">Select app to link...</option>
                  {unlinkableApps.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <button onClick={handleLinkApp} disabled={!linkAppId}>Link</button>
              </div>
              <div className="linked-apps-list">
                {linkedApps.map(app => app && (
                  <div key={app.id} className="linked-app-item">
                    <span>{app.name}</span>
                    <span className="entity-item-meta">{app.environment}</span>
                    <button className="remove-btn" onClick={() => handleUnlinkApp(app.id)} title="Unlink">x</button>
                  </div>
                ))}
                {linkedApps.length === 0 && <p className="empty">No applications linked to this control.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="placeholder">
            <p>Select a control to view details and linked applications.</p>
          </div>
        )}
      </div>
    </div>
  );
}
