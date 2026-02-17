import React, { useState } from 'react';
import type { Control } from '../types';

interface Props {
  auditName: string;
  controls: Control[];
  selectedControl: string | null;
  onSelect: (controlId: string) => void;
  onRefresh: () => void;
}

export function ControlList({ auditName, controls, selectedControl, onSelect, onRefresh }: Props) {
  const [newId, setNewId] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleAdd = async () => {
    const id = newId.trim();
    if (!id) return;
    await window.naughtitor.addControl(auditName, id, newDesc.trim());
    setNewId('');
    setNewDesc('');
    onRefresh();
  };

  const handleRemove = async (controlId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove control ${controlId} and all its evidence?`)) return;
    await window.naughtitor.removeControl(auditName, controlId);
    onRefresh();
  };

  return (
    <div className="control-list">
      <h3>Controls</h3>
      <div className="add-control">
        <input
          type="text"
          value={newId}
          onChange={e => setNewId(e.target.value)}
          placeholder="Control ID (e.g. ITGC-01)"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="text"
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          placeholder="Description (optional)"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} disabled={!newId.trim()}>Add</button>
      </div>
      <div className="controls">
        {controls.map(c => (
          <div
            key={c.id}
            className={`control-item ${selectedControl === c.id ? 'selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="control-info">
              <span className="control-id">{c.id}</span>
              {c.description && <span className="control-desc">{c.description}</span>}
            </div>
            <button className="remove-btn" onClick={e => handleRemove(c.id, e)} title="Remove">x</button>
          </div>
        ))}
        {controls.length === 0 && <p className="empty">No controls added yet.</p>}
      </div>
    </div>
  );
}
