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
}

// Use any for window to avoid module issues
const electronAPI = (window as any).electronAPI;

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
  // percentage is already 0-100 from API
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'safe';
}

function renderQuota(quota: QuotaResponse): void {
  const limits = quota.limits
    .filter(l => l.type === 'TOKENS_LIMIT')
    .sort((a, b) => getQuotaInfo(a.unit).order - getQuotaInfo(b.unit).order);

  quotaListEl.innerHTML = limits.map(limit => {
    const info = getQuotaInfo(limit.unit);
    // API returns percentage as whole number (7 = 7%, not 0.07)
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
  loadingEl.classList.add('hidden');
  
  if (data.error) {
    errorEl.textContent = data.error;
    errorEl.classList.remove('hidden');
    quotaListEl.classList.add('hidden');
    return;
  }

  if (data.quota) {
    errorEl.classList.add('hidden');
    quotaListEl.classList.remove('hidden');
    renderQuota(data.quota);
  }

  lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// Listen for data updates from main process
electronAPI.onDataUpdate((data: DataUpdate) => {
  updateUI(data);
});

// Manual refresh
refreshBtn.addEventListener('click', async () => {
  refreshBtn.style.animation = 'spin 0.5s linear';
  loadingEl.classList.remove('hidden');
  quotaListEl.classList.add('hidden');
  
  const data = await electronAPI.refreshData();
  updateUI(data);
  
  setTimeout(() => {
    refreshBtn.style.animation = '';
  }, 500);
});

// Add spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
