import React, { useState } from 'react';

interface Props {
  auditName: string;
  controlId: string;
  appId: string;
  onCaptured: () => void;
  onQueryClick: () => void;
}

export function EvidenceActions({ auditName, controlId, appId, onCaptured, onQueryClick }: Props) {
  const [capturing, setCapturing] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleScreenshot = async () => {
    setCapturing(true);
    try {
      await window.naughtitor.captureScreenshot(auditName, controlId, appId);
      onCaptured();
    } catch (err) {
      alert('Screenshot capture failed: ' + (err as Error).message);
    } finally {
      setCapturing(false);
    }
  };

  const handleImportFile = async () => {
    setImporting(true);
    try {
      const result = await window.naughtitor.importFile(auditName, controlId, appId);
      if (result) onCaptured();
    } catch (err) {
      alert('File import failed: ' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="evidence-actions">
      <button className="action-btn screenshot-btn" onClick={handleScreenshot} disabled={capturing}>
        {capturing ? 'Capturing...' : 'Screenshot'}
      </button>
      <button className="action-btn query-btn" onClick={onQueryClick}>
        DB Query
      </button>
      <button className="action-btn import-btn" onClick={handleImportFile} disabled={importing}>
        {importing ? 'Importing...' : 'Import File'}
      </button>
    </div>
  );
}
