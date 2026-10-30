/**
 * SWC Selakui, offline desktop app.
 * Everything stays on this PC: %APPDATA%\SWC Selakui\SWC data (data.json, photos, backups).
 */
'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { createRuntime } = require('./gas-runtime');

const APP_TITLE = 'Staff Welfare Committee, TCV School Selakui';
const KEEP_AUTO_BACKUPS = 14;

app.setName('SWC Selakui');
if (process.env.SWC_DATA_DIR) app.setPath('userData', process.env.SWC_DATA_DIR);

let rt = null;
let win = null;
let currentToken = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
}

function dataDir() { return path.join(app.getPath('userData'), 'SWC data'); }
function backupDir() { const d = path.join(dataDir(), 'backups'); fs.mkdirSync(d, { recursive: true }); return d; }
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

async function start() {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(false));

  try {
    rt = createRuntime(path.join(__dirname, 'Code.gs'), dataDir());
  } catch (err) {
    dialog.showErrorBox('SWC Selakui could not open its data', String(err && err.message || err) +
      '\n\nData folder: ' + dataDir() + '\n\nYou can restore a backup by copying it back, or ask for help.');
    app.quit();
    return;
  }

  ipcMain.handle('swc-call', (e, fn, args) => {
    if (!win || e.sender !== win.webContents) return { ok: false, message: 'Not allowed.' };
    args = Array.isArray(args) ? args : [];
    try {
      const value = rt.call(fn, args);
      if (fn === 'login' && value && value.token) currentToken = value.token;
      else if (fn === 'logout') currentToken = null;
      else if (typeof args[0] === 'string') currentToken = args[0];
      return { ok: true, value };
    } catch (err) {
      return { ok: false, message: String(err && err.message || err) };
    }
  });

  ipcMain.handle('swc-info', e => {
    if (!win || e.sender !== win.webContents) return null;
    return { version: app.getVersion(), lastBackup: rt.getMeta('lastBackup') || null, dataDir: dataDir() };
  });
  ipcMain.handle('swc-action', async (e, name, arg) => {
    if (!win || e.sender !== win.webContents) return false;
    if (name === 'backup') return backupNow();
    if (name === 'pdf') return savePdf(String(arg || 'SWC report'));
    if (name === 'update') return installUpdate();
    return false;
  });

  createWindow();
  buildMenu();

  const pin = rt.setup();
  if (pin) await firstRun(pin);
  autoBackup();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 760, minHeight: 560,
    title: APP_TITLE,
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f6f1e8',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });
  const indexUrl = require('url').pathToFileURL(path.join(__dirname, 'ui', 'index.html')).href;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (url.split('#')[0] !== indexUrl) e.preventDefault(); });
  win.on('page-title-updated', e => e.preventDefault());
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL(indexUrl);
}

/* ---------- First start and admin PIN ---------- */

function newRecoveryCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += abc[crypto.randomInt(abc.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}
function hashCode(code, salt) { return crypto.createHash('sha256').update(salt + ':' + code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex'); }
function setRecoveryCode() {
  const code = newRecoveryCode();
  const salt = crypto.randomUUID();
  rt.setMeta('recovery', { salt, hash: hashCode(code, salt) });
  return code;
}

async function showAdminDetails(heading, pin, code) {
  const text = 'Staff ID:  admin\nTemporary PIN:  ' + pin + (code ? '\nRecovery code:  ' + code : '') +
    '\n\nSign in with these. The app will ask you to choose your own PIN.' +
    (code ? '\n\nKeep the recovery code somewhere safe, away from this PC. It is the only way to reset the admin PIN if it is forgotten (Help menu, Reset admin PIN).' : '');
  for (;;) {
    const r = await dialog.showMessageBox(win, {
      type: 'info', title: 'SWC Selakui', message: heading, detail: text,
      buttons: ['Save to a text file…', 'I have written these down'], defaultId: 1, cancelId: 1, noLink: true
    });
    if (r.response !== 0) return;
    const s = await dialog.showSaveDialog(win, {
      title: 'Save admin details', defaultPath: path.join(app.getPath('documents'), 'SWC admin details.txt'),
      filters: [{ name: 'Text', extensions: ['txt'] }]
    });
    if (!s.canceled && s.filePath) {
      fs.writeFileSync(s.filePath, 'SWC Selakui desktop app\r\n' + heading + '\r\n\r\n' + text.replace(/\n/g, '\r\n') + '\r\n');
      await dialog.showMessageBox(win, { type: 'info', message: 'Saved.', detail: 'Print it or copy it to a safe place, then delete it from this PC.' });
      return;
    }
  }
}

async function firstRun(pin) {
  const code = setRecoveryCode();
  await showAdminDetails('Welcome. The app is ready on this PC.', pin, code);
}

async function resetAdmin() {
  const rec = rt.getMeta('recovery');
  if (!rec) { dialog.showMessageBox(win, { type: 'warning', message: 'No recovery code is set on this PC.' }); return; }
  const code = await askText('Reset admin PIN', 'Type the recovery code you were given when the app was first set up (for example ABCD-1234).');
  if (code === null) return;
  if (hashCode(code, rec.salt) !== rec.hash) {
    dialog.showMessageBox(win, { type: 'error', message: 'That recovery code is not right.' });
    return;
  }
  const pin = rt.resetAdminPin();
  const newCode = setRecoveryCode();
  currentToken = null;
  win.webContents.reload();
  await showAdminDetails('The admin PIN has been reset. A new recovery code was made, and the old one no longer works.', pin, newCode);
}

/** A small window with one text box. Resolves to the text, or null if cancelled. */
function askText(title, label) {
  return new Promise(resolve => {
    const p = new BrowserWindow({
      parent: win, modal: true, width: 460, height: 230, resizable: false, minimizable: false, maximizable: false,
      title, autoHideMenuBar: true, backgroundColor: '#f6f1e8',
      webPreferences: { preload: path.join(__dirname, 'prompt-preload.js'), contextIsolation: true, sandbox: true }
    });
    p.setMenu(null);
    let answer = null;
    const onAnswer = (e, v) => { if (e.sender === p.webContents) { answer = typeof v === 'string' ? v : null; p.close(); } };
    ipcMain.on('prompt-answer', onAnswer);
    p.on('closed', () => { ipcMain.removeListener('prompt-answer', onAnswer); resolve(answer); });
    p.loadFile(path.join(__dirname, 'ui', 'prompt.html'), { query: { label } });
  });
}

/* ---------- Backups ---------- */

function requireAdmin() {
  let user = null;
  try { user = currentToken ? rt.call('whoAmI', [currentToken]) : null; } catch (e) { user = null; }
  if (user && user.role === 'admin') return true;
  dialog.showMessageBox(win, { type: 'info', message: 'Please sign in as the admin first.', detail: 'Backups and exports hold private reports, so only the admin can make them.' });
  return false;
}

function writeBackup(file) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rt.snapshot()));
  fs.renameSync(tmp, file);
}

function autoBackup() {
  try {
    const dir = backupDir();
    const file = path.join(dir, 'auto-' + today() + '.swcbackup');
    if (!fs.existsSync(file)) writeBackup(file);
    fs.readdirSync(dir).filter(f => /^auto-.*\.swcbackup$/.test(f)).sort().reverse().slice(KEEP_AUTO_BACKUPS)
      .forEach(f => fs.unlinkSync(path.join(dir, f)));
  } catch (err) {
    console.error('Auto backup failed', err);
  }
}

async function backupNow() {
  if (!requireAdmin()) return false;
  const s = await dialog.showSaveDialog(win, {
    title: 'Save a backup (a USB drive is best)',
    defaultPath: path.join(app.getPath('documents'), 'SWC backup ' + today() + '.swcbackup'),
    filters: [{ name: 'SWC backup', extensions: ['swcbackup'] }]
  });
  if (s.canceled || !s.filePath) return false;
  try {
    writeBackup(s.filePath);
    rt.setMeta('lastBackup', new Date().toISOString());
    await dialog.showMessageBox(win, { type: 'info', message: 'Backup saved.', detail: s.filePath + '\n\nIt holds everything, photos included. Keep it somewhere safe: it has private dispute reports.' });
    return true;
  } catch (err) {
    dialog.showErrorBox('Backup failed', String(err.message || err));
    return false;
  }
}

/* ---------- Save as PDF ---------- */

