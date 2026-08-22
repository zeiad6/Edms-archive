"use strict";
/*
 * Minimal, sandboxed preload. Exposes ONLY window controls to the renderer —
 * no Node, no fs, no shell access. The renderer cannot reach anything else.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("edmsShell", {
  minimize: () => ipcRenderer.send("win:minimize"),
  maximizeToggle: () => ipcRenderer.send("win:maximize-toggle"),
  close: () => ipcRenderer.send("win:close"),
  isMaximized: () => ipcRenderer.invoke("win:is-maximized"),
  getState: () => ipcRenderer.invoke("win:state"),
  onStateChange: (cb) => {
    const listener = (_e, state) => cb(state);
    ipcRenderer.on("window:state", listener);
    return () => ipcRenderer.removeListener("window:state", listener);
  },
});
