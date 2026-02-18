import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { captureScreenshot } from './screenshot';
import { testConnection, runQuery } from './database';
import * as archiver from 'archiver';

const NAUGHTITOR_DIR = path.join(app.getPath('home'), 'Naughtitor');
const REGISTRY_PATH = path.join(NAUGHTITOR_DIR, 'registry.json');
const EVIDENCE_DIR = path.join(NAUGHTITOR_DIR, 'evidence');

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

// --- Write queue (single key for registry) ---

const writeQueues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeQueues.set(key, next);
  return next;
}

// --- Types (local mirror for main process) ---

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

interface AppRecord {
  id: string;
  name: string;
  description: string;
  userBase: string;
  authMethod: string;
  authMethodOther: string;
  authorizationMethod: string;
  provisioningProcess: string;
  environment: string;
  environmentOther: string;
  dbConfig?: DbConnectionConfig;
  createdAt: string;
  archived: boolean;
}

interface ControlRecord {
  id: string;
  description: string;
  appIds: string[];
  createdAt: string;
  archived: boolean;
}

interface AuditControlApp {
  controlId: string;
  appId: string;
  evidenceRequirements: EvidenceRequirement[];
}

interface AuditRecord {
  id: string;
  name: string;
  controlApps: AuditControlApp[];
  createdAt: string;
  archived: boolean;
}

interface Registry {
  applications: AppRecord[];
  controls: ControlRecord[];
  audits: AuditRecord[];
}

// --- Path helpers ---

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function evidenceDir(auditId: string, controlId: string, appId: string): string {
  return path.join(EVIDENCE_DIR, auditId, controlId, appId);
}

function emptyRegistry(): Registry {
  return { applications: [], controls: [], audits: [] };
}

async function loadRegistry(): Promise<Registry> {
  await ensureDir(NAUGHTITOR_DIR);
  return readJson<Registry>(REGISTRY_PATH, emptyRegistry());
}

async function saveRegistry(reg: Registry): Promise<void> {
  await ensureDir(NAUGHTITOR_DIR);
  await writeJson(REGISTRY_PATH, reg);
}

function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
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
// IPC Handlers - Registry
// =====================

ipcMain.handle('get-registry', async () => {
  return loadRegistry();
});

ipcMain.handle('save-registry', async (_event, data: Registry) => {
  return serialized('registry', async () => {
    await saveRegistry(data);
  });
});

// =====================
// IPC Handlers - Applications
// =====================

