import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/services/api";
import type {
  CapacityScenariosResponse,
  DataQualityResponse,
  ForecastResponse,
  HistoryResponse,
  HourlyProfilePoint,
  ModelMetricsResponse,
  MonthlyDistributionPoint,
  OverviewResponse,
  PeakWindowsResponse,
  WeatherResponse,
  WeekdayWeekendPoint,
  ZoneContributionPoint,
} from "@/types/api";

/** Time range in hours for history/forecast queries. */
export type RangeHours = 24 | 168 | 720 | null; // null = custom

export function useOverview(): UseQueryResult<OverviewResponse> {
  return useQuery({ queryKey: ["overview"], queryFn: api.overview, staleTime: 30_000 });
}

export function useForecast(start?: string, end?: string): UseQueryResult<ForecastResponse> {
  return useQuery({
    queryKey: ["forecast", start, end],
    queryFn: () => api.forecast({ start, end }),
    staleTime: 60_000,
  });
}

export function useHistory(
  start?: string,
  end?: string,
  granularity: "hourly" | "daily" = "hourly",
  zone: string = "total",
): UseQueryResult<HistoryResponse> {
  return useQuery({
    queryKey: ["history", start, end, granularity, zone],
    queryFn: () => api.loadHistory({ start, end, granularity, zone }),
    staleTime: 60_000,
  });
}

export function usePeakWindows(limit = 12): UseQueryResult<PeakWindowsResponse> {
  return useQuery({
    queryKey: ["peak-windows", limit],
    queryFn: () => api.peakWindows(limit),
    staleTime: 60_000,
  });
}

export function useCapacityScenarios(): UseQueryResult<CapacityScenariosResponse> {
  return useQuery({
    queryKey: ["capacity-scenarios"],
    queryFn: api.capacityScenarios,
    staleTime: 300_000,
  });
}

export function useModelMetrics(): UseQueryResult<ModelMetricsResponse> {
  return useQuery({ queryKey: ["model-metrics"], queryFn: api.modelMetrics, staleTime: 300_000 });
}

export function useHourlyProfile(): UseQueryResult<HourlyProfilePoint[]> {
  return useQuery({ queryKey: ["hourly-profile"], queryFn: api.hourlyProfile, staleTime: 300_000 });
}

export function useWeekdayWeekend(): UseQueryResult<WeekdayWeekendPoint[]> {
  return useQuery({ queryKey: ["weekday-weekend"], queryFn: api.weekdayWeekend, staleTime: 300_000 });
}

export function useZones(): UseQueryResult<ZoneContributionPoint[]> {
  return useQuery({ queryKey: ["zones"], queryFn: api.zones, staleTime: 300_000 });
}

export function useMonthlyDistribution(): UseQueryResult<MonthlyDistributionPoint[]> {
  return useQuery({
    queryKey: ["monthly-distribution"],
    queryFn: api.monthlyDistribution,
    staleTime: 300_000,
  });
}

export function useWeather(limit = 3000): UseQueryResult<WeatherResponse> {
  return useQuery({ queryKey: ["weather", limit], queryFn: () => api.weather(limit), staleTime: 300_000 });
}

export function useDataQuality(): UseQueryResult<DataQualityResponse> {
  return useQuery({ queryKey: ["data-quality"], queryFn: api.dataQuality, staleTime: 300_000 });
}
