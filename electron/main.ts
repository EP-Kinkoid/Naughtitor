import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { captureScreenshot } from './screenshot';
import { testConnection, runQuery } from './database';
import * as archiver from 'archiver';

const NAUGHTITOR_DIR = path.join(app.getPath('home'), 'Naughtitor');

// --- Input validation ---

const SAFE_NAME_RE = /^[a-zA-Z0-9 _\-\.]+$/;

function validateName(name: string, label: string): void {
  if (!name || name.length > 200) {
    throw new Error(`${label} must be 1-200 characters`);
  }
  if (!SAFE_NAME_RE.test(name)) {
    throw new Error(`${label} contains invalid characters. Use letters, numbers, spaces, hyphens, underscores, and dots only.`);
  }
  if (name === '.' || name === '..' || name.includes('..')) {
    throw new Error(`${label} cannot contain path traversal sequences`);
  }
}

// --- Safe JSON helpers ---

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, filePath);
}

// --- Write queue per audit ---

const writeQueues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeQueues.set(key, next);
  return next;
}

// --- Types ---

interface EvidenceRequirement {
  id: string;
  label: string;
  type: 'screenshot' | 'db-query' | 'file';
}

interface DbConnectionConfig {
  type: 'mysql' | 'mssql' | 'odbc';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface Application {
  id: string;
  name: string;
  description: string;
  dbConfig?: DbConnectionConfig;
  evidenceRequirements: EvidenceRequirement[];
  createdAt: string;
}

interface AuditMeta {
  name: string;
  controls: { id: string; description: string; applications: Application[]; createdAt: string }[];
  createdAt: string;
}

// --- Path helpers ---

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function auditMetaPath(auditName: string): string {
  return path.join(NAUGHTITOR_DIR, auditName, 'audit.json');
}

function evidenceDir(auditName: string, controlId: string, appId: string): string {
  return path.join(NAUGHTITOR_DIR, auditName, controlId, appId);
}

function emptyAudit(name: string): AuditMeta {
  return { name, controls: [], createdAt: new Date().toISOString() };
}

function findControl(audit: AuditMeta, controlId: string) {
  return audit.controls.find(c => c.id === controlId);
}

function findApp(audit: AuditMeta, controlId: string, appId: string) {
  const control = findControl(audit, controlId);
  return control?.applications.find(a => a.id === appId);
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// --- Window ---

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

app.whenReady().then(() => {
  const win = createWindow();
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    win.webContents.send('trigger-capture');
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

// =====================
// IPC Handlers - Audits
// =====================

ipcMain.handle('list-audits', async () => {
  await ensureDir(NAUGHTITOR_DIR);
  const entries = await fs.readdir(NAUGHTITOR_DIR, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
});

ipcMain.handle('create-audit', async (_event, auditName: string) => {
  validateName(auditName, 'Audit name');
  await ensureDir(path.join(NAUGHTITOR_DIR, auditName));
  const metaPath = auditMetaPath(auditName);
  if (!existsSync(metaPath)) {
    await writeJson(metaPath, emptyAudit(auditName));
  }
  return auditName;
});

ipcMain.handle('get-audit', async (_event, auditName: string) => {
  validateName(auditName, 'Audit name');
  const metaPath = auditMetaPath(auditName);
  if (!existsSync(metaPath)) return null;
  return readJson<AuditMeta | null>(metaPath, null);
});

ipcMain.handle('save-audit', async (_event, auditName: string, data: unknown) => {
  validateName(auditName, 'Audit name');
  return serialized(auditName, () => writeJson(auditMetaPath(auditName), data));
});

// =======================
// IPC Handlers - Controls
// =======================

ipcMain.handle('add-control', async (_event, auditName: string, controlId: string, description: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  return serialized(auditName, async () => {
    await ensureDir(path.join(NAUGHTITOR_DIR, auditName, controlId));
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, emptyAudit(auditName));
    if (!findControl(audit, controlId)) {
      audit.controls.push({ id: controlId, description, applications: [], createdAt: new Date().toISOString() });
      await writeJson(metaPath, audit);
    }
    return audit;
  });
});

ipcMain.handle('remove-control', async (_event, auditName: string, controlId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  return serialized(auditName, async () => {
    const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
    if (existsSync(controlDir)) await fs.rm(controlDir, { recursive: true });
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, emptyAudit(auditName));
    audit.controls = audit.controls.filter(c => c.id !== controlId);
    await writeJson(metaPath, audit);
    return audit;
  });
});

// ============================
// IPC Handlers - Applications
// ============================

ipcMain.handle('add-application', async (_event, auditName: string, controlId: string, appId: string, name: string, description: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized(auditName, async () => {
    await ensureDir(evidenceDir(auditName, controlId, appId));
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, emptyAudit(auditName));
    const control = findControl(audit, controlId);
    if (!control) throw new Error(`Control ${controlId} not found`);
    if (!findApp(audit, controlId, appId)) {
      control.applications.push({ id: appId, name, description, evidenceRequirements: [], createdAt: new Date().toISOString() });
      await writeJson(metaPath, audit);
    }
    return audit;
  });
});

ipcMain.handle('remove-application', async (_event, auditName: string, controlId: string, appId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized(auditName, async () => {
    const appDir = evidenceDir(auditName, controlId, appId);
    if (existsSync(appDir)) await fs.rm(appDir, { recursive: true });
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, emptyAudit(auditName));
    const control = findControl(audit, controlId);
    if (control) {
      control.applications = control.applications.filter(a => a.id !== appId);
      await writeJson(metaPath, audit);
    }
    return audit;
  });
});

ipcMain.handle('save-db-config', async (_event, auditName: string, controlId: string, appId: string, config: DbConnectionConfig) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized(auditName, async () => {
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, emptyAudit(auditName));
    const application = findApp(audit, controlId, appId);
    if (!application) throw new Error(`Application ${appId} not found`);
    application.dbConfig = config;
    await writeJson(metaPath, audit);
  });
});

