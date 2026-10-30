'use strict';
// The only door from the app screens to the data: one call, same names as google.script.run.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('swcDesktop', {
  call: (fn, args) => ipcRenderer.invoke('swc-call', String(fn), Array.from(args || [])),
  info: () => ipcRenderer.invoke('swc-info'),
  action: (name, arg) => ipcRenderer.invoke('swc-action', String(name), arg === undefined ? null : String(arg))
});
