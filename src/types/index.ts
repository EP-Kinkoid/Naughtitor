// --- Shared / kept types ---

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

// --- New entity types ---

export type AuthMethod = 'SSO' | 'LDAP' | 'Local' | 'OAuth' | 'Other';
export type EnvironmentType = 'Production' | 'UAT' | 'Development' | 'Staging' | 'Other';

export interface AppRecord {
  id: string;
  name: string;
  description: string;
  userBase: string;
  authMethod: AuthMethod;
  authMethodOther: string;
  authorizationMethod: string;
  provisioningProcess: string;
  environment: EnvironmentType;
  environmentOther: string;
  dbConfig?: DbConnectionConfig;
  createdAt: string;
  archived: boolean;
}

export interface ControlRecord {
  id: string;
  description: string;
  appIds: string[];
  createdAt: string;
  archived: boolean;
}

export interface AuditControlApp {
  controlId: string;
  appId: string;
  evidenceRequirements: EvidenceRequirement[];
}

export interface AuditRecord {
  id: string;
  name: string;
  controlApps: AuditControlApp[];
  createdAt: string;
  archived: boolean;
}

export interface Registry {
  applications: AppRecord[];
  controls: ControlRecord[];
  audits: AuditRecord[];
}

// --- API ---

export interface NaughtitorAPI {
  // Registry
  getRegistry(): Promise<Registry>;
  saveRegistry(data: Registry): Promise<void>;

  // Applications
  createApp(app: AppRecord): Promise<Registry>;
  updateApp(appId: string, updates: Partial<AppRecord>): Promise<Registry>;
  archiveApp(appId: string): Promise<Registry>;
  saveAppDbConfig(appId: string, config: DbConnectionConfig): Promise<Registry>;

  // Controls
  createControl(id: string, description: string): Promise<Registry>;
  updateControl(controlId: string, updates: Partial<ControlRecord>): Promise<Registry>;
  archiveControl(controlId: string): Promise<Registry>;
  linkAppToControl(controlId: string, appId: string): Promise<Registry>;
  unlinkAppFromControl(controlId: string, appId: string): Promise<Registry>;

  // Audits
  createAudit(name: string): Promise<Registry>;
  archiveAudit(auditId: string): Promise<Registry>;
  addAuditControlApp(auditId: string, controlId: string, appId: string): Promise<Registry>;
  removeAuditControlApp(auditId: string, controlId: string, appId: string): Promise<Registry>;

  // Evidence requirements (scoped to audit+control+app)
  addRequirement(auditId: string, controlId: string, appId: string, label: string, type: EvidenceType): Promise<Registry>;
  removeRequirement(auditId: string, controlId: string, appId: string, requirementId: string): Promise<Registry>;

  // Evidence operations
  captureScreenshot(auditId: string, controlId: string, appId: string): Promise<{ filename: string; timestamp: string }>;
  importFile(auditId: string, controlId: string, appId: string): Promise<{ filename: string; timestamp: string } | null>;
  listEvidence(auditId: string, controlId: string, appId: string): Promise<EvidenceItem[]>;
  saveNote(auditId: string, controlId: string, appId: string, filename: string, note: string): Promise<void>;
  archiveEvidence(auditId: string, controlId: string, appId: string, filename: string): Promise<void>;
  getEvidencePath(auditId: string, controlId: string, appId: string, filename: string): Promise<string>;
  listAllEvidenceForApp(appId: string): Promise<{ auditId: string; controlId: string; items: EvidenceItem[] }[]>;

  // Database operations
  testDbConnection(config: DbConnectionConfig): Promise<{ success: boolean; error?: string }>;
  runDbQuery(auditId: string, controlId: string, appId: string, config: DbConnectionConfig, query: string): Promise<{ filename: string; timestamp: string; result: DbQueryResult }>;

  // Export
  exportAudit(auditId: string): Promise<string | null>;

  // Events
  onTriggerCapture(callback: () => void): () => void;
}

declare global {
  interface Window {
    naughtitor: NaughtitorAPI;
  }
}
