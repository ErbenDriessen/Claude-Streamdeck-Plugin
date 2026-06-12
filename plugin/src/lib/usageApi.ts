export interface WindowUsage {
  utilization: number; // 0..100, already a percentage
  resetsAtMs: number; // epoch ms
}

export interface UsageSnapshot {
  fiveHour: WindowUsage | null;
  sevenDay: WindowUsage | null;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  snapshot: UsageSnapshot | null;
}

export const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

function toWindow(w: unknown): WindowUsage | null {
  const o = w as { utilization?: unknown; resets_at?: unknown } | null | undefined;
  if (!o || typeof o.utilization !== "number" || typeof o.resets_at !== "string") return null;
  const ms = Date.parse(o.resets_at);
  if (Number.isNaN(ms)) return null;
  return { utilization: o.utilization, resetsAtMs: ms };
}

/** Pure: parse the JSON body of the oauth/usage endpoint. */
export function parseUsageResponse(text: string): UsageSnapshot | null {
  try {
    const d = JSON.parse(text) as { five_hour?: unknown; seven_day?: unknown };
    const fiveHour = toWindow(d.five_hour);
    const sevenDay = toWindow(d.seven_day);
    if (!fiveHour && !sevenDay) return null;
    return { fiveHour, sevenDay };
  } catch {
    return null;
  }
}

/** Side-effecting: GET the official usage endpoint with the OAuth bearer token. */
export async function fetchUsage(token: string, timeoutMs = 5000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(USAGE_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, snapshot: res.ok ? parseUsageResponse(text) : null };
  } catch {
    return { ok: false, status: 0, snapshot: null };
  } finally {
    clearTimeout(timer);
  }
}
