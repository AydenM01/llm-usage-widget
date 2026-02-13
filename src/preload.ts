// Preload Script - Bridge between main and renderer

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onDataUpdate: (callback: (data: { quota: unknown; error: string | null }) => void) => {
    ipcRenderer.on('data-update', (_event, data) => callback(data));
  },
  refreshData: () => ipcRenderer.invoke('refresh-data'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
});
