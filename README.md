# LLM Usage Widget

A Windows system tray widget for monitoring LLM API usage (starting with Z.ai).

## Features

- System tray icon - click to see usage popup
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

**Or create a `.env` file:**
```
ZAI_PROJECT_KEY=your-api-key-here
```

### Development

```bash
npm run dev
```

### Build for Distribution

```bash
npm run dist
```

This creates a Windows installer in the `release/` folder.

## Usage

1. Run the app - it will appear in your system tray
2. Click the tray icon to see your usage
3. Click the refresh button (↻) to manually update
4. The popup auto-refreshes every 5 minutes

## Adding Your Own Icon

Replace `assets/icon.png` with your preferred icon (32x32 or 64x64 recommended).

## Supported Providers

- **Z.ai** (current)
- More coming soon!

## Tech Stack

- Electron
- TypeScript
- Native system tray integration
