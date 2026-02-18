import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('naughtitor', {
  // Registry
  getRegistry: () => ipcRenderer.invoke('get-registry'),
  saveRegistry: (data: unknown) => ipcRenderer.invoke('save-registry', data),

  // Applications
  createApp: (app: unknown) => ipcRenderer.invoke('create-app', app),
  updateApp: (appId: string, updates: unknown) => ipcRenderer.invoke('update-app', appId, updates),
  archiveApp: (appId: string) => ipcRenderer.invoke('archive-app', appId),
  saveAppDbConfig: (appId: string, config: unknown) => ipcRenderer.invoke('save-app-db-config', appId, config),

  // Controls
  createControl: (id: string, description: string) => ipcRenderer.invoke('create-control', id, description),
  updateControl: (controlId: string, updates: unknown) => ipcRenderer.invoke('update-control', controlId, updates),
  archiveControl: (controlId: string) => ipcRenderer.invoke('archive-control', controlId),
  linkAppToControl: (controlId: string, appId: string) => ipcRenderer.invoke('link-app-to-control', controlId, appId),
  unlinkAppFromControl: (controlId: string, appId: string) => ipcRenderer.invoke('unlink-app-from-control', controlId, appId),

  // Audits
  createAudit: (name: string) => ipcRenderer.invoke('create-audit', name),
  archiveAudit: (auditId: string) => ipcRenderer.invoke('archive-audit', auditId),
  addAuditControlApp: (auditId: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('add-audit-control-app', auditId, controlId, appId),
  removeAuditControlApp: (auditId: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('remove-audit-control-app', auditId, controlId, appId),

  // Evidence requirements
  addRequirement: (auditId: string, controlId: string, appId: string, label: string, type: string) =>
    ipcRenderer.invoke('add-requirement', auditId, controlId, appId, label, type),
  removeRequirement: (auditId: string, controlId: string, appId: string, requirementId: string) =>
    ipcRenderer.invoke('remove-requirement', auditId, controlId, appId, requirementId),

  // Evidence
  captureScreenshot: (auditId: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('capture-screenshot', auditId, controlId, appId),
  importFile: (auditId: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('import-file', auditId, controlId, appId),
  listEvidence: (auditId: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('list-evidence', auditId, controlId, appId),
  saveNote: (auditId: string, controlId: string, appId: string, filename: string, note: string) =>
    ipcRenderer.invoke('save-note', auditId, controlId, appId, filename, note),
  archiveEvidence: (auditId: string, controlId: string, appId: string, filename: string) =>
    ipcRenderer.invoke('archive-evidence', auditId, controlId, appId, filename),
  getEvidencePath: (auditId: string, controlId: string, appId: string, filename: string) =>
    ipcRenderer.invoke('get-evidence-path', auditId, controlId, appId, filename),
  listAllEvidenceForApp: (appId: string) =>
    ipcRenderer.invoke('list-all-evidence-for-app', appId),

  // Database
  testDbConnection: (config: unknown) =>
    ipcRenderer.invoke('test-db-connection', config),
  runDbQuery: (auditId: string, controlId: string, appId: string, config: unknown, query: string) =>
    ipcRenderer.invoke('run-db-query', auditId, controlId, appId, config, query),

  // Export
  exportAudit: (auditId: string) => ipcRenderer.invoke('export-audit', auditId),

  // Events
  onTriggerCapture: (callback: () => void) => {
    ipcRenderer.on('trigger-capture', callback);
    return () => ipcRenderer.removeListener('trigger-capture', callback);
  },
});
