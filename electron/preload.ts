import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('naughtitor', {
  listAudits: () => ipcRenderer.invoke('list-audits'),
  createAudit: (name: string) => ipcRenderer.invoke('create-audit', name),
  getAudit: (name: string) => ipcRenderer.invoke('get-audit', name),
  saveAudit: (name: string, data: unknown) => ipcRenderer.invoke('save-audit', name, data),
  addControl: (auditName: string, controlId: string, description: string) =>
    ipcRenderer.invoke('add-control', auditName, controlId, description),
  removeControl: (auditName: string, controlId: string) =>
    ipcRenderer.invoke('remove-control', auditName, controlId),
  captureScreenshot: (auditName: string, controlId: string) =>
    ipcRenderer.invoke('capture-screenshot', auditName, controlId),
  listEvidence: (auditName: string, controlId: string) =>
    ipcRenderer.invoke('list-evidence', auditName, controlId),
  saveNote: (auditName: string, controlId: string, filename: string, note: string) =>
    ipcRenderer.invoke('save-note', auditName, controlId, filename, note),
  deleteScreenshot: (auditName: string, controlId: string, filename: string) =>
    ipcRenderer.invoke('delete-screenshot', auditName, controlId, filename),
  getScreenshotPath: (auditName: string, controlId: string, filename: string) =>
    ipcRenderer.invoke('get-screenshot-path', auditName, controlId, filename),
  exportAudit: (auditName: string) => ipcRenderer.invoke('export-audit', auditName),
  onTriggerCapture: (callback: () => void) => {
    ipcRenderer.on('trigger-capture', callback);
    return () => ipcRenderer.removeListener('trigger-capture', callback);
  },
});
