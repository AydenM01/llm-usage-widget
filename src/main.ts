// Electron Main Process

import { app, Tray, BrowserWindow, ipcMain, nativeImage, NativeImage, screen } from 'electron';
import * as path from 'path';
import { fetchQuota, fetchUsage, QuotaResponse, UsageResponse } from './api';

let tray: Tray | null = null;
let popupWindow: BrowserWindow | null = null;
let miniWidgetWindow: BrowserWindow | null = null;

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Check for --debug flag or DEBUG env var
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === 'true';

// Mini widget configuration
const MINI_WIDGET_ENABLED = process.env.MINI_WIDGET !== 'false'; // Enabled by default
const INITIAL_MINI_WIDGET_QUOTA = process.env.MINI_WIDGET_QUOTA || '5h'; // '5h', 'weekly', or 'monthly'
const MINI_WIDGET_POSITION = process.env.MINI_WIDGET_POSITION || 'top-right'; // 'top-left', 'top-right', 'bottom-left', 'bottom-right'

// Current quota preference (can be changed by clicking in popup)
let currentMiniWidgetQuota = INITIAL_MINI_WIDGET_QUOTA;

// Store latest quota data
let latestQuota: QuotaResponse | null = null;

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[Main]', ...args);
  }
}

function createTrayIcon(): NativeImage {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      canvas[idx] = 128;
      canvas[idx + 1] = 90;
      canvas[idx + 2] = 213;
      canvas[idx + 3] = 255;
    }
  }
  
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function getQuotaUnit(preference: string): number {
  switch (preference) {
    case 'weekly': return 6;
    case 'monthly': return 5;
    case '5h':
    default: return 3;
  }
}

function createMiniWidgetWindow(): BrowserWindow {
  log('Creating mini widget window...');
  
  const preloadPath = path.join(__dirname, 'preload.js');
  
  const win = new BrowserWindow({
    width: 260,
    height: 52,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const htmlPath = path.join(__dirname, 'renderer', 'mini-widget.html');
  log('Loading mini widget HTML from:', htmlPath);
  win.loadFile(htmlPath);
  
  // Position the mini widget
  positionMiniWidget(win);

  win.on('ready-to-show', () => {
    win.show();
  });

  return win;
}

function positionMiniWidget(win: BrowserWindow): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const widgetSize = win.getSize();
  
  let x: number, y: number;
  
  switch (MINI_WIDGET_POSITION) {
    case 'top-left':
      x = 10;
      y = 10;
      break;
    case 'bottom-left':
      x = 10;
      y = height - widgetSize[1] - 10;
      break;
    case 'bottom-right':
      x = width - widgetSize[0] - 10;
      y = height - widgetSize[1] - 10;
      break;
    case 'top-right':
    default:
      x = width - widgetSize[0] - 10;
      y = 10;
      break;
  }
  
  log('Positioning mini widget at:', x, y);
  win.setPosition(x, y);
}

function createPopupWindow(): BrowserWindow {
  log('Creating popup window...');
  
  const preloadPath = path.join(__dirname, 'preload.js');
  
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
  
  // Open DevTools only in debug mode
  if (DEBUG) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Hide when clicking outside
  win.on('blur', () => {
    win.hide();
  });

  return win;
}

function getTrayIconPath(): string {
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
    latestQuota = quota;
    log('Quota fetched successfully');
    return { quota, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log('Error fetching quota:', message);
    return { quota: null, error: message };
  }
}

async function updateAllWindows(): Promise<void> {
  const { quota, error } = await refreshData();
  
  // Update popup
  if (popupWindow) {
    log('Updating popup');
    popupWindow.webContents.send('data-update', { quota, error, debug: DEBUG, currentQuota: currentMiniWidgetQuota });
  }
  
  // Update mini widget
  updateMiniWidget();
}

function updateMiniWidget(): void {
  if (!miniWidgetWindow || !latestQuota) return;
  
  log('Updating mini widget with quota:', currentMiniWidgetQuota);
  const targetUnit = getQuotaUnit(currentMiniWidgetQuota);
  const targetLimit = latestQuota.limits.find(l => l.type === 'TOKENS_LIMIT' && l.unit === targetUnit);
  
  if (targetLimit) {
    miniWidgetWindow.webContents.send('mini-widget-update', {
      limit: targetLimit,
      preference: currentMiniWidgetQuota,
      debug: DEBUG
    });
  }
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
    // Position near mini widget if it exists, otherwise near tray
    const miniWidgetBounds = miniWidgetWindow?.getBounds();
    const trayBounds = tray?.getBounds();
    const windowSize = popupWindow.getSize();
    
    let x: number, y: number;
    
    if (miniWidgetBounds) {
      // Get the display where the mini widget currently is
      const currentDisplay = screen.getDisplayMatching(miniWidgetBounds);
      const { width: screenWidth, height: screenHeight } = currentDisplay.workAreaSize;
      const displayBounds = currentDisplay.bounds;
      
      // Position below mini widget, aligned to its right edge
      x = Math.round(miniWidgetBounds.x + miniWidgetBounds.width - windowSize[0]);
      y = Math.round(miniWidgetBounds.y + miniWidgetBounds.height + 8);
      
      // Keep popup within the current display's work area
      x = Math.max(displayBounds.x, Math.min(x, displayBounds.x + screenWidth - windowSize[0]));
      y = Math.max(displayBounds.y, Math.min(y, displayBounds.y + screenHeight - windowSize[1]));
      
      log('Mini widget at:', miniWidgetBounds.x, miniWidgetBounds.y);
      log('Current display bounds:', displayBounds);
      log('Positioning popup at:', x, y);
    } else if (trayBounds) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      
      x = Math.round(trayBounds.x + trayBounds.width / 2 - windowSize[0] / 2);
      y = Math.round(trayBounds.y - windowSize[1] - 8);
      
      // Keep popup on screen
      x = Math.max(0, Math.min(x, screenWidth - windowSize[0]));
      y = Math.max(0, Math.min(y, screenHeight - windowSize[1]));
    } else {
      x = 100;
      y = 100;
    }
    
    popupWindow.setPosition(x, y);
    log('Showing popup');
    popupWindow.show();
    updateAllWindows();
  }
}

