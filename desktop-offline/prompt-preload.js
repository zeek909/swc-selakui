'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('swcPrompt', {
  answer: v => ipcRenderer.send('prompt-answer', v === null ? null : String(v))
});
