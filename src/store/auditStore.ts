import { useState, useCallback } from 'react';
import type { AuditMeta, EvidenceItem } from '../types';

export function useAuditStore() {
  const [currentAudit, setCurrentAudit] = useState<string | null>(null);
  const [auditMeta, setAuditMeta] = useState<AuditMeta | null>(null);
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const openAudit = useCallback(async (name: string) => {
    const meta = await window.naughtitor.getAudit(name);
    setCurrentAudit(name);
    setAuditMeta(meta);
    setSelectedControl(null);
    setSelectedApplication(null);
    setEvidence([]);
  }, []);

  const refreshAudit = useCallback(async () => {
    if (!currentAudit) return;
    const meta = await window.naughtitor.getAudit(currentAudit);
    setAuditMeta(meta);
  }, [currentAudit]);

  const selectControl = useCallback(async (controlId: string) => {
    setSelectedControl(controlId);
    setSelectedApplication(null);
    setEvidence([]);
  }, []);

  const selectApplication = useCallback(async (appId: string) => {
    if (!currentAudit || !selectedControl) return;
    setSelectedApplication(appId);
    const items = await window.naughtitor.listEvidence(currentAudit, selectedControl, appId);
    setEvidence(items);
  }, [currentAudit, selectedControl]);

  const refreshEvidence = useCallback(async () => {
    if (!currentAudit || !selectedControl || !selectedApplication) return;
    const items = await window.naughtitor.listEvidence(currentAudit, selectedControl, selectedApplication);
    setEvidence(items);
  }, [currentAudit, selectedControl, selectedApplication]);

  const closeAudit = useCallback(() => {
    setCurrentAudit(null);
    setAuditMeta(null);
    setSelectedControl(null);
    setSelectedApplication(null);
    setEvidence([]);
  }, []);

  return {
    currentAudit,
    auditMeta,
    selectedControl,
    selectedApplication,
    evidence,
    openAudit,
    refreshAudit,
    selectControl,
    selectApplication,
    refreshEvidence,
    closeAudit,
  };
}
