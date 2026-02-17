import { useState, useCallback } from 'react';
import type { AuditMeta, EvidenceItem } from '../types';

export function useAuditStore() {
  const [currentAudit, setCurrentAudit] = useState<string | null>(null);
  const [auditMeta, setAuditMeta] = useState<AuditMeta | null>(null);
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const openAudit = useCallback(async (name: string) => {
    const meta = await window.naughtitor.getAudit(name);
    setCurrentAudit(name);
    setAuditMeta(meta);
    setSelectedControl(null);
    setEvidence([]);
  }, []);

  const refreshAudit = useCallback(async () => {
    if (!currentAudit) return;
    const meta = await window.naughtitor.getAudit(currentAudit);
    setAuditMeta(meta);
  }, [currentAudit]);

  const selectControl = useCallback(async (controlId: string) => {
    if (!currentAudit) return;
    setSelectedControl(controlId);
    const items = await window.naughtitor.listEvidence(currentAudit, controlId);
    setEvidence(items);
  }, [currentAudit]);

  const refreshEvidence = useCallback(async () => {
    if (!currentAudit || !selectedControl) return;
    const items = await window.naughtitor.listEvidence(currentAudit, selectedControl);
    setEvidence(items);
  }, [currentAudit, selectedControl]);

  const closeAudit = useCallback(() => {
    setCurrentAudit(null);
    setAuditMeta(null);
    setSelectedControl(null);
    setEvidence([]);
  }, []);

  return {
    currentAudit,
    auditMeta,
    selectedControl,
    evidence,
    openAudit,
    refreshAudit,
    selectControl,
    refreshEvidence,
    closeAudit,
  };
}
