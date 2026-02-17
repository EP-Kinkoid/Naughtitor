import React, { useState } from 'react';
import type { Application } from '../types';

interface Props {
  auditName: string;
  controlId: string;
  applications: Application[];
  selectedApplication: string | null;
  onSelect: (appId: string) => void;
  onRefresh: () => void;
}

export function ApplicationList({ auditName, controlId, applications, selectedApplication, onSelect, onRefresh }: Props) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setError('');
    const appId = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    try {
      await window.naughtitor.addApplication(auditName, controlId, appId, name, newDesc.trim());
      setNewName('');
      setNewDesc('');
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemove = async (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove application and all its evidence?`)) return;
    await window.naughtitor.removeApplication(auditName, controlId, appId);
    onRefresh();
  };

  return (
    <div className="application-list">
      <h3>Applications</h3>
      <div className="add-control">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Application name"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="text"
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          placeholder="Description (optional)"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} disabled={!newName.trim()}>Add</button>
        {error && <p className="error-message">{error}</p>}
      </div>
      <div className="controls">
        {applications.map(app => (
          <div
            key={app.id}
            className={`control-item ${selectedApplication === app.id ? 'selected' : ''}`}
            onClick={() => onSelect(app.id)}
          >
            <div className="control-info">
              <span className="control-id">{app.name}</span>
              {app.description && <span className="control-desc">{app.description}</span>}
            </div>
            <button className="remove-btn" onClick={e => handleRemove(app.id, e)} title="Remove">x</button>
          </div>
        ))}
        {applications.length === 0 && <p className="empty">No applications added yet.</p>}
      </div>
    </div>
  );
}
