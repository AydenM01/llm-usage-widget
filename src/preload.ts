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
  onDataUpdate: (callback: (data: any) => void) => {
    log('onDataUpdate listener registered');
    ipcRenderer.on('data-update', (_event, data) => {
      log('Received data-update from main');
      if (data.debug !== undefined) {
        isDebug = data.debug;
      }
      callback(data);
    });
  },
  onMiniWidgetUpdate: (callback: (data: any) => void) => {
    log('onMiniWidgetUpdate listener registered');
    ipcRenderer.on('mini-widget-update', (_event, data) => {
      log('Received mini-widget-update from main');
      if (data.debug !== undefined) {
        isDebug = data.debug;
      }
      callback(data);
    });
  },
  refreshData: async () => {
    log('refreshData called');
    const result = await ipcRenderer.invoke('refresh-data');
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
  togglePopup: () => {
    log('togglePopup called');
    return ipcRenderer.invoke('toggle-popup');
  },
  setMiniWidgetQuota: (quota: string) => {
    log('setMiniWidgetQuota called:', quota);
    return ipcRenderer.invoke('set-mini-widget-quota', quota);
  },
});

log('electronAPI exposed to window');