async function savePdf(name) {
  const safe = name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'SWC report';
  const s = await dialog.showSaveDialog(win, {
    title: 'Save as PDF', defaultPath: path.join(app.getPath('documents'), safe + '.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (s.canceled || !s.filePath) return false;
  try {
    const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(s.filePath, pdf);
    shell.openPath(s.filePath);
    return true;
  } catch (err) {
    dialog.showErrorBox('Could not save the PDF', String(err.message || err));
    return false;
  }
}

/* ---------- Updates from a zip file ---------- */

/** Reads the files in a .zip (stored or deflated entries). Returns [{ name, data }]. */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This is not a zip file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('The zip file is damaged.');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8').replace(/\\/g, '/');
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.slice(start, start + size);
    if (method !== 0 && method !== 8) throw new Error('The zip file uses a packing method the app cannot read.');
    out.push({ name, data: method === 0 ? raw : zlib.inflateRawSync(raw) });
  }
  return out;
}

function newer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

async function installUpdate() {
  if (!requireAdmin()) return false;
  const o = await dialog.showOpenDialog(win, {
    title: 'Choose the update zip file (for example SWC-Update-1.2.0.zip)', properties: ['openFile'],
    filters: [{ name: 'SWC update', extensions: ['zip'] }]
  });
  if (o.canceled || !o.filePaths.length) return false;
  let files, pkg, prefix;
  try {
    files = readZip(fs.readFileSync(o.filePaths[0]));
    const pj = files.filter(f => /(^|\/)package\.json$/.test(f.name)).sort((a, b) => a.name.length - b.name.length)[0];
    if (!pj) throw new Error('This zip is not an SWC update: it has no package.json.');
    pkg = JSON.parse(pj.data.toString('utf8'));
    if (pkg.name !== 'swc-selakui') throw new Error('This zip is not an SWC update.');
    prefix = pj.name.slice(0, pj.name.length - 'package.json'.length);
    files = files.filter(f => f.name.startsWith(prefix)).map(f => ({ name: f.name.slice(prefix.length), data: f.data }));
    for (const f of files) {
      if (f.name.split('/').some(part => part === '..' || part === '') || path.isAbsolute(f.name)) throw new Error('The update has a file in a wrong place: ' + f.name);
    }
    for (const need of ['main.js', 'Code.gs', 'ui/index.html']) {
      if (!files.some(f => f.name === need)) throw new Error('The update is missing ' + need + '.');
    }
  } catch (err) {
    dialog.showErrorBox('Cannot use this update', String(err.message || err));
    return false;
  }
  const current = app.getVersion();
  const ok = await dialog.showMessageBox(win, {
    type: newer(pkg.version, current) ? 'question' : 'warning', title: 'Install update',
    message: 'Install SWC Selakui version ' + pkg.version + '?',
    detail: 'This PC has version ' + current + '.' + (newer(pkg.version, current) ? '' : ' The update is not newer.') +
      '\n\nAll records stay as they are. A backup is made first, and the app restarts when the update is in.',
    buttons: ['Install and restart', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true
  });
  if (ok.response !== 0) return false;
  try {
    writeBackup(path.join(backupDir(), 'before-update-' + pkg.version + '-' + Date.now() + '.swcbackup'));
    // Keep the old program files, so a bad update can be undone by copying them back.
    const keep = path.join(app.getPath('userData'), 'previous-version');
    fs.rmSync(keep, { recursive: true, force: true });
    fs.cpSync(__dirname, keep, { recursive: true });
    for (const f of files) {
      const target = path.join(__dirname, f.name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.data);
    }
  } catch (err) {
    dialog.showErrorBox('The update could not be installed', String(err.message || err) + '\n\nThe old program files are in ' + path.join(app.getPath('userData'), 'previous-version') + '.');
    return false;
  }
  await dialog.showMessageBox(win, { type: 'info', message: 'Update installed.', detail: 'The app will now restart with version ' + pkg.version + '.' });
  app.relaunch();
  app.exit(0);
  return true;
}

async function restoreBackup() {
  if (!requireAdmin()) return;
  const o = await dialog.showOpenDialog(win, {
    title: 'Choose a backup to restore', defaultPath: backupDir(), properties: ['openFile'],
    filters: [{ name: 'SWC backup', extensions: ['swcbackup'] }]
  });
  if (o.canceled || !o.filePaths.length) return;
  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(o.filePaths[0], 'utf8'));
  } catch (err) {
    dialog.showErrorBox('Cannot read that file', 'This is not an SWC backup file, or it is damaged.');
    return;
  }
  const when = backup && backup.createdAt ? new Date(backup.createdAt).toLocaleString() : 'an unknown date';
  const ok = await dialog.showMessageBox(win, {
    type: 'warning', title: 'Restore backup', message: 'Replace all data on this PC with the backup from ' + when + '?',
    detail: 'Anything entered after that backup will be gone. A copy of the current data is saved first in the backups folder.',
    buttons: ['Restore', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true
  });
  if (ok.response !== 0) return;
  try {
    writeBackup(path.join(backupDir(), 'before-restore-' + Date.now() + '.swcbackup'));
    rt.restore(backup);
    currentToken = null;
    win.webContents.reload();
    dialog.showMessageBox(win, { type: 'info', message: 'Backup restored. Please sign in again.' });
  } catch (err) {
    dialog.showErrorBox('Restore failed', String(err.message || err));
  }
}

/* ---------- Export for Excel ---------- */

function csv(rows, cols) {
  const q = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [cols.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).join(','))).join('\r\n') + '\r\n';
}

