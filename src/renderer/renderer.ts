// Renderer - Popup UI Logic

interface QuotaLimit {
  type: 'TOKENS_LIMIT' | 'TIME_LIMIT';
  unit: number;
  number: number;
  percentage: number;
  nextResetTime: number;
  usage?: number;
  currentValue?: number;
  remaining?: number;
}

interface QuotaResponse {
  limits: QuotaLimit[];
  level: string;
}

interface DataUpdate {
  quota: QuotaResponse | null;
  error: string | null;
  debug?: boolean;
}

// Get the API from window
const popupApi = (window as any).electronAPI;

let popupDebug = false;

function popupLog(...args: any[]) {
  if (popupDebug) {
    console.log('[Z.ai Widget]', ...args);
  }
}

const loadingEl = document.getElementById('loading')!;
const quotaListEl = document.getElementById('quota-list')!;
const errorEl = document.getElementById('error-message')!;
const lastUpdatedEl = document.getElementById('last-updated')!;
const refreshBtn = document.getElementById('refresh-btn')!;

function popupFormatTimeUntilReset(resetTime: number): string {
  const now = Date.now();
  const diff = resetTime - now;

  if (diff <= 0) return 'Resetting...';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Resets in ${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `Resets in ${hours}h ${minutes}m`;
  }

  return `Resets in ${minutes}m`;
}

function popupGetQuotaInfo(unit: number): { label: string; order: number } {
  switch (unit) {
    case 3:
      return { label: '5-Hour Quota', order: 1 };
    case 6:
      return { label: 'Weekly Quota', order: 2 };
    case 5:
      return { label: 'Monthly Quota', order: 3 };
    default:
      return { label: `Quota (${unit})`, order: 99 };
  }
}

function popupGetStatusClass(percentage: number): 'safe' | 'warning' | 'danger' {
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'safe';
}

function popupRenderQuota(quota: QuotaResponse): void {
  popupLog('Rendering quota');
  
  const limits = quota.limits
    .filter(l => l.type === 'TOKENS_LIMIT')
    .sort((a, b) => popupGetQuotaInfo(a.unit).order - popupGetQuotaInfo(b.unit).order);

  quotaListEl.innerHTML = limits.map(limit => {
    const info = popupGetQuotaInfo(limit.unit);
    const percentage = Math.min(100, Math.round(limit.percentage));
    const statusClass = popupGetStatusClass(percentage);

    return `
      <div class="quota-item">
        <div class="quota-header">
          <span class="quota-label">${info.label}</span>
          <span class="quota-percentage ${statusClass}">${percentage}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${statusClass}" style="width: ${percentage}%"></div>
        </div>
        <div class="quota-reset">${popupFormatTimeUntilReset(limit.nextResetTime)}</div>
      </div>
    `;
  }).join('');
}

function popupUpdateUI(data: DataUpdate): void {
  popupLog('updateUI called');
  
  // Update debug flag
  if (data.debug !== undefined) {
    popupDebug = data.debug;
  }
  
  loadingEl.classList.add('hidden');
  
  if (data.error) {
    popupLog('Error received:', data.error);
    errorEl.textContent = data.error;
    errorEl.classList.remove('hidden');
    quotaListEl.classList.add('hidden');
    return;
  }

  if (data.quota) {
    popupLog('Quota data received, rendering...');
    errorEl.classList.add('hidden');
    quotaListEl.classList.remove('hidden');
    popupRenderQuota(data.quota);
  }

  lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// Check if API exists
if (!popupApi) {
  console.error('[Z.ai Widget] API not found!');
  errorEl.textContent = 'Internal error: API not available';
  errorEl.classList.remove('hidden');
  loadingEl.classList.add('hidden');
} else {
  popupLog('Setting up data listener...');
  
  // Listen for data updates from main process
  popupApi.onDataUpdate((data: DataUpdate) => {
    popupLog('onDataUpdate triggered');
    popupUpdateUI(data);
  });

  // Manual refresh
  refreshBtn.addEventListener('click', async () => {
    popupLog('Manual refresh clicked');
    refreshBtn.style.animation = 'spin 0.5s linear';
    loadingEl.classList.remove('hidden');
    quotaListEl.classList.add('hidden');
    
    try {
      const data = await popupApi.refreshData();
      popupUpdateUI(data);
    } catch (err) {
      popupLog('Refresh error:', err);
      popupUpdateUI({ quota: null, error: String(err) });
    }
    
    setTimeout(() => {
      refreshBtn.style.animation = '';
    }, 500);
  });
}

// Add spin animation
const popupStyle = document.createElement('style');
popupStyle.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(popupStyle);

popupLog('Renderer script initialized');
