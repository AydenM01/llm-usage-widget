// Renderer - UI Logic

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
const api = (window as any).electronAPI;

let isDebug = false;

function log(...args: any[]) {
  if (isDebug) {
    console.log('[Z.ai Widget]', ...args);
  }
}

const loadingEl = document.getElementById('loading')!;
const quotaListEl = document.getElementById('quota-list')!;
const errorEl = document.getElementById('error-message')!;
const lastUpdatedEl = document.getElementById('last-updated')!;
const refreshBtn = document.getElementById('refresh-btn')!;

function formatTimeUntilReset(resetTime: number): string {
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

function getQuotaInfo(unit: number): { label: string; order: number } {
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

function getStatusClass(percentage: number): 'safe' | 'warning' | 'danger' {
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'safe';
}

function renderQuota(quota: QuotaResponse): void {
  log('Rendering quota');
  
  const limits = quota.limits
    .filter(l => l.type === 'TOKENS_LIMIT')
    .sort((a, b) => getQuotaInfo(a.unit).order - getQuotaInfo(b.unit).order);

  quotaListEl.innerHTML = limits.map(limit => {
    const info = getQuotaInfo(limit.unit);
    const percentage = Math.min(100, Math.round(limit.percentage));
    const statusClass = getStatusClass(percentage);

    return `
      <div class="quota-item">
        <div class="quota-header">
          <span class="quota-label">${info.label}</span>
          <span class="quota-percentage ${statusClass}">${percentage}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${statusClass}" style="width: ${percentage}%"></div>
        </div>
        <div class="quota-reset">${formatTimeUntilReset(limit.nextResetTime)}</div>
      </div>
    `;
  }).join('');
}

function updateUI(data: DataUpdate): void {
  log('updateUI called');
  
  // Update debug flag
  if (data.debug !== undefined) {
    isDebug = data.debug;
  }
  
  loadingEl.classList.add('hidden');
  
  if (data.error) {
    log('Error received:', data.error);
    errorEl.textContent = data.error;
    errorEl.classList.remove('hidden');
    quotaListEl.classList.add('hidden');
    return;
  }

  if (data.quota) {
    log('Quota data received, rendering...');
    errorEl.classList.add('hidden');
    quotaListEl.classList.remove('hidden');
    renderQuota(data.quota);
  }

  lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// Check if API exists
if (!api) {
  console.error('[Z.ai Widget] API not found!');
  errorEl.textContent = 'Internal error: API not available';
  errorEl.classList.remove('hidden');
  loadingEl.classList.add('hidden');
} else {
  log('Setting up data listener...');
  
  // Listen for data updates from main process
  api.onDataUpdate((data: DataUpdate) => {
    log('onDataUpdate triggered');
    updateUI(data);
  });

  // Manual refresh
  refreshBtn.addEventListener('click', async () => {
    log('Manual refresh clicked');
    refreshBtn.style.animation = 'spin 0.5s linear';
    loadingEl.classList.remove('hidden');
    quotaListEl.classList.add('hidden');
    
    try {
      const data = await api.refreshData();
      updateUI(data);
    } catch (err) {
      log('Refresh error:', err);
      updateUI({ quota: null, error: String(err) });
    }
    
    setTimeout(() => {
      refreshBtn.style.animation = '';
    }, 500);
  });
}

// Add spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

log('Renderer script initialized');