ipcMain.handle('create-app', async (_event, appData: AppRecord) => {
  validateName(appData.id, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    if (reg.applications.some(a => a.id === appData.id)) {
      throw new Error(`Application "${appData.id}" already exists`);
    }
    reg.applications.push(appData);
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('update-app', async (_event, appId: string, updates: Partial<AppRecord>) => {
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const app = reg.applications.find(a => a.id === appId);
    if (!app) throw new Error(`Application "${appId}" not found`);
    Object.assign(app, updates);
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('archive-app', async (_event, appId: string) => {
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const app = reg.applications.find(a => a.id === appId);
    if (!app) throw new Error(`Application "${appId}" not found`);
    app.archived = true;
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('save-app-db-config', async (_event, appId: string, config: DbConnectionConfig) => {
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const app = reg.applications.find(a => a.id === appId);
    if (!app) throw new Error(`Application "${appId}" not found`);
    app.dbConfig = config;
    await saveRegistry(reg);
    return reg;
  });
});

// =======================
// IPC Handlers - Controls
// =======================

ipcMain.handle('create-control', async (_event, id: string, description: string) => {
  validateName(id, 'Control ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    if (reg.controls.some(c => c.id === id)) {
      throw new Error(`Control "${id}" already exists`);
    }
    reg.controls.push({
      id,
      description,
      appIds: [],
      createdAt: new Date().toISOString(),
      archived: false,
    });
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('update-control', async (_event, controlId: string, updates: Partial<ControlRecord>) => {
  validateName(controlId, 'Control ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const control = reg.controls.find(c => c.id === controlId);
    if (!control) throw new Error(`Control "${controlId}" not found`);
    Object.assign(control, updates);
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('archive-control', async (_event, controlId: string) => {
  validateName(controlId, 'Control ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const control = reg.controls.find(c => c.id === controlId);
    if (!control) throw new Error(`Control "${controlId}" not found`);
    control.archived = true;
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('link-app-to-control', async (_event, controlId: string, appId: string) => {
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const control = reg.controls.find(c => c.id === controlId);
    if (!control) throw new Error(`Control "${controlId}" not found`);
    if (!reg.applications.some(a => a.id === appId)) throw new Error(`Application "${appId}" not found`);
    if (!control.appIds.includes(appId)) {
      control.appIds.push(appId);
      await saveRegistry(reg);
    }
    return reg;
  });
});

ipcMain.handle('unlink-app-from-control', async (_event, controlId: string, appId: string) => {
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const control = reg.controls.find(c => c.id === controlId);
    if (!control) throw new Error(`Control "${controlId}" not found`);
    control.appIds = control.appIds.filter(id => id !== appId);
    await saveRegistry(reg);
    return reg;
  });
});

// ============================
// IPC Handlers - Audits
// ============================

ipcMain.handle('create-audit', async (_event, name: string) => {
  validateName(name, 'Audit name');
  const id = slugify(name);
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    if (reg.audits.some(a => a.id === id)) {
      throw new Error(`Audit "${name}" already exists`);
    }
    reg.audits.push({
      id,
      name,
      controlApps: [],
      createdAt: new Date().toISOString(),
      archived: false,
    });
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('archive-audit', async (_event, auditId: string) => {
  validateName(auditId, 'Audit ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const audit = reg.audits.find(a => a.id === auditId);
    if (!audit) throw new Error(`Audit "${auditId}" not found`);
    audit.archived = true;
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('add-audit-control-app', async (_event, auditId: string, controlId: string, appId: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const audit = reg.audits.find(a => a.id === auditId);
    if (!audit) throw new Error(`Audit "${auditId}" not found`);
    const exists = audit.controlApps.some(ca => ca.controlId === controlId && ca.appId === appId);
    if (!exists) {
      audit.controlApps.push({ controlId, appId, evidenceRequirements: [] });
      await saveRegistry(reg);
    }
    return reg;
  });
});

ipcMain.handle('remove-audit-control-app', async (_event, auditId: string, controlId: string, appId: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const audit = reg.audits.find(a => a.id === auditId);
    if (!audit) throw new Error(`Audit "${auditId}" not found`);
    audit.controlApps = audit.controlApps.filter(ca => !(ca.controlId === controlId && ca.appId === appId));
    await saveRegistry(reg);
    return reg;
  });
});

// =================================
// IPC Handlers - Evidence Requirements
// =================================

ipcMain.handle('add-requirement', async (_event, auditId: string, controlId: string, appId: string, label: string, type: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const audit = reg.audits.find(a => a.id === auditId);
    if (!audit) throw new Error(`Audit "${auditId}" not found`);
    const ca = audit.controlApps.find(ca => ca.controlId === controlId && ca.appId === appId);
    if (!ca) throw new Error(`Control+App pair not found in audit`);
    const id = `req-${Date.now()}`;
    ca.evidenceRequirements.push({ id, label, type: type as 'screenshot' | 'db-query' | 'file' });
    await saveRegistry(reg);
    return reg;
  });
});

ipcMain.handle('remove-requirement', async (_event, auditId: string, controlId: string, appId: string, requirementId: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  return serialized('registry', async () => {
    const reg = await loadRegistry();
    const audit = reg.audits.find(a => a.id === auditId);
    if (!audit) throw new Error(`Audit "${auditId}" not found`);
    const ca = audit.controlApps.find(ca => ca.controlId === controlId && ca.appId === appId);
    if (!ca) throw new Error(`Control+App pair not found in audit`);
    ca.evidenceRequirements = ca.evidenceRequirements.filter(r => r.id !== requirementId);
    await saveRegistry(reg);
    return reg;
  });
});

// =========================
// IPC Handlers - Evidence
// =========================

ipcMain.handle('capture-screenshot', async (_event, auditId: string, controlId: string, appId: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const dir = evidenceDir(auditId, controlId, appId);
  await ensureDir(dir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.png`;
  await captureScreenshot(path.join(dir, filename));
  return { filename, timestamp: new Date().toISOString() };
});

ipcMain.handle('import-file', async (_event, auditId: string, controlId: string, appId: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const result = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  const sourcePath = result.filePaths[0];
  const originalName = path.basename(sourcePath).replace(/[^a-zA-Z0-9._\-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `file-${timestamp}-${originalName}`;
  const dir = evidenceDir(auditId, controlId, appId);
  await ensureDir(dir);
  await fs.copyFile(sourcePath, path.join(dir, filename));
  return { filename, timestamp: new Date().toISOString() };
});

ipcMain.handle('list-evidence', async (_event, auditId: string, controlId: string, appId: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const dir = evidenceDir(auditId, controlId, appId);
  if (!existsSync(dir)) return [];
  const allFiles = await fs.readdir(dir);
  const archivedSet = new Set(
    allFiles.filter(f => f.endsWith('.archived')).map(f => f.replace('.archived', ''))
  );
  const results = [];
  for (const filename of allFiles.sort()) {
    if (filename.endsWith('.archived')) continue;
    if (archivedSet.has(filename)) continue;

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
      const txtPath = path.join(dir, filename.replace('.csv', '.txt'));
      try { query = await fs.readFile(txtPath, 'utf-8'); } catch { /* ok */ }
      try {
        const csv = await fs.readFile(filePath, 'utf-8');
        const lines = csv.split('\n').filter(l => l.trim());
        rowCount = Math.max(0, lines.length - 1);
      } catch { /* ok */ }
    } else if (filename.startsWith('file-')) {
      if (filename.endsWith('.json')) continue;
      type = 'file';
      const parts = filename.match(/^file-[^-]+-(.+)$/);
      originalName = parts ? parts[1] : filename;
    } else {
      continue;
    }

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

ipcMain.handle('save-note', async (_event, auditId: string, controlId: string, appId: string, filename: string, note: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  validateName(filename, 'Filename');
  const dir = evidenceDir(auditId, controlId, appId);
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

ipcMain.handle('archive-evidence', async (_event, auditId: string, controlId: string, appId: string, filename: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  validateName(filename, 'Filename');
  const dir = evidenceDir(auditId, controlId, appId);
  const markerPath = path.join(dir, filename + '.archived');
  await fs.writeFile(markerPath, new Date().toISOString());
});

ipcMain.handle('get-evidence-path', async (_event, auditId: string, controlId: string, appId: string, filename: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  validateName(filename, 'Filename');
  return path.join(evidenceDir(auditId, controlId, appId), filename);
});

ipcMain.handle('list-all-evidence-for-app', async (_event, appId: string) => {
  validateName(appId, 'Application ID');
  if (!existsSync(EVIDENCE_DIR)) return [];
  const results: { auditId: string; controlId: string; items: unknown[] }[] = [];
  const auditDirs = await fs.readdir(EVIDENCE_DIR, { withFileTypes: true });
  for (const auditEntry of auditDirs) {
    if (!auditEntry.isDirectory()) continue;
    const auditPath = path.join(EVIDENCE_DIR, auditEntry.name);
    const controlDirs = await fs.readdir(auditPath, { withFileTypes: true });
    for (const controlEntry of controlDirs) {
      if (!controlEntry.isDirectory()) continue;
      const appDir = path.join(auditPath, controlEntry.name, appId);
      if (!existsSync(appDir)) continue;
      const allFiles = await fs.readdir(appDir);
      const archivedSet = new Set(
        allFiles.filter(f => f.endsWith('.archived')).map(f => f.replace('.archived', ''))
      );
      const items = [];
      for (const filename of allFiles.sort()) {
        if (filename.endsWith('.archived')) continue;
        if (archivedSet.has(filename)) continue;
        const filePath = path.join(appDir, filename);
        const stat = await fs.stat(filePath);
        let type: 'screenshot' | 'db-query' | 'file';
        let query: string | undefined;
        let rowCount: number | undefined;
        let originalName: string | undefined;

        if (filename.startsWith('screenshot-') && filename.endsWith('.png')) {
          type = 'screenshot';
        } else if (filename.startsWith('db-query-') && filename.endsWith('.csv')) {
          type = 'db-query';
          const txtPath = path.join(appDir, filename.replace('.csv', '.txt'));
          try { query = await fs.readFile(txtPath, 'utf-8'); } catch { /* ok */ }
          try {
            const csv = await fs.readFile(filePath, 'utf-8');
            const lines = csv.split('\n').filter(l => l.trim());
            rowCount = Math.max(0, lines.length - 1);
          } catch { /* ok */ }
        } else if (filename.startsWith('file-')) {
          if (filename.endsWith('.json')) continue;
          type = 'file';
          const parts = filename.match(/^file-[^-]+-(.+)$/);
          originalName = parts ? parts[1] : filename;
        } else {
          continue;
        }

        let noteSidecar: string;
        if (type === 'screenshot') {
          noteSidecar = path.join(appDir, filename.replace('.png', '.json'));
        } else if (type === 'db-query') {
          noteSidecar = path.join(appDir, filename.replace('.csv', '.note.json'));
        } else {
          noteSidecar = path.join(appDir, filename + '.json');
        }
        const noteData = await readJson<{ note?: string }>(noteSidecar, {});

        items.push({
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
      if (items.length > 0) {
        results.push({ auditId: auditEntry.name, controlId: controlEntry.name, items });
      }
    }
  }
  return results;
});

// =========================
// IPC Handlers - Database
// =========================

ipcMain.handle('test-db-connection', async (_event, config: DbConnectionConfig) => {
  return testConnection(config);
});

ipcMain.handle('run-db-query', async (_event, auditId: string, controlId: string, appId: string, config: DbConnectionConfig, query: string) => {
  validateName(auditId, 'Audit ID');
  validateName(controlId, 'Control ID');
  validateName(appId, 'Application ID');
  const dir = evidenceDir(auditId, controlId, appId);
  await ensureDir(dir);
  const result = await runQuery(config, query);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `db-query-${timestamp}`;

  await fs.writeFile(path.join(dir, `${baseName}.txt`), query, 'utf-8');

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

ipcMain.handle('export-audit', async (_event, auditId: string) => {
  validateName(auditId, 'Audit ID');
  const auditDir = path.join(EVIDENCE_DIR, auditId);
  if (!existsSync(auditDir)) throw new Error('Audit evidence directory not found');

  const result = await dialog.showSaveDialog({
    defaultPath: `${auditId}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePath) return null;

  return new Promise<string>((resolve, reject) => {
    const output = createWriteStream(result.filePath!);
    const archive = archiver.default('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(result.filePath!));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(auditDir, auditId);
    archive.finalize();
  });
});
