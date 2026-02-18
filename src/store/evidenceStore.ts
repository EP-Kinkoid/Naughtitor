import { useState, useCallback } from 'react';
import type { EvidenceItem } from '../types';

export function useEvidenceStore() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const loadEvidence = useCallback(async (auditId: string, controlId: string, appId: string) => {
    setLoadingEvidence(true);
    try {
      const items = await window.naughtitor.listEvidence(auditId, controlId, appId);
      setEvidence(items);
    } finally {
      setLoadingEvidence(false);
    }
  }, []);

  const clearEvidence = useCallback(() => {
    setEvidence([]);
  }, []);

  return {
    evidence,
    loadingEvidence,
    loadEvidence,
    clearEvidence,
  };
}
