import React, { useEffect } from 'react';
import type { EvidenceItem } from '../types';
import { CaptureButton } from './CaptureButton';
import { ScreenshotCard } from './ScreenshotCard';

interface Props {
  auditName: string;
  controlId: string;
  evidence: EvidenceItem[];
  onRefresh: () => void;
}

export function EvidenceViewer({ auditName, controlId, evidence, onRefresh }: Props) {
  useEffect(() => {
    const cleanup = window.naughtitor.onTriggerCapture(async () => {
      await window.naughtitor.captureScreenshot(auditName, controlId);
      onRefresh();
    });
    return cleanup;
  }, [auditName, controlId, onRefresh]);

  return (
    <div className="evidence-viewer">
      <div className="evidence-header">
        <h3>Evidence for {controlId}</h3>
        <CaptureButton auditName={auditName} controlId={controlId} onCaptured={onRefresh} />
        <span className="hotkey-hint">Hotkey: Ctrl+Shift+S</span>
      </div>
      <div className="evidence-grid">
        {evidence.map(item => (
          <ScreenshotCard
            key={item.filename}
            auditName={auditName}
            controlId={controlId}
            item={item}
            onDeleted={onRefresh}
            onNoteUpdated={onRefresh}
          />
        ))}
        {evidence.length === 0 && (
          <p className="empty">No screenshots captured yet. Click "Capture Screenshot" or press Ctrl+Shift+S.</p>
        )}
      </div>
    </div>
  );
}
