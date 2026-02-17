import React, { useState, useEffect } from 'react';

interface Props {
  onSelect: (name: string) => void;
}

export function AuditSelector({ onSelect }: Props) {
  const [audits, setAudits] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    window.naughtitor.listAudits().then(setAudits);
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setError('');
    try {
      await window.naughtitor.createAudit(name);
      setNewName('');
      onSelect(name);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="audit-selector">
      <h1>Naughtitor</h1>
      <p className="subtitle">SOX Audit Evidence Collection</p>

      <div className="create-audit">
        <h2>Create New Audit</h2>
        <div className="input-row">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder='e.g. "FY2026 Q1 Audit"'
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button onClick={handleCreate} disabled={!newName.trim()}>Create</button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>

      {audits.length > 0 && (
        <div className="existing-audits">
          <h2>Open Existing Audit</h2>
          <div className="audit-list">
            {audits.map(name => (
              <button key={name} className="audit-item" onClick={() => onSelect(name)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
