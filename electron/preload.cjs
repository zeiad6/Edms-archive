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

/*
 * Remembered-credential bridge.
 *
 * The renderer never sees a key and never touches the filesystem: it hands a
 * value to the main process, which encrypts it with `safeStorage` (the OS
 * keychain — DPAPI / Keychain / libsecret) and stores the ciphertext in userData
 * with owner-only permissions. A renderer-side XSS can therefore read only the
 * encrypted blob, never the password. See src/lib/credential-store.ts for the
 * browser-side fallback and its (weaker) threat model.
 */
contextBridge.exposeInMainWorld("edmsSecure", {
  setSecret: (key, value) => ipcRenderer.invoke("secure:set", key, value),
  getSecret: (key) => ipcRenderer.invoke("secure:get", key),
  deleteSecret: (key) => ipcRenderer.invoke("secure:delete", key),
});
