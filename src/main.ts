// Electron Main Process

import { app, Tray, BrowserWindow, ipcMain, nativeImage, NativeImage } from 'electron';
import * as path from 'path';
import { fetchQuota, fetchUsage, QuotaResponse, UsageResponse } from './api';

let tray: Tray | null = null;
let popupWindow: BrowserWindow | null = null;

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEBUG = true; // Enable debug mode

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[Main]', ...args);
  }
}

function createTrayIcon(): NativeImage {
  // Create a simple 16x16 icon (purple gradient for Z.ai-ish)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Simple purple gradient
      canvas[idx] = 128;     // R
      canvas[idx + 1] = 90;  // G
      canvas[idx + 2] = 213; // B
      canvas[idx + 3] = 255; // A
    }
  }
  
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createPopupWindow(): BrowserWindow {
  log('Creating popup window...');
  log('__dirname is:', __dirname);
  
  const preloadPath = path.join(__dirname, 'preload.js');
  log('Preload path:', preloadPath);
  log('Preload file exists:', require('fs').existsSync(preloadPath));
  
  const win = new BrowserWindow({
    width: 320,
    height: 300,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const htmlPath = path.join(__dirname, 'renderer', 'index.html');
  log('Loading HTML from:', htmlPath);
  win.loadFile(htmlPath);
  
  // Open DevTools in debug mode (detached so it doesn't affect popup size)
  if (DEBUG) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
  
  // Log when page finishes loading
  win.webContents.on('did-finish-load', () => {
    log('Page finished loading');
  });
  
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log('Page failed to load:', errorCode, errorDescription);
  });

  // Hide when clicking outside
  win.on('blur', () => {
    win.hide();
  });

  return win;
}

function getTrayIconPath(): string {
  // Check for custom icon
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const fs = require('fs');
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  return '';
}

async function refreshData(): Promise<{ quota: QuotaResponse | null; error: string | null }> {
  log('Refreshing data...');
  try {
    const quota = await fetchQuota();
    log('Quota fetched successfully:', JSON.stringify(quota, null, 2));
    return { quota, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log('Error fetching quota:', message);
    return { quota: null, error: message };
  }
}

async function updatePopup(): Promise<void> {
  if (!popupWindow) {
    log('updatePopup called but no window exists');
    return;
  }

  log('Updating popup with fresh data...');
  const { quota, error } = await refreshData();
  
  log('Sending data-update to renderer');
  popupWindow.webContents.send('data-update', { quota, error });
}

function togglePopup(): void {
  log('Toggle popup clicked');
  
  if (!popupWindow) {
    popupWindow = createPopupWindow();
  }

  if (popupWindow.isVisible()) {
    log('Hiding popup');
    popupWindow.hide();
  } else {
    // Position near tray (above it on Windows)
    const trayBounds = tray?.getBounds();
    const windowSize = popupWindow.getSize();
    if (trayBounds) {
      // Center horizontally on tray icon
      const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowSize[0] / 2);
      // Position above the tray (Windows taskbar is at bottom)
      const y = Math.round(trayBounds.y - windowSize[1] - 8);
      log('Positioning popup at:', x, y);
      popupWindow.setPosition(x, y);
    }
    log('Showing popup');
    popupWindow.show();
    updatePopup();
  }
}

// IPC handlers
ipcMain.handle('refresh-data', async () => {
  log('IPC refresh-data called');
  const { quota, error } = await refreshData();
  return { quota, error };
});

ipcMain.handle('hide-window', async () => {
  log('IPC hide-window called');
  popupWindow?.hide();
});

app.whenReady().then(() => {
  log('App ready, initializing...');
  
  // Create tray
  const iconPath = getTrayIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : createTrayIcon();
  log('Using icon from path:', iconPath || '(generated)');
  
  tray = new Tray(icon);
  tray.setToolTip('LLM Usage Widget');
  tray.on('click', togglePopup);

  // Create popup (hidden initially)
  popupWindow = createPopupWindow();

  // Auto-refresh
  setInterval(updatePopup, REFRESH_INTERVAL);
  
  log('Initialization complete');
});

app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault(); // Don't quit when window closes
});

// On Windows, hide instead of quit
app.on('before-quit', () => {
  log('App quitting, destroying tray');
  tray?.destroy();
});
