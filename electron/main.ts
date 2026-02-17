import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { captureScreenshot } from './screenshot';
import * as archiver from 'archiver';

const NAUGHTITOR_DIR = path.join(app.getPath('home'), 'Naughtitor');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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

// --- IPC Handlers ---

ipcMain.handle('list-audits', async () => {
  ensureDir(NAUGHTITOR_DIR);
  const entries = fs.readdirSync(NAUGHTITOR_DIR, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
});

ipcMain.handle('create-audit', async (_event, auditName: string) => {
  const auditDir = path.join(NAUGHTITOR_DIR, auditName);
  ensureDir(auditDir);
  const metaPath = path.join(auditDir, 'audit.json');
  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(metaPath, JSON.stringify({ name: auditName, controls: [], createdAt: new Date().toISOString() }, null, 2));
  }
  return auditName;
});

ipcMain.handle('get-audit', async (_event, auditName: string) => {
  const metaPath = path.join(NAUGHTITOR_DIR, auditName, 'audit.json');
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
});

ipcMain.handle('save-audit', async (_event, auditName: string, data: unknown) => {
  const metaPath = path.join(NAUGHTITOR_DIR, auditName, 'audit.json');
  fs.writeFileSync(metaPath, JSON.stringify(data, null, 2));
});

ipcMain.handle('add-control', async (_event, auditName: string, controlId: string, description: string) => {
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  ensureDir(controlDir);
  const metaPath = path.join(NAUGHTITOR_DIR, auditName, 'audit.json');
  const audit = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  if (!audit.controls.find((c: { id: string }) => c.id === controlId)) {
    audit.controls.push({ id: controlId, description, createdAt: new Date().toISOString() });
    fs.writeFileSync(metaPath, JSON.stringify(audit, null, 2));
  }
  return audit;
});

ipcMain.handle('remove-control', async (_event, auditName: string, controlId: string) => {
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  if (fs.existsSync(controlDir)) {
    fs.rmSync(controlDir, { recursive: true });
  }
  const metaPath = path.join(NAUGHTITOR_DIR, auditName, 'audit.json');
  const audit = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  audit.controls = audit.controls.filter((c: { id: string }) => c.id !== controlId);
  fs.writeFileSync(metaPath, JSON.stringify(audit, null, 2));
  return audit;
});

ipcMain.handle('capture-screenshot', async (_event, auditName: string, controlId: string) => {
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  ensureDir(controlDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${timestamp}.png`;
  const filepath = path.join(controlDir, filename);
  await captureScreenshot(filepath);
  return { filename, timestamp: new Date().toISOString(), filepath };
});

ipcMain.handle('list-evidence', async (_event, auditName: string, controlId: string) => {
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  if (!fs.existsSync(controlDir)) return [];
  const files = fs.readdirSync(controlDir).filter(f => f.endsWith('.png')).sort();
  return files.map(filename => {
    const notePath = path.join(controlDir, filename.replace('.png', '.json'));
    let note = '';
    if (fs.existsSync(notePath)) {
      note = JSON.parse(fs.readFileSync(notePath, 'utf-8')).note || '';
    }
    const stat = fs.statSync(path.join(controlDir, filename));
    return {
      filename,
      timestamp: stat.mtime.toISOString(),
      note,
      path: path.join(controlDir, filename),
    };
  });
});

ipcMain.handle('save-note', async (_event, auditName: string, controlId: string, filename: string, note: string) => {
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  const notePath = path.join(controlDir, filename.replace('.png', '.json'));
  fs.writeFileSync(notePath, JSON.stringify({ note, updatedAt: new Date().toISOString() }, null, 2));
});

ipcMain.handle('delete-screenshot', async (_event, auditName: string, controlId: string, filename: string) => {
  const controlDir = path.join(NAUGHTITOR_DIR, auditName, controlId);
  const filePath = path.join(controlDir, filename);
  const notePath = path.join(controlDir, filename.replace('.png', '.json'));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  if (fs.existsSync(notePath)) fs.unlinkSync(notePath);
});

ipcMain.handle('get-screenshot-path', async (_event, auditName: string, controlId: string, filename: string) => {
  return path.join(NAUGHTITOR_DIR, auditName, controlId, filename);
});

ipcMain.handle('export-audit', async (_event, auditName: string) => {
  const auditDir = path.join(NAUGHTITOR_DIR, auditName);
  if (!fs.existsSync(auditDir)) throw new Error('Audit not found');

  const result = await dialog.showSaveDialog({
    defaultPath: `${auditName}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });

  if (result.canceled || !result.filePath) return null;

  return new Promise<string>((resolve, reject) => {
    const output = fs.createWriteStream(result.filePath!);
    const archive = archiver.default('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(result.filePath!));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(auditDir, auditName);
    archive.finalize();
  });
});
