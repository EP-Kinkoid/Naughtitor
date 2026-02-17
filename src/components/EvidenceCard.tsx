import React, { useState } from 'react';
import type { EvidenceItem } from '../types';

interface Props {
  auditName: string;
  controlId: string;
  appId: string;
  item: EvidenceItem;
  onDeleted: () => void;
  onNoteUpdated: () => void;
}

export function EvidenceCard({ auditName, controlId, appId, item, onDeleted, onNoteUpdated }: Props) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note);

  const handleSaveNote = async () => {
    await window.naughtitor.saveNote(auditName, controlId, appId, item.filename, noteText);
    setEditingNote(false);
    onNoteUpdated();
  };

  const handleDelete = async () => {
    const typeLabel = item.type === 'screenshot' ? 'screenshot' : item.type === 'db-query' ? 'query result' : 'file';
    if (!confirm(`Delete this ${typeLabel}?`)) return;
    await window.naughtitor.deleteEvidence(auditName, controlId, appId, item.filename);
    onDeleted();
  };

  const formattedTime = new Date(item.timestamp).toLocaleString();

  const renderPreview = () => {
    switch (item.type) {
      case 'screenshot':
        return <img src={`file://${item.path}`} alt={item.filename} />;
      case 'db-query':
        return (
          <div className="evidence-preview db-preview">
            <span className="type-badge db-badge">DB Query</span>
            <p className="query-text">{item.query}</p>
            {item.rowCount !== undefined && <span className="row-count">{item.rowCount} rows</span>}
          </div>
        );
      case 'file':
        return (
          <div className="evidence-preview file-preview">
            <span className="type-badge file-badge">File</span>
            <p className="file-name">{item.originalName || item.filename}</p>
            {item.fileSize !== undefined && <span className="file-size">{formatSize(item.fileSize)}</span>}
          </div>
        );
    }
  };

  return (
    <div className={`evidence-card type-${item.type}`}>
      {renderPreview()}
      <div className="card-info">
        <span className="timestamp">{formattedTime}</span>
        <div className="card-actions">
          {editingNote ? (
            <div className="note-editor">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={3}
              />
              <div className="note-buttons">
                <button onClick={handleSaveNote}>Save</button>
                <button onClick={() => { setEditingNote(false); setNoteText(item.note); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {item.note && <p className="note-text">{item.note}</p>}
              <button className="small-btn" onClick={() => setEditingNote(true)}>
                {item.note ? 'Edit Note' : 'Add Note'}
              </button>
            </>
          )}
          <button className="small-btn danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
