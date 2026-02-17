import React, { useState } from 'react';
import type { EvidenceItem } from '../types';

interface Props {
  auditName: string;
  controlId: string;
  item: EvidenceItem;
  onDeleted: () => void;
  onNoteUpdated: () => void;
}

export function ScreenshotCard({ auditName, controlId, item, onDeleted, onNoteUpdated }: Props) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note);

  const handleSaveNote = async () => {
    await window.naughtitor.saveNote(auditName, controlId, item.filename, noteText);
    setEditingNote(false);
    onNoteUpdated();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this screenshot?')) return;
    await window.naughtitor.deleteScreenshot(auditName, controlId, item.filename);
    onDeleted();
  };

  const formattedTime = new Date(item.timestamp).toLocaleString();

  return (
    <div className="screenshot-card">
      <img src={`file://${item.path}`} alt={item.filename} />
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
