// Mini Widget - Shows a single usage metric

interface QuotaLimit {
  type: 'TOKENS_LIMIT' | 'TIME_LIMIT';
  unit: number;
  number: number;
  percentage: number;
  nextResetTime: number;
}

interface MiniWidgetUpdate {
  limit: QuotaLimit;
  preference: string;
  debug?: boolean;
}

const miniWidgetApi = (window as any).electronAPI;
let miniWidgetDebug = false;

function miniLog(...args: any[]) {
  if (miniWidgetDebug) {
    console.log('[Mini Widget]', ...args);
  }
}

const progressFill = document.getElementById('progress-fill')!;
const percentageEl = document.getElementById('percentage')!;
const labelEl = document.getElementById('label')!;
const miniWidget = document.getElementById('mini-widget')!;

function miniGetStatusClass(percentage: number): 'safe' | 'warning' | 'danger' {
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'safe';
}

function miniGetLabel(preference: string): string {
  switch (preference) {
    case 'weekly': return '7d';
    case 'monthly': return '30d';
    case '5h':
    default: return '5h';
  }
}

function miniUpdateDisplay(data: MiniWidgetUpdate): void {
  miniLog('Updating display:', data);
  
  if (data.debug !== undefined) {
    miniWidgetDebug = data.debug;
  }
  
  // Update label
  labelEl.textContent = miniGetLabel(data.preference || '5h');
  
  if (!data.limit) {
    miniLog('No limit data');
    progressFill.style.width = '0%';
    percentageEl.textContent = '--%';
    return;
  }
  
  const percentage = Math.min(100, Math.round(data.limit.percentage));
  const statusClass = miniGetStatusClass(percentage);
  
  miniLog('Percentage:', percentage, 'Status:', statusClass);
  
  // Update progress bar
  progressFill.style.width = `${percentage}%`;
  progressFill.className = `progress-fill ${statusClass}`;
  
  // Update percentage text
  percentageEl.textContent = `${percentage}%`;
  percentageEl.className = `percentage ${statusClass}`;
}

// Listen for mini widget updates
if (miniWidgetApi) {
  miniWidgetApi.onMiniWidgetUpdate((data: MiniWidgetUpdate) => {
    miniLog('Mini widget update received');
    miniUpdateDisplay(data);
  });
}

// Click to toggle popup
miniWidget.addEventListener('click', async () => {
  miniLog('Mini widget clicked, toggling popup');
  if (miniWidgetApi) {
    await miniWidgetApi.togglePopup();
  }
});

miniLog('Mini widget initialized');
