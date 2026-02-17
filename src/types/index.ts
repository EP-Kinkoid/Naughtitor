export interface DbConnectionConfig {
  type: 'mysql' | 'mssql' | 'odbc';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface EvidenceRequirement {
  id: string;
  label: string;
  type: 'screenshot' | 'db-query' | 'file';
}

export interface Application {
  id: string;
  name: string;
  description: string;
  dbConfig?: DbConnectionConfig;
  evidenceRequirements: EvidenceRequirement[];
  createdAt: string;
}

export interface Control {
  id: string;
  description: string;
  applications: Application[];
  createdAt: string;
}

export interface AuditMeta {
  name: string;
  controls: Control[];
  createdAt: string;
}

export type EvidenceType = 'screenshot' | 'db-query' | 'file';

export interface EvidenceItem {
  filename: string;
  timestamp: string;
  note: string;
  path: string;
  type: EvidenceType;
  query?: string;
  rowCount?: number;
  originalName?: string;
  fileSize?: number;
}

export interface DbQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  query: string;
  executedAt: string;
}

export interface NaughtitorAPI {
  // Audit operations
  listAudits(): Promise<string[]>;
  createAudit(name: string): Promise<string>;
  getAudit(name: string): Promise<AuditMeta | null>;
  saveAudit(name: string, data: AuditMeta): Promise<void>;

  // Control operations
  addControl(auditName: string, controlId: string, description: string): Promise<AuditMeta>;
  removeControl(auditName: string, controlId: string): Promise<AuditMeta>;

  // Application operations
  addApplication(auditName: string, controlId: string, appId: string, name: string, description: string): Promise<AuditMeta>;
  removeApplication(auditName: string, controlId: string, appId: string): Promise<AuditMeta>;
  saveDbConfig(auditName: string, controlId: string, appId: string, config: DbConnectionConfig): Promise<void>;

  // Evidence requirements
  addRequirement(auditName: string, controlId: string, appId: string, label: string, type: EvidenceType): Promise<AuditMeta>;
  removeRequirement(auditName: string, controlId: string, appId: string, requirementId: string): Promise<AuditMeta>;

  // Evidence operations (all scoped to application)
  captureScreenshot(auditName: string, controlId: string, appId: string): Promise<{ filename: string; timestamp: string }>;
  importFile(auditName: string, controlId: string, appId: string): Promise<{ filename: string; timestamp: string } | null>;
  listEvidence(auditName: string, controlId: string, appId: string): Promise<EvidenceItem[]>;
  saveNote(auditName: string, controlId: string, appId: string, filename: string, note: string): Promise<void>;
  deleteEvidence(auditName: string, controlId: string, appId: string, filename: string): Promise<void>;
  getEvidencePath(auditName: string, controlId: string, appId: string, filename: string): Promise<string>;

  // Database operations
  testDbConnection(config: DbConnectionConfig): Promise<{ success: boolean; error?: string }>;
  runDbQuery(auditName: string, controlId: string, appId: string, config: DbConnectionConfig, query: string): Promise<{ filename: string; timestamp: string; result: DbQueryResult }>;

  // Export
  exportAudit(auditName: string): Promise<string | null>;

  // Events
  onTriggerCapture(callback: () => void): () => void;
}

declare global {
  interface Window {
    naughtitor: NaughtitorAPI;
  }
}
