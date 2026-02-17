import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('naughtitor', {
  // Audits
  listAudits: () => ipcRenderer.invoke('list-audits'),
  createAudit: (name: string) => ipcRenderer.invoke('create-audit', name),
  getAudit: (name: string) => ipcRenderer.invoke('get-audit', name),
  saveAudit: (name: string, data: unknown) => ipcRenderer.invoke('save-audit', name, data),

  // Controls
  addControl: (auditName: string, controlId: string, description: string) =>
    ipcRenderer.invoke('add-control', auditName, controlId, description),
  removeControl: (auditName: string, controlId: string) =>
    ipcRenderer.invoke('remove-control', auditName, controlId),

  // Applications
  addApplication: (auditName: string, controlId: string, appId: string, name: string, description: string) =>
    ipcRenderer.invoke('add-application', auditName, controlId, appId, name, description),
  removeApplication: (auditName: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('remove-application', auditName, controlId, appId),
  saveDbConfig: (auditName: string, controlId: string, appId: string, config: unknown) =>
    ipcRenderer.invoke('save-db-config', auditName, controlId, appId, config),

  // Evidence requirements
  addRequirement: (auditName: string, controlId: string, appId: string, label: string, type: string) =>
    ipcRenderer.invoke('add-requirement', auditName, controlId, appId, label, type),
  removeRequirement: (auditName: string, controlId: string, appId: string, requirementId: string) =>
    ipcRenderer.invoke('remove-requirement', auditName, controlId, appId, requirementId),

  // Evidence
  captureScreenshot: (auditName: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('capture-screenshot', auditName, controlId, appId),
  importFile: (auditName: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('import-file', auditName, controlId, appId),
  listEvidence: (auditName: string, controlId: string, appId: string) =>
    ipcRenderer.invoke('list-evidence', auditName, controlId, appId),
  saveNote: (auditName: string, controlId: string, appId: string, filename: string, note: string) =>
    ipcRenderer.invoke('save-note', auditName, controlId, appId, filename, note),
  deleteEvidence: (auditName: string, controlId: string, appId: string, filename: string) =>
    ipcRenderer.invoke('delete-evidence', auditName, controlId, appId, filename),
  getEvidencePath: (auditName: string, controlId: string, appId: string, filename: string) =>
    ipcRenderer.invoke('get-evidence-path', auditName, controlId, appId, filename),

  // Database
  testDbConnection: (config: unknown) =>
    ipcRenderer.invoke('test-db-connection', config),
  runDbQuery: (auditName: string, controlId: string, appId: string, config: unknown, query: string) =>
    ipcRenderer.invoke('run-db-query', auditName, controlId, appId, config, query),

  // Export
  exportAudit: (auditName: string) => ipcRenderer.invoke('export-audit', auditName),

  // Events
  onTriggerCapture: (callback: () => void) => {
    ipcRenderer.on('trigger-capture', callback);
    return () => ipcRenderer.removeListener('trigger-capture', callback);
  },
});
