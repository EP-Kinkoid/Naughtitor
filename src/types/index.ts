export interface Control {
  id: string;
  description: string;
  createdAt: string;
}

export interface AuditMeta {
  name: string;
  controls: Control[];
  createdAt: string;
}

export interface EvidenceItem {
  filename: string;
  timestamp: string;
  note: string;
  path: string;
}

export interface NaughtitorAPI {
  listAudits(): Promise<string[]>;
  createAudit(name: string): Promise<string>;
  getAudit(name: string): Promise<AuditMeta | null>;
  saveAudit(name: string, data: AuditMeta): Promise<void>;
  addControl(auditName: string, controlId: string, description: string): Promise<AuditMeta>;
  removeControl(auditName: string, controlId: string): Promise<AuditMeta>;
  captureScreenshot(auditName: string, controlId: string): Promise<{ filename: string; timestamp: string }>;
  listEvidence(auditName: string, controlId: string): Promise<EvidenceItem[]>;
  saveNote(auditName: string, controlId: string, filename: string, note: string): Promise<void>;
  deleteScreenshot(auditName: string, controlId: string, filename: string): Promise<void>;
  getScreenshotPath(auditName: string, controlId: string, filename: string): Promise<string>;
  exportAudit(auditName: string): Promise<string | null>;
  onTriggerCapture(callback: () => void): () => void;
}

declare global {
  interface Window {
    naughtitor: NaughtitorAPI;
  }
}
