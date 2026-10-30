/**
 * Runs the same Code.gs as the Google version, on this PC, with no internet.
 * The few Google services Code.gs uses are replaced here:
 *   SpreadsheetApp -> tables kept in data.json
 *   DriveApp       -> image files in the photos folder
 *   CacheService   -> sign-in sessions kept in memory while the app is open
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const PRIVATE = ['doGet', 'include', 'setup', 'resetAdminPin'];
const PHOTO_FOLDER_ID = 'photos';

function createRuntime(codePath, dataDir) {
  const dataFile = path.join(dataDir, 'data.json');
  const photoDir = path.join(dataDir, 'photos');
  fs.mkdirSync(photoDir, { recursive: true });

  let db = load();
  let dirty = false;

  function load() {
    if (!fs.existsSync(dataFile)) return { app: 'SWC Selakui', version: 1, sheets: {}, files: {}, meta: {} };
    const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    d.sheets = d.sheets || {}; d.files = d.files || {}; d.meta = d.meta || {};
    return d;
  }

  function save() {
    if (!dirty) return;
    const tmp = dataFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, dataFile);
    dirty = false;
  }

  /* ---------- SpreadsheetApp ---------- */

  function str(v) { return v === null || v === undefined ? '' : String(v); }

  function makeRange(rows, r, c, nr, nc, touch) {
    nr = nr || 1; nc = nc || 1;
    const range = {
      setValues(values) {
        for (let i = 0; i < nr; i++) {
          while (rows.length < r + i) rows.push([]);
          const row = rows[r + i - 1];
          for (let j = 0; j < nc; j++) {
            while (row.length < c + j) row.push('');
            row[c + j - 1] = str(values[i][j]);
          }
        }
        touch();
        return range;
      },
      setValue(v) { return range.setValues([[v]]); },
      setNumberFormat() { return range; },
      setFontWeight() { return range; }
    };
    return range;
  }

  function makeSheet(name) {
    const rows = db.sheets[name];
    const touch = () => { dirty = true; };
    return {
      getName() { return name; },
      getDataRange() {
        return {
          getValues() {
            const width = rows.reduce((n, row) => Math.max(n, row.length), 0);
            return rows.map(row => { const out = row.slice(); while (out.length < width) out.push(''); return out; });
          }
        };
      },
      getRange(r, c, nr, nc) { return makeRange(rows, r, c, nr, nc, touch); },
      getMaxRows() { return Math.max(rows.length, 1000); },
      appendRow(values) { rows.push(values.map(str)); touch(); },
      deleteRow(i) { rows.splice(i - 1, 1); touch(); },
      setFrozenRows() {}
    };
  }

  const spreadsheet = {
    getSheetByName(name) { return db.sheets[name] ? makeSheet(name) : null; },
    insertSheet(name) { db.sheets[name] = []; dirty = true; return makeSheet(name); }
  };
  const SpreadsheetApp = { getActive() { return spreadsheet; } };

  /* ---------- Blobs, DriveApp ---------- */

  function newBlob(bytes, contentType, name) {
    const buf = Buffer.from(bytes);
    return { getBytes() { return buf; }, getContentType() { return contentType; }, getName() { return name; } };
  }

  function folderObj(id) {
    return {
      getId() { return id; },
      createFile(blob) {
        const fileId = 'F' + crypto.randomUUID().replace(/-/g, '');
        const mime = blob.getContentType();
        const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
        fs.writeFileSync(path.join(photoDir, fileId + ext), blob.getBytes());
        db.files[fileId] = { name: blob.getName(), mime: mime, file: fileId + ext, folder: id, createdAt: new Date().toISOString() };
        dirty = true;
        return { getId() { return fileId; } };
      }
    };
  }

  const DriveApp = {
    createFolder() { return folderObj(PHOTO_FOLDER_ID); },
    getFolderById(id) { return folderObj(id || PHOTO_FOLDER_ID); },
    getFileById(id) {
      const f = db.files[id];
      if (!f) throw new Error('Photo not found.');
      return {
        getParents() {
          let done = false;
          return { hasNext() { return !done; }, next() { done = true; return { getId() { return f.folder; } }; } };
        },
        getBlob() { return newBlob(fs.readFileSync(path.join(photoDir, f.file)), f.mime, f.name); }
      };
    }
  };

  /* ---------- Utilities, cache, lock ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  const Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    getUuid() { return crypto.randomUUID(); },
    computeDigest(alg, text, charset) {
      return Array.from(crypto.createHash(alg).update(String(text), charset).digest()).map(b => (b > 127 ? b - 256 : b));
    },
    base64Decode(s) { return Buffer.from(String(s), 'base64'); },
    base64Encode(bytes) { return Buffer.from(bytes).toString('base64'); },
    newBlob: newBlob,
    // Dates are shown in this PC's own time zone.
    formatDate(date, tz, pattern) {
      if (pattern !== 'yyyy-MM-dd') throw new Error('Unsupported date format: ' + pattern);
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }
  };

  const store = new Map();
  const cache = {
    get(k) {
      const e = store.get(k);
      if (!e) return null;
      if (e.until < Date.now()) { store.delete(k); return null; }
      return e.value;
    },
    put(k, v, seconds) { store.set(k, { value: String(v), until: Date.now() + (seconds || 600) * 1000 }); },
    remove(k) { store.delete(k); }
  };
  const CacheService = { getScriptCache() { return cache; } };
  const LockService = { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } };
  const Session = { getScriptTimeZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } };
  const Logger = { log() {} };

  /* ---------- Load Code.gs ---------- */

  const context = vm.createContext({
    SpreadsheetApp, DriveApp, Utilities, CacheService, LockService, Session, Logger,
    HtmlService: {}, console, JSON, Math, Date, Number, String, Array, Object, Error, isFinite, RegExp
  });
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), context, { filename: 'Code.gs' });

  // Results cross back from the vm context; a JSON round trip makes them plain objects.
  function plain(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }

  function run(fn, args) {
    try {
      return plain(context[fn].apply(null, args || []));
    } finally {
      save();
    }
  }

  return {
    dataDir,
    dataFile,
    photoDir,

    /** A call from the app screens, the same as google.script.run. */
    call(fn, args) {
      if (typeof fn !== 'string' || PRIVATE.indexOf(fn) >= 0 || /_$/.test(fn) || typeof context[fn] !== 'function') {
        throw new Error('Unknown action: ' + fn);
      }
      return run(fn, args);
    },

    /** Creates the tables on first start. Returns the new admin PIN, or null if an admin exists. */
    setup() {
      const msg = String(run('setup'));
      const m = /temporary PIN: (\d+)/.exec(msg);
      return m ? m[1] : null;
    },

    resetAdminPin() {
      const m = /temporary PIN: (\d+)/.exec(String(run('resetAdminPin')));
      store.clear();
      return m ? m[1] : null;
    },

    getMeta(k) { return db.meta[k]; },
    setMeta(k, v) { db.meta[k] = v; dirty = true; save(); },

    signOutEveryone() { store.clear(); },

    columns() { return plain(context.SCHEMA); },

    /** Plain tables for export: an array of objects per table. */
    tables() {
      const out = {};
      Object.keys(context.SCHEMA).forEach(name => { out[name] = plain(context.readTable_(name)); });
      return out;
    },

    /** Everything, photos included, as one object for a backup file. */
    snapshot() {
      const photos = {};
      Object.keys(db.files).forEach(id => {
        const p = path.join(photoDir, db.files[id].file);
        if (fs.existsSync(p)) photos[id] = fs.readFileSync(p).toString('base64');
      });
      return { app: 'SWC Selakui', kind: 'backup', version: 1, createdAt: new Date().toISOString(), data: db, photos };
    },

    /** Replaces all data with a backup made by snapshot(). */
    restore(backup) {
      if (!backup || backup.app !== 'SWC Selakui' || backup.kind !== 'backup' || !backup.data || !backup.data.sheets) {
        throw new Error('This is not an SWC backup file.');
      }
      const files = backup.data.files || {};
      Object.keys(files).forEach(id => {
        const f = files[id];
        if (!/^[A-Za-z0-9]+\.(jpg|png|webp)$/.test(String(f.file))) throw new Error('The backup file is damaged.');
        if (backup.photos && backup.photos[id]) fs.writeFileSync(path.join(photoDir, f.file), Buffer.from(backup.photos[id], 'base64'));
      });
      db = backup.data;
      db.files = files; db.meta = db.meta || {};
      dirty = true;
      save();
      store.clear();
    }
  };
}

module.exports = { createRuntime };
