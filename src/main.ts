// Electron Main Process

import { app, Tray, BrowserWindow, ipcMain, nativeImage, NativeImage } from 'electron';
import * as path from 'path';
import { fetchQuota, fetchUsage, QuotaResponse, UsageResponse } from './api';

let tray: Tray | null = null;
let popupWindow: BrowserWindow | null = null;

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

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
  const win = new BrowserWindow({
    width: 320,
    height: 280,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
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
  try {
    const quota = await fetchQuota();
    return { quota, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { quota: null, error: message };
  }
}

async function updatePopup(): Promise<void> {
  if (!popupWindow) return;

  const { quota, error } = await refreshData();
  
  popupWindow.webContents.send('data-update', { quota, error });
}

function togglePopup(): void {
  if (!popupWindow) {
    popupWindow = createPopupWindow();
  }

  if (popupWindow.isVisible()) {
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
      popupWindow.setPosition(x, y);
    }
    popupWindow.show();
    updatePopup();
  }
}

// IPC handlers
ipcMain.handle('refresh-data', async () => {
  const { quota, error } = await refreshData();
  return { quota, error };
});

ipcMain.handle('hide-window', async () => {
  popupWindow?.hide();
});

app.whenReady().then(() => {
  // Create tray
  const iconPath = getTrayIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : createTrayIcon();
  
  tray = new Tray(icon);
  tray.setToolTip('LLM Usage Widget');
  tray.on('click', togglePopup);

  // Create popup (hidden initially)
  popupWindow = createPopupWindow();

  // Auto-refresh
  setInterval(updatePopup, REFRESH_INTERVAL);
});

app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault(); // Don't quit when window closes
});

// On Windows, hide instead of quit
app.on('before-quit', () => {
  tray?.destroy();
});
