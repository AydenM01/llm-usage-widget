// Preload Script - Bridge between main and renderer

import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Script starting...');

contextBridge.exposeInMainWorld('electronAPI', {
  onDataUpdate: (callback: (data: { quota: unknown; error: string | null }) => void) => {
    console.log('[Preload] onDataUpdate listener registered');
    ipcRenderer.on('data-update', (_event, data) => {
      console.log('[Preload] Received data-update from main:', JSON.stringify(data, null, 2));
      callback(data);
    });
  },
  refreshData: async () => {
    console.log('[Preload] refreshData called');
    const result = await ipcRenderer.invoke('refresh-data');
    console.log('[Preload] refreshData result:', JSON.stringify(result, null, 2));
    return result;
  },
  hideWindow: () => {
    console.log('[Preload] hideWindow called');
    return ipcRenderer.invoke('hide-window');
  },
});

console.log('[Preload] electronAPI exposed to window');
