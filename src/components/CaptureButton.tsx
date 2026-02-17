import React, { useState } from 'react';

interface Props {
  auditName: string;
  controlId: string;
  onCaptured: () => void;
}

export function CaptureButton({ auditName, controlId, onCaptured }: Props) {
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      await window.naughtitor.captureScreenshot(auditName, controlId);
      onCaptured();
    } catch (err) {
      alert('Screenshot capture failed: ' + (err as Error).message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <button className="capture-btn" onClick={handleCapture} disabled={capturing}>
      {capturing ? 'Capturing...' : 'Capture Screenshot'}
    </button>
  );
}