// =================================
// IPC Handlers - Evidence Requirements
// =================================

ipcMain.handle('add-requirement', async (_event, auditName: string, controlId: string, appId: string, label: string, type: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized(auditName, async () => {
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, emptyAudit(auditName));
    const application = findApp(audit, controlId, appId);
    if (!application) throw new Error(`Application ${appId} not found`);
    const id = `req-${Date.now()}`;
    application.evidenceRequirements.push({ id, label, type: type as 'screenshot' | 'db-query' | 'file' });
    await writeJson(metaPath, audit);
    return audit;
  });
});

ipcMain.handle('remove-requirement', async (_event, auditName: string, controlId: string, appId: string, requirementId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized(auditName, async () => {
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, emptyAudit(auditName));
    const application = findApp(audit, controlId, appId);
    if (!application) throw new Error(`Application ${appId} not found`);
    application.evidenceRequirements = application.evidenceRequirements.filter(r => r.id !== requirementId);
    await writeJson(metaPath, audit);
    return audit;
  });
});

// =========================
// IPC Handlers - Evidence
// =========================

ipcMain.handle('capture-screenshot', async (_event, auditName: string, controlId: string, appId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const dir = evidenceDir(auditName, controlId, appId);
  await ensureDir(dir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.png`;
  await captureScreenshot(path.join(dir, filename));
  return { filename, timestamp: new Date().toISOString() };
});

ipcMain.handle('import-file', async (_event, auditName: string, controlId: string, appId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const result = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  const sourcePath = result.filePaths[0];
  const originalName = path.basename(sourcePath).replace(/[^a-zA-Z0-9._\-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `file-${timestamp}-${originalName}`;
  const dir = evidenceDir(auditName, controlId, appId);
  await ensureDir(dir);
  await fs.copyFile(sourcePath, path.join(dir, filename));
  return { filename, timestamp: new Date().toISOString() };
});

ipcMain.handle('list-evidence', async (_event, auditName: string, controlId: string, appId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const dir = evidenceDir(auditName, controlId, appId);
  if (!existsSync(dir)) return [];
  const allFiles = await fs.readdir(dir);
  const results = [];
  for (const filename of allFiles.sort()) {
    const filePath = path.join(dir, filename);
    const stat = await fs.stat(filePath);
    let type: 'screenshot' | 'db-query' | 'file';
    let query: string | undefined;
    let rowCount: number | undefined;
    let originalName: string | undefined;

    if (filename.startsWith('screenshot-') && filename.endsWith('.png')) {
      type = 'screenshot';
    } else if (filename.startsWith('db-query-') && filename.endsWith('.csv')) {
      type = 'db-query';
      // Read paired .txt file for query text
      const txtPath = path.join(dir, filename.replace('.csv', '.txt'));
      try { query = await fs.readFile(txtPath, 'utf-8'); } catch { /* ok */ }
      // Count CSV data rows (total lines minus header)
      try {
        const csv = await fs.readFile(filePath, 'utf-8');
        const lines = csv.split('\n').filter(l => l.trim());
        rowCount = Math.max(0, lines.length - 1);
      } catch { /* ok */ }
    } else if (filename.startsWith('file-')) {
      // Skip note sidecars
      if (filename.endsWith('.json')) continue;
      type = 'file';
      const parts = filename.match(/^file-[^-]+-(.+)$/);
      originalName = parts ? parts[1] : filename;
    } else {
      // Skip sidecar .json, .txt, and other non-evidence files
      continue;
    }

    // Read note sidecar
    let noteSidecar: string;
    if (type === 'screenshot') {
      noteSidecar = path.join(dir, filename.replace('.png', '.json'));
    } else if (type === 'db-query') {
      noteSidecar = path.join(dir, filename.replace('.csv', '.note.json'));
    } else {
      noteSidecar = path.join(dir, filename + '.json');
    }
    const noteData = await readJson<{ note?: string }>(noteSidecar, {});

    results.push({
      filename,
      timestamp: stat.mtime.toISOString(),
      note: noteData.note || '',
      path: filePath,
      type,
      query,
      rowCount,
      originalName,
      fileSize: stat.size,
    });
  }
  return results;
});

ipcMain.handle('save-note', async (_event, auditName: string, controlId: string, appId: string, filename: string, note: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  validateName(filename, 'Filename');
  const dir = evidenceDir(auditName, controlId, appId);
  let notePath: string;
  if (filename.startsWith('screenshot-')) {
    notePath = path.join(dir, filename.replace('.png', '.json'));
  } else if (filename.startsWith('db-query-')) {
    notePath = path.join(dir, filename.replace('.csv', '.note.json'));
  } else {
    notePath = path.join(dir, filename + '.json');
  }
  await writeJson(notePath, { note, updatedAt: new Date().toISOString() });
});

ipcMain.handle('delete-evidence', async (_event, auditName: string, controlId: string, appId: string, filename: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  validateName(filename, 'Filename');
  const dir = evidenceDir(auditName, controlId, appId);
  const filePath = path.join(dir, filename);
  try { await fs.unlink(filePath); } catch { /* already gone */ }
  // Clean up associated files
  if (filename.startsWith('screenshot-')) {
    try { await fs.unlink(path.join(dir, filename.replace('.png', '.json'))); } catch { /* ok */ }
  } else if (filename.startsWith('db-query-')) {
    // Delete paired .txt and .note.json
    try { await fs.unlink(path.join(dir, filename.replace('.csv', '.txt'))); } catch { /* ok */ }
    try { await fs.unlink(path.join(dir, filename.replace('.csv', '.note.json'))); } catch { /* ok */ }
  } else {
    try { await fs.unlink(path.join(dir, filename + '.json')); } catch { /* ok */ }
  }
});

ipcMain.handle('get-evidence-path', async (_event, auditName: string, controlId: string, appId: string, filename: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  validateName(filename, 'Filename');
  return path.join(evidenceDir(auditName, controlId, appId), filename);
});

// =========================
// IPC Handlers - Database
// =========================

ipcMain.handle('test-db-connection', async (_event, config: DbConnectionConfig) => {
  return testConnection(config);
});

ipcMain.handle('run-db-query', async (_event, auditName: string, controlId: string, appId: string, config: DbConnectionConfig, query: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const dir = evidenceDir(auditName, controlId, appId);
  await ensureDir(dir);
  const result = await runQuery(config, query);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `db-query-${timestamp}`;

  // Save query as .txt
  await fs.writeFile(path.join(dir, `${baseName}.txt`), query, 'utf-8');

  // Save results as .csv
  const csvLines: string[] = [];
  if (result.columns.length > 0) {
    csvLines.push(result.columns.map(csvEscape).join(','));
    for (const row of result.rows) {
      csvLines.push(result.columns.map(col => csvEscape(String(row[col] ?? ''))).join(','));
    }
  }
  const csvFilename = `${baseName}.csv`;
  await fs.writeFile(path.join(dir, csvFilename), csvLines.join('\n'), 'utf-8');

  return { filename: csvFilename, timestamp: new Date().toISOString(), result };
});

// =========================
// IPC Handlers - Export
// =========================

ipcMain.handle('export-audit', async (_event, auditName: string) => {
  validateName(auditName, 'Audit name');
  const auditDir = path.join(NAUGHTITOR_DIR, auditName);
  if (!existsSync(auditDir)) throw new Error('Audit not found');

  const result = await dialog.showSaveDialog({
    defaultPath: `${auditName}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePath) return null;

  return new Promise<string>((resolve, reject) => {
    const output = createWriteStream(result.filePath!);
    const archive = archiver.default('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(result.filePath!));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(auditDir, auditName);
    archive.finalize();
  });
});