// IPC handlers
ipcMain.handle('refresh-data', async () => {
  log('IPC refresh-data called');
  const { quota, error } = await refreshData();
  return { quota, error, debug: DEBUG };
});

ipcMain.handle('hide-window', async () => {
  log('IPC hide-window called');
  popupWindow?.hide();
});

ipcMain.handle('is-debug', () => DEBUG);

ipcMain.handle('toggle-popup', async () => {
  togglePopup();
  return true;
});

ipcMain.handle('set-mini-widget-quota', async (_event, quota: string) => {
  log('IPC set-mini-widget-quota called:', quota);
  currentMiniWidgetQuota = quota;
  updateMiniWidget();
  return true;
});

app.whenReady().then(() => {
  log('App ready, initializing...');
  log('Mini widget enabled:', MINI_WIDGET_ENABLED);
  log('Mini widget quota:', currentMiniWidgetQuota);
  log('Mini widget position:', MINI_WIDGET_POSITION);
  
  // Handle screen resolution changes (can only do this after app is ready)
  screen.on('display-metrics-changed', () => {
    if (miniWidgetWindow) {
      positionMiniWidget(miniWidgetWindow);
    }
  });
  
  // Create tray (always)
  const iconPath = getTrayIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : createTrayIcon();
  log('Using icon from path:', iconPath || '(generated)');
  
  tray = new Tray(icon);
  tray.setToolTip('LLM Usage Widget');
  tray.on('click', togglePopup);
  tray.on('double-click', togglePopup);

  // Create popup (hidden initially)
  popupWindow = createPopupWindow();

  // Create mini widget if enabled
  if (MINI_WIDGET_ENABLED) {
    miniWidgetWindow = createMiniWidgetWindow();
  }

  // Initial data fetch after windows are ready
  setTimeout(() => {
    log('Performing initial data fetch...');
    updateAllWindows();
  }, 500);

  // Auto-refresh every 5 minutes
  setInterval(updateAllWindows, REFRESH_INTERVAL);
  
  log('Initialization complete');
});

app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  log('App quitting, destroying tray');
  tray?.destroy();
});