async function exportCsv() {
  if (!requireAdmin()) return;
  const o = await dialog.showOpenDialog(win, { title: 'Choose where to put the export folder', defaultPath: app.getPath('documents'), properties: ['openDirectory', 'createDirectory'] });
  if (o.canceled || !o.filePaths.length) return;
  try {
    const out = path.join(o.filePaths[0], 'SWC export ' + today());
    fs.mkdirSync(out, { recursive: true });
    const t = rt.tables();
    const schema = rt.columns();
    const hidden = ['pinHash', 'salt'];
    Object.keys(t).forEach(name => {
      if (name === 'Settings') return;
      const cols = schema[name].filter(c => hidden.indexOf(c) < 0);
      fs.writeFileSync(path.join(out, name + '.csv'), csv(t[name], cols));
    });
    const items = [];
    t.Expenses.forEach(x => {
      let list = [];
      try { list = JSON.parse(x.items || '[]'); } catch (e) { list = []; }
      list.forEach(it => items.push(Object.assign({ expenseId: x.id, eventId: x.eventId, date: x.date, category: x.category }, it)));
    });
    fs.writeFileSync(path.join(out, 'Expense items.csv'), csv(items, ['expenseId', 'eventId', 'date', 'category', 'item', 'qty', 'unit', 'rate', 'amount']));
    const photos = path.join(out, 'photos');
    fs.mkdirSync(photos, { recursive: true });
    fs.readdirSync(rt.photoDir).forEach(f => fs.copyFileSync(path.join(rt.photoDir, f), path.join(photos, f)));
    shell.openPath(out);
  } catch (err) {
    dialog.showErrorBox('Export failed', String(err.message || err));
  }
}

/* ---------- Menu ---------- */

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => win.webContents.print() }, { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' }] },
    { role: 'editMenu' },
    {
      label: 'Data', submenu: [
        { label: 'Back up now…', click: backupNow },
        { label: 'Restore from a backup…', click: restoreBackup },
        { type: 'separator' },
        { label: 'Export for Excel (CSV)…', click: exportCsv },
        { type: 'separator' },
        { label: 'Open the backups folder', click: () => { if (requireAdmin()) shell.openPath(backupDir()); } }
      ]
    },
    { label: 'View', submenu: [{ role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    {
      label: 'Help', submenu: [
        {
          label: 'Where is the data kept?', click: () => dialog.showMessageBox(win, {
            type: 'info', message: 'All data stays on this PC.',
            detail: 'Folder: ' + dataDir() + '\n\nThe app makes an automatic backup each day it is opened and keeps the last ' + KEEP_AUTO_BACKUPS +
              ' in the backups folder. Use Data, Back up now, to copy a backup to a USB drive regularly, because the automatic ones are lost if this PC fails.'
          })
        },
        { label: 'Install update…', click: installUpdate },
        { label: 'Reset admin PIN…', click: resetAdmin },
        { type: 'separator' },
        { label: 'About', click: () => dialog.showMessageBox(win, { type: 'info', message: 'SWC Selakui, offline desktop app', detail: 'Version ' + app.getVersion() + '\nStaff Welfare Committee, TCV School Selakui' }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
