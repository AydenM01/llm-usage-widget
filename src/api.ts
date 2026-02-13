// Z.ai API Client

const API_BASE = 'https://api.z.ai/api';

export interface QuotaLimit {
  type: 'TOKENS_LIMIT' | 'TIME_LIMIT';
  unit: number;        // 3 = 5-hour, 5 = monthly, 6 = weekly
  number: number;
  percentage: number;
  nextResetTime: number;
  usage?: number;
  currentValue?: number;
  remaining?: number;
}

export interface QuotaResponse {
  limits: QuotaLimit[];
  level: string;
}

export interface UsageTotals {
  totalModelCallCount: number;
  totalTokensUsage: number;
}

export interface UsageResponse {
  x_time: string[];
  modelCallCount: (number | null)[];
  tokensUsage: (number | null)[];
  totalUsage: UsageTotals;
}

function getApiKey(): string {
  const key = process.env.ZAI_PROJECT_KEY || process.env.ZAI_API_KEY;
  if (!key) {
    throw new Error('ZAI_PROJECT_KEY or ZAI_API_KEY environment variable not set');
  }
  return key;
}

export async function fetchQuota(): Promise<QuotaResponse> {
  const response = await fetch(`${API_BASE}/monitor/usage/quota/limit`, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Quota API error: ${response.status}`);
  }

  const json = await response.json() as { data: QuotaResponse };
  return json.data;
}

export async function fetchUsage(startTime: string, endTime: string): Promise<UsageResponse> {
  const url = `${API_BASE}/monitor/usage/model-usage?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Usage API error: ${response.status}`);
  }

  const json = await response.json() as { data: UsageResponse };
  return json.data;
}

export function formatTimeUntilReset(resetTime: number): string {
  const now = Date.now();
  const diff = resetTime - now;

  if (diff <= 0) return 'Resetting...';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function getQuotaType(unit: number): { label: string; period: string } {
  switch (unit) {
    case 3:
      return { label: '5-Hour', period: '5h' };
    case 5:
      return { label: 'Monthly', period: '30d' };
    case 6:
      return { label: 'Weekly', period: '7d' };
    default:
      return { label: `Unit ${unit}`, period: 'Unknown' };
  }
}
