import { useState, useCallback, useEffect } from 'react';
import type { Registry, AppRecord, ControlRecord, DbConnectionConfig, EvidenceType } from '../types';

const EMPTY_REGISTRY: Registry = { applications: [], controls: [], audits: [] };

export function useRegistryStore() {
  const [registry, setRegistry] = useState<Registry>(EMPTY_REGISTRY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const reg = await window.naughtitor.getRegistry();
    setRegistry(reg);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // --- Applications ---

  const createApp = useCallback(async (app: AppRecord) => {
    const reg = await window.naughtitor.createApp(app);
    setRegistry(reg);
    return reg;
  }, []);

  const updateApp = useCallback(async (appId: string, updates: Partial<AppRecord>) => {
    const reg = await window.naughtitor.updateApp(appId, updates);
    setRegistry(reg);
    return reg;
  }, []);

  const archiveApp = useCallback(async (appId: string) => {
    const reg = await window.naughtitor.archiveApp(appId);
    setRegistry(reg);
    return reg;
  }, []);

  const saveAppDbConfig = useCallback(async (appId: string, config: DbConnectionConfig) => {
    const reg = await window.naughtitor.saveAppDbConfig(appId, config);
    setRegistry(reg);
    return reg;
  }, []);

  // --- Controls ---

  const createControl = useCallback(async (id: string, description: string) => {
    const reg = await window.naughtitor.createControl(id, description);
    setRegistry(reg);
    return reg;
  }, []);

  const updateControl = useCallback(async (controlId: string, updates: Partial<ControlRecord>) => {
    const reg = await window.naughtitor.updateControl(controlId, updates);
    setRegistry(reg);
    return reg;
  }, []);

  const archiveControl = useCallback(async (controlId: string) => {
    const reg = await window.naughtitor.archiveControl(controlId);
    setRegistry(reg);
    return reg;
  }, []);

  const linkAppToControl = useCallback(async (controlId: string, appId: string) => {
    const reg = await window.naughtitor.linkAppToControl(controlId, appId);
    setRegistry(reg);
    return reg;
  }, []);

  const unlinkAppFromControl = useCallback(async (controlId: string, appId: string) => {
    const reg = await window.naughtitor.unlinkAppFromControl(controlId, appId);
    setRegistry(reg);
    return reg;
  }, []);

  // --- Audits ---

  const createAudit = useCallback(async (name: string) => {
    const reg = await window.naughtitor.createAudit(name);
    setRegistry(reg);
    return reg;
  }, []);

  const archiveAudit = useCallback(async (auditId: string) => {
    const reg = await window.naughtitor.archiveAudit(auditId);
    setRegistry(reg);
    return reg;
  }, []);

  const addAuditControlApp = useCallback(async (auditId: string, controlId: string, appId: string) => {
    const reg = await window.naughtitor.addAuditControlApp(auditId, controlId, appId);
    setRegistry(reg);
    return reg;
  }, []);

  const removeAuditControlApp = useCallback(async (auditId: string, controlId: string, appId: string) => {
    const reg = await window.naughtitor.removeAuditControlApp(auditId, controlId, appId);
    setRegistry(reg);
    return reg;
  }, []);

  // --- Requirements ---

  const addRequirement = useCallback(async (auditId: string, controlId: string, appId: string, label: string, type: EvidenceType) => {
    const reg = await window.naughtitor.addRequirement(auditId, controlId, appId, label, type);
    setRegistry(reg);
    return reg;
  }, []);

  const removeRequirement = useCallback(async (auditId: string, controlId: string, appId: string, requirementId: string) => {
    const reg = await window.naughtitor.removeRequirement(auditId, controlId, appId, requirementId);
    setRegistry(reg);
    return reg;
  }, []);

  return {
    registry,
    loading,
    refresh,
    createApp,
    updateApp,
    archiveApp,
    saveAppDbConfig,
    createControl,
    updateControl,
    archiveControl,
    linkAppToControl,
    unlinkAppFromControl,
    createAudit,
    archiveAudit,
    addAuditControlApp,
    removeAuditControlApp,
    addRequirement,
    removeRequirement,
  };
}
