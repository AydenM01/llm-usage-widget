# LLM Usage Widget

A Windows system tray widget for monitoring LLM API usage (starting with Z.ai).

## Features

- **System tray icon** - click to see usage popup
- **Mini widget mode** - small always-on-top bar showing a single usage metric
- Displays 5-hour, weekly, and monthly quota usage
- Progress bars with color coding (green/yellow/red)
- Auto-refreshes every 5 minutes
- Manual refresh button

## Setup

### Prerequisites
- Node.js 18+ installed
- Z.ai API key

### Installation

```bash
cd llm-usage-widget
npm install
```

### Configuration

Set your Z.ai API key as an environment variable:

**Windows (PowerShell):**
```powershell
$env:ZAI_PROJECT_KEY = "your-api-key-here"
```

**Windows (Command Prompt):**
```cmd
set ZAI_PROJECT_KEY=your-api-key-here
```

## Running

### Normal Mode
System tray only (mini widget enabled by default):
```bash
npm start
```

### Without Mini Widget
System tray only, no mini widget:
```powershell
$env:MINI_WIDGET = "false"
npm start
```

### Debug Mode (with DevTools)
```bash
npm run start:debug
# or
npm run dev
```

## Mini Widget Configuration

The mini widget is a small always-on-top bar that shows a single usage metric. Configure it with environment variables:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `MINI_WIDGET` | `true`, `false` | `true` | Enable/disable mini widget |
| `MINI_WIDGET_QUOTA` | `5h`, `weekly`, `monthly` | `5h` | Which quota to display |
| `MINI_WIDGET_POSITION` | `top-left`, `top-right`, `bottom-left`, `bottom-right` | `top-right` | Screen position |

**Example - Show weekly quota in bottom-left:**
```powershell
$env:MINI_WIDGET_QUOTA = "weekly"
$env:MINI_WIDGET_POSITION = "bottom-left"
npm start
```

**Example - Disable mini widget:**
```powershell
$env:MINI_WIDGET = "false"
npm start
```

## Build for Distribution

```bash
npm run dist
```

This creates a Windows installer in the `release/` folder.

## Usage

1. Run the app - a mini widget appears in the top-right corner (if enabled)
2. A tray icon also appears in the system tray
3. Click the mini widget or tray icon to see full usage details
4. Click the refresh button (↻) to manually update
5. The widget auto-refreshes every 5 minutes

## Adding Your Own Icon

Replace `assets/icon.png` with your preferred icon (32x32 or 64x64 recommended).

## Supported Providers

- **Z.ai** (current)
- More coming soon!

## Tech Stack

- Electron
- TypeScript
- Native system tray integration
