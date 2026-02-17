import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { captureScreenshot } from './screenshot';
import * as archiver from 'archiver';

const NAUGHTITOR_DIR = path.join(app.getPath('home'), 'Naughtitor');

// --- Input validation (Bug #1: path traversal) ---

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

// --- Safe JSON parsing (Bug #2: unhandled parse errors) ---

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

// --- Write queue per audit (Bug #3: race conditions) ---

const writeQueues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeQueues.set(key, next);
  return next;
}

// --- Helpers ---

interface AuditMeta {
  name: string;
  controls: { id: string; description: string; createdAt: string }[];
  createdAt: string;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function auditMetaPath(auditName: string): string {
  return path.join(NAUGHTITOR_DIR, auditName, 'audit.json');
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

// --- IPC Handlers (all async, Bug #4: no more sync I/O) ---

ipcMain.handle('list-audits', async () => {
  await ensureDir(NAUGHTITOR_DIR);
  const entries = await fs.readdir(NAUGHTITOR_DIR, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
});

ipcMain.handle('create-audit', async (_event, auditName: string) => {
  validateName(auditName, 'Audit name');
  const auditDir = path.join(NAUGHTITOR_DIR, auditName);
  await ensureDir(auditDir);
  const metaPath = auditMetaPath(auditName);
  if (!existsSync(metaPath)) {
    const meta: AuditMeta = { name: auditName, controls: [], createdAt: new Date().toISOString() };
    await writeJson(metaPath, meta);
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
  const metaPath = auditMetaPath(auditName);
  return serialized(auditName, () => writeJson(metaPath, data));
});

ipcMain.handle('add-control', async (_event, auditName: string, controlId: string, description: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  return serialized(auditName, async () => {
    const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
    await ensureDir(controlDir);
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, { name: auditName, controls: [], createdAt: new Date().toISOString() });
    if (!audit.controls.find(c => c.id === controlId)) {
      audit.controls.push({ id: controlId, description, createdAt: new Date().toISOString() });
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
    if (existsSync(controlDir)) {
      await fs.rm(controlDir, { recursive: true });
    }
    const metaPath = auditMetaPath(auditName);
    const audit = await readJson<AuditMeta>(metaPath, { name: auditName, controls: [], createdAt: new Date().toISOString() });
    audit.controls = audit.controls.filter(c => c.id !== controlId);
    await writeJson(metaPath, audit);
    return audit;
  });
});

ipcMain.handle('capture-screenshot', async (_event, auditName: string, controlId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  await ensureDir(controlDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.png`;
  const filepath = path.join(controlDir, filename);
  await captureScreenshot(filepath);
  return { filename, timestamp: new Date().toISOString(), filepath };
});

ipcMain.handle('list-evidence', async (_event, auditName: string, controlId: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  if (!existsSync(controlDir)) return [];
  const allFiles = await fs.readdir(controlDir);
  const pngFiles = allFiles.filter(f => f.endsWith('.png')).sort();
  const results = [];
  for (const filename of pngFiles) {
    const notePath = path.join(controlDir, filename.replace('.png', '.json'));
    const noteData = await readJson<{ note?: string }>(notePath, {});
    const stat = await fs.stat(path.join(controlDir, filename));
    results.push({
      filename,
      timestamp: stat.mtime.toISOString(),
      note: noteData.note || '',
      path: path.join(controlDir, filename),
    });
  }
  return results;
});

ipcMain.handle('save-note', async (_event, auditName: string, controlId: string, filename: string, note: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(filename, 'Filename');
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  const notePath = path.join(controlDir, filename.replace('.png', '.json'));
  await writeJson(notePath, { note, updatedAt: new Date().toISOString() });
});

ipcMain.handle('delete-screenshot', async (_event, auditName: string, controlId: string, filename: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(filename, 'Filename');
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  const filePath = path.join(controlDir, filename);
  const notePath = path.join(controlDir, filename.replace('.png', '.json'));
  try { await fs.unlink(filePath); } catch { /* already gone */ }
  try { await fs.unlink(notePath); } catch { /* no note file */ }
});

ipcMain.handle('get-screenshot-path', async (_event, auditName: string, controlId: string, filename: string) => {
  validateName(auditName, 'Audit name');
  validateName(controlId, 'Control ID');
  validateName(filename, 'Filename');
  return path.join(NAUGHTITOR_DIR, auditName, controlId, filename);
});

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
