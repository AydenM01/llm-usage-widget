// Preload Script - Bridge between main and renderer

import { contextBridge, ipcRenderer } from 'electron';

let isDebug = false;

// Check debug mode on startup
ipcRenderer.invoke('is-debug').then((debug: boolean) => {
  isDebug = debug;
});

function log(...args: any[]) {
  if (isDebug) {
    console.log('[Preload]', ...args);
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  onDataUpdate: (callback: (data: { quota: unknown; error: string | null; debug?: boolean }) => void) => {
    log('onDataUpdate listener registered');
    ipcRenderer.on('data-update', (_event, data) => {
      log('Received data-update from main');
      // Update debug flag from data
      if (data.debug !== undefined) {
        isDebug = data.debug;
      }
      callback(data);
    });
  },
  refreshData: async () => {
    log('refreshData called');
    const result = await ipcRenderer.invoke('refresh-data');
    // Update debug flag from result
    if (result.debug !== undefined) {
      isDebug = result.debug;
    }
    log('refreshData result received');
    return result;
  },
  hideWindow: () => {
    log('hideWindow called');
    return ipcRenderer.invoke('hide-window');
  },
});

log('electronAPI exposed to window');
