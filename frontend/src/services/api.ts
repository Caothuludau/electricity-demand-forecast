/** Typed fetch layer over the FastAPI backend. */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    throw new ApiError(0, "API unavailable — is the backend running on port 8000?");
  }
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* keep default */
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  overview: () => request<import("@/types/api").OverviewResponse>("/api/dashboard/overview"),

  loadHistory: (params: {
    start?: string;
    end?: string;
    granularity?: string;
    zone?: string;
  }) => request<import("@/types/api").HistoryResponse>("/api/load/history", params),

  forecast: (params: { start?: string; end?: string }) =>
    request<import("@/types/api").ForecastResponse>("/api/forecast", params),

  peakWindows: (limit?: number) =>
    request<import("@/types/api").PeakWindowsResponse>("/api/risk/peak-windows", { limit }),

  capacityScenarios: () =>
    request<import("@/types/api").CapacityScenariosResponse>("/api/capacity/scenarios"),

  modelMetrics: () => request<import("@/types/api").ModelMetricsResponse>("/api/model/metrics"),

  hourlyProfile: () =>
    request<{ points: import("@/types/api").HourlyProfilePoint[] }>("/api/load/hourly-profile").then((r) => r.points),

  weekdayWeekend: () =>
    request<{ points: import("@/types/api").WeekdayWeekendPoint[] }>("/api/load/weekday-weekend").then((r) => r.points),

  zones: () =>
    request<{ points: import("@/types/api").ZoneContributionPoint[] }>("/api/load/zones").then((r) => r.points),

  monthlyDistribution: () =>
    request<{ points: import("@/types/api").MonthlyDistributionPoint[] }>("/api/load/monthly-distribution").then((r) => r.points),

  weather: (limit?: number) =>
    request<import("@/types/api").WeatherResponse>("/api/drivers/weather", { limit }),

  dataQuality: () => request<import("@/types/api").DataQualityResponse>("/api/data/quality"),

  health: () => request<import("@/types/api").HealthResponse>("/api/health"),

  raw: (params?: { limit?: number; offset?: number }) =>
    request<import("@/types/viz").RawResponse>("/api/raw", params),

  processed: () => request<import("@/types/viz").ProcessedResponse>("/api/processed"),

  eda: () => request<import("@/types/viz").EdaResponse>("/api/eda"),

  modelEvaluation: () => request<import("@/types/viz").ModelResponse>("/api/model"),

  storedForecast: () => request<import("@/types/viz").ForecastStore>("/api/forecast"),

  importForecast: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/api/forecast/import`, { method: "POST", body });
    } catch {
      throw new ApiError(0, "API unavailable — is the backend running on port 8000?");
    }
    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const payload = await response.json();
        if (typeof payload?.detail === "string") detail = payload.detail;
      } catch {
        /* keep default */
      }
      throw new ApiError(response.status, detail);
    }
    return response.json() as Promise<import("@/types/viz").ImportResult>;
  },
};
