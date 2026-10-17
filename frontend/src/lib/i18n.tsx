/** Locale: English (default) or Vietnamese. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "vi";

const dict = {
  // header / nav
  "nav.dashboard": { en: "Dashboard", vi: "Tổng quan" },
  "nav.drivers": { en: "Data & Drivers", vi: "Dữ liệu & Yếu tố" },
  "header.subtitle": { en: "Tetuan City · Forecasting & Capacity Planning", vi: "Thành phố Tetuan · Dự báo & Quy hoạch công suất" },
  "header.dataThrough": { en: "Data through", vi: "Dữ liệu đến" },
  "header.live": { en: "live", vi: "trực tiếp" },
  "footer.tagline": {
    en: "1-hour-ahead probabilistic forecasting · P10/P50/P90 quantile LightGBM · capacity risk evaluated per project specification",
    vi: "Dự báo xác suất trước 1 giờ · LightGBM phân vị P10/P50/P90 · rủi ro công suất đánh giá theo đặc tả dự án",
  },

  // risk levels
  "risk.LOW": { en: "LOW", vi: "THẤP" },
  "risk.MEDIUM": { en: "MEDIUM", vi: "TRUNG BÌNH" },
  "risk.HIGH": { en: "HIGH", vi: "CAO" },
  "risk.UNKNOWN": { en: "UNKNOWN", vi: "KHÔNG RÕ" },

  // KPI row
  "kpi.currentLoad": { en: "Current Load", vi: "Tải hiện tại" },
  "kpi.headroom": { en: "headroom", vi: "dự phòng" },
  "kpi.nextHourForecast": { en: "Next Hour Forecast", vi: "Dự báo giờ tới" },
  "kpi.forecastRange": { en: "Forecast Range", vi: "Khoảng dự báo" },
  "kpi.p10p90Interval": { en: "P10 – P90 interval", vi: "khoảng P10 – P90" },
  "kpi.capacityRisk": { en: "Capacity Risk", vi: "Rủi ro công suất" },
  "kpi.vsThreshold": { en: "vs {c} threshold", vi: "so với ngưỡng {c}" },
  "kpi.requiredCapacity": { en: "Required Capacity", vi: "Công suất cần thiết" },
  "kpi.forecastPeakReserve": { en: "forecast peak + {p}% reserve", vi: "đỉnh dự báo + {p}% dự phòng" },

  // forecast chart
  "fc.title": { en: "Actual vs Forecast", vi: "Thực tế vs Dự báo" },
  "fc.subtitle": {
    en: "1-hour-ahead probabilistic forecast (P10 / P50 / P90) against observed system load and the capacity threshold",
    vi: "Dự báo xác suất trước 1 giờ (P10 / P50 / P90) so với tải hệ thống quan sát và ngưỡng công suất",
  },
  "fc.legendActual": { en: "Actual load", vi: "Tải thực tế" },
  "fc.legendForecast": { en: "Forecast (P50)", vi: "Dự báo (P50)" },
  "fc.legendBand": { en: "P10–P90 band", vi: "Dải P10–P90" },
  "fc.legendCapacity": { en: "Capacity threshold", vi: "Ngưỡng công suất" },
  "fc.resetZoom": { en: "Reset zoom", vi: "Đặt lại thu phóng" },
  "fc.dragToZoom": { en: "drag on the chart to zoom", vi: "kéo trên biểu đồ để thu phóng" },
  "fc.noData": { en: "No data for this period.", vi: "Không có dữ liệu cho giai đoạn này." },
  "fc.tooltipActual": { en: "Actual", vi: "Thực tế" },
  "fc.tooltipForecast": { en: "Forecast P50", vi: "Dự báo P50" },
  "fc.tooltipCapacity": { en: "Capacity", vi: "Công suất" },
  "fc.range24h": { en: "Last 24 Hours", vi: "24 giờ qua" },
  "fc.range7d": { en: "Last 7 Days", vi: "7 ngày qua" },
  "fc.range30d": { en: "Last 30 Days", vi: "30 ngày qua" },

  // states
  "state.apiUnavailable": { en: "API unavailable", vi: "API không khả dụng" },
  "state.loading": { en: "Loading…", vi: "Đang tải…" },
  "state.retry": { en: "Retry", vi: "Thử lại" },
  "state.emptyTitle": { en: "Forecast data unavailable", vi: "Không có dữ liệu dự báo" },
  "state.emptyDesc": {
    en: "The forecasting pipeline has not generated predictions for this period. Adjust the time range or re-run the pipeline.",
    vi: "Quy trình dự báo chưa tạo kết quả cho giai đoạn này. Hãy điều chỉnh khoảng thời gian hoặc chạy lại quy trình.",
  },
  "state.hourlyUnavailable": { en: "Hourly profile unavailable.", vi: "Không có dữ liệu hồ sơ theo giờ." },
  "state.weekdayUnavailable": { en: "Weekday/weekend profile unavailable.", vi: "Không có dữ liệu ngày thường/cuối tuần." },
  "state.zoneUnavailable": { en: "Zone contribution unavailable.", vi: "Không có dữ liệu đóng góp theo khu." },
  "state.monthlyUnavailable": { en: "Monthly distribution unavailable.", vi: "Không có dữ liệu phân phối theo tháng." },
  "state.riskLoadFail": { en: "Failed to load peak-risk windows: ", vi: "Không tải được các khung rủi ro đỉnh: " },
  "state.scenarioFail": { en: "Failed to load scenarios: ", vi: "Không tải được kịch bản: " },
  "state.metricsFail": { en: "Failed to load metrics: ", vi: "Không tải được chỉ số: " },
  "state.weatherFail": { en: "Failed to load weather data: ", vi: "Không tải được dữ liệu thời tiết: " },
  "state.noRiskWindows": { en: "No risk windows detected", vi: "Không phát hiện khung rủi ro" },
  "state.noRiskDesc": {
    en: "No recent hours exceeded the capacity threshold under the P50/P90 rule.",
    vi: "Không có giờ nào gần đây vượt ngưỡng công suất theo quy tắc P50/P90.",
  },

  // peak risk
  "risk.title": { en: "Peak Risk & Capacity", vi: "Rủi ro đỉnh & Công suất" },
  "risk.subtitle": {
    en: "Recent hours where demand approached or exceeded available capacity — decision rule: P90 < C → low · P50 < C ≤ P90 → medium · C ≤ P50 → high",
    vi: "Các giờ gần đây khi cầu tiếp cận hoặc vượt công suất khả dụng — quy tắc: P90 < C → thấp · P50 < C ≤ P90 → trung bình · C ≤ P50 → cao",
  },
  "risk.severeHours": { en: "{n} most severe risk hours on record", vi: "{n} giờ rủi ro cao nhất ghi nhận được" },
  "risk.breach": { en: "breach", vi: "vượt ngưỡng" },
  "risk.uncertaintyDriven": { en: "uncertainty-driven", vi: "do bất định" },
  "risk.cardForecast": { en: "Forecast", vi: "Dự báo" },
  "risk.cardCapacity": { en: "Capacity", vi: "Công suất" },
  "risk.observedBreach": { en: "Observed load breached capacity", vi: "Tải quan sát đã vượt công suất" },
  "risk.centralBreach": { en: "Central forecast breaches capacity", vi: "Dự báo trung tâm vượt công suất" },
  "risk.uncertaintyBreach": { en: "P90 exceeds capacity — uncertainty-driven risk", vi: "P90 vượt công suất — rủi ro do bất định" },
  "risk.withinThreshold": { en: "Within threshold", vi: "Trong ngưỡng" },

  // reserve margin
  "reserve.title": { en: "Reserve Margin Planning", vi: "Quy hoạch biên dự phòng" },
  "reserve.subtitle": {
    en: "How much capacity is required under 10% / 15% / 20% reserve-margin policies",
    vi: "Công suất cần thiết theo chính sách dự phòng 10% / 15% / 20%",
  },
  "reserve.selector": { en: "Reserve Margin", vi: "Biên dự phòng" },
  "reserve.equation": { en: "Scenario equation", vi: "Phương trình kịch bản" },
  "reserve.forecastPeak": { en: "Forecast peak", vi: "Đỉnh dự báo" },
  "reserve.reserve": { en: "+ reserve ({p}%)", vi: "+ dự phòng ({p}%)" },
  "reserve.requiredCapacity": { en: "Required capacity", vi: "Công suất cần thiết" },
  "reserve.currentCapacity": { en: "Current capacity", vi: "Công suất hiện tại" },
  "reserve.needsMore": {
    en: "Additional {mw} MW of capacity needed to meet this margin.",
    vi: "Cần thêm {mw} MW công suất để đáp ứng biên này.",
  },
  "reserve.sufficient": { en: "Current capacity satisfies this margin.", vi: "Công suất hiện tại đáp ứng được biên này." },
  "reserve.caption": {
    en: "Required capacity = forecast peak × (1 + reserve margin), evaluated against the current {c} threshold",
    vi: "Công suất cần thiết = đỉnh dự báo × (1 + biên dự phòng), đối chiếu ngưỡng hiện tại {c}",
  },
  "reserve.tooltipCurrent": { en: "Current capacity", vi: "Công suất hiện tại" },
  "reserve.tooltipRequired": { en: "Required capacity", vi: "Công suất cần thiết" },

  // model performance
  "perf.title": { en: "Model Performance", vi: "Hiệu năng mô hình" },
  "perf.subtitle": {
    en: "Does the gradient-boosting model consistently beat seasonal-naive baselines? (30-day chronological holdout)",
    vi: "Mô hình gradient boosting có vượt các baseline seasonal-naive không? (kiểm định thời gian 30 ngày)",
  },
  "perf.model": { en: "Model", vi: "Mô hình" },
  "perf.mae": { en: "MAE (MW)", vi: "MAE (MW)" },
  "perf.rmse": { en: "RMSE (MW)", vi: "RMSE (MW)" },
  "perf.wape": { en: "WAPE", vi: "WAPE" },
  "perf.peakTiming": { en: "Peak timing error", vi: "Sai lệch giờ đỉnh" },
  "perf.main": { en: "main", vi: "chính" },
  "perf.improves": {
    en: "LightGBM reduces WAPE by {p}% versus the best seasonal-naive baseline ({base}) on the {w} temporal holdout. Chronological validation only — no random splitting.",
    vi: "LightGBM giảm WAPE {p}% so với baseline seasonal-naive tốt nhất ({base}) trên khoảng kiểm định {w}. Chỉ kiểm định theo thời gian — không chia ngẫu nhiên.",
  },
  "perf.notBeat": {
    en: "LightGBM does not beat the best baseline on this holdout window.",
    vi: "LightGBM không vượt được baseline tốt nhất trên khoảng kiểm định này.",
  },
  "perf.wapeCompare": { en: "WAPE comparison (lower is better)", vi: "So sánh WAPE (thấp hơn tốt hơn)" },
  "perf.coverage": { en: "P10–P90 Coverage", vi: "Độ phủ P10–P90" },
  "perf.target": { en: "target", vi: "mục tiêu" },
  "perf.coverageShort": {
    en: "Observed coverage falls short of the 80% target — intervals are too narrow; the model is not calibrated on this window.",
    vi: "Độ phủ quan sát thấp hơn mục tiêu 80% — khoảng dự báo quá hẹp; mô hình chưa được hiệu chỉnh trên khoảng này.",
  },
  "perf.coverageOk": {
    en: "Empirical coverage is close to the 80% target for the P10–P90 interval.",
    vi: "Độ phủ thực nghiệm gần mục tiêu 80% cho khoảng P10–P90.",
  },
  "perf.avgInterval": { en: "Avg interval width", vi: "Độ rộng khoảng TB" },
  "perf.pinball": { en: "Pinball loss (avg)", vi: "Pinball loss (TB)" },

  // load patterns
  "pat.hourlyTitle": { en: "Hour-of-Day Load Profile", vi: "Hồ sơ tải theo giờ" },
  "pat.hourlySub": {
    en: "Average system load by hour — identifies typical high-demand hours",
    vi: "Tải hệ thống trung bình theo giờ — xác định các giờ thường xuyên cao điểm",
  },
  "pat.avgLoad": { en: "Average load", vi: "Tải trung bình" },
  "pat.eveningPeak": {
    en: "Typical evening peak at {h} — identifies the hours where capacity risk concentrates.",
    vi: "Đỉnh tối điển hình lúc {h} — xác định các giờ tập trung rủi ro công suất.",
  },
  "pat.weekdayTitle": { en: "Weekday vs Weekend", vi: "Ngày thường vs Cuối tuần" },
  "pat.weekdaySub": { en: "Operational differences in the daily demand cycle", vi: "Khác biệt vận hành trong chu kỳ nhu cầu hằng ngày" },
  "pat.weekday": { en: "Weekday", vi: "Ngày thường" },
  "pat.weekend": { en: "Weekend", vi: "Cuối tuần" },
  "pat.zoneTitle": { en: "Zone Contribution", vi: "Đóng góp theo khu" },
  "pat.zoneSub": { en: "Zone 1 + Zone 2 + Zone 3 build-up of system demand by hour", vi: "Cấu trúc tổng tải hệ thống theo giờ của Khu 1 + Khu 2 + Khu 3" },
  "pat.zone1": { en: "Zone 1", vi: "Khu 1" },
  "pat.zone2": { en: "Zone 2", vi: "Khu 2" },
  "pat.zone3": { en: "Zone 3", vi: "Khu 3" },
  "pat.monthlyTitle": { en: "Monthly Load Distribution", vi: "Phân phối tải theo tháng" },
  "pat.monthlySub": { en: "Seasonal variation of hourly demand across the year", vi: "Biến động theo mùa của tải theo giờ trong năm" },
  "pat.monthlyCaption": {
    en: "Box-style monthly distribution of hourly load: light bars = interquartile range (Q1–Q3), dim bars = full range. Shows seasonal spread across 2017.",
    vi: "Phân phối tải theo giờ dạng hộp theo tháng: cột sáng = khoảng tứ phân vị (Q1–Q3), cột mờ = toàn dải. Thể hiện biến động mùa vụ năm 2017.",
  },
  "pat.tooltipMin": { en: "Min", vi: "Thấp nhất" },
  "pat.tooltipMaxSpan": { en: "Max span", vi: "Toàn dải" },
  "pat.monthNames": {
    en: "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec",
    vi: "T1|T2|T3|T4|T5|T6|T7|T8|T9|T10|T11|T12",
  },

  // drivers page
  "drv.title": { en: "Weather–Load Relationships", vi: "Quan hệ Thời tiết–Tải" },
  "drv.subtitle": {
    en: "Hourly system load against observed weather — supporting context for forecast drivers",
    vi: "Tải hệ thống theo giờ với thời tiết quan sát — ngữ cảnh cho các yếu tố ảnh hưởng dự báo",
  },
  "drv.temp": { en: "Temperature (°C) vs Load", vi: "Nhiệt độ (°C) vs Tải" },
  "drv.humidity": { en: "Humidity (%) vs Load", vi: "Độ ẩm (%) vs Tải" },
  "drv.wind": { en: "Wind speed (m/s) vs Load", vi: "Gió (m/s) vs Tải" },
  "drv.load": { en: "Load", vi: "Tải" },
  "drv.qualityTitle": { en: "Data Quality", vi: "Chất lượng dữ liệu" },
  "drv.qualitySub": { en: "Source dataset integrity and processing summary", vi: "Tính toàn vẹn và tóm tắt xử lý của dữ liệu nguồn" },
  "drv.rawObs": { en: "Raw observations", vi: "Quan sát thô" },
  "drv.rawPeriod": { en: "Raw period", vi: "Giai đoạn gốc" },
  "drv.hourlySeries": { en: "Hourly series", vi: "Chuỗi theo giờ" },
  "drv.hourlyPeriod": { en: "Hourly period", vi: "Giai đoạn theo giờ" },
  "drv.missing": { en: "Missing timestamps", vi: "Thiếu mốc thời gian" },
  "drv.nulls": { en: "Null values", vi: "Giá trị null" },
  "drv.none": { en: "None", vi: "Không có" },
  "drv.aggregation": { en: "Aggregation:", vi: "Tổng hợp:" },
  "drv.totalDef": { en: "Total power definition:", vi: "Định nghĩa tổng công suất:" },
  "drv.units": { en: "Units:", vi: "Đơn vị:" },
  "drv.rowsAt": { en: "{n} rows @ {f}", vi: "{n} dòng @ {f}" },
  "drv.rows": { en: "{n} rows", vi: "{n} dòng" },
} as const;

export type I18nKey = keyof typeof dict;

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<LocaleCtx>({
  locale: "en",
  setLocale: () => {},
  t: (k) => dict[k].en,
});

function initialLocale(): Locale {
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (fromUrl === "vi" || fromUrl === "en") return fromUrl;
  const stored = window.localStorage.getItem("locale");
  if (stored === "vi" || stored === "en") return stored;
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    window.localStorage.setItem("locale", locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback(
    (key: I18nKey, params?: Record<string, string | number>) => {
      let s: string = dict[key]?.[locale] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.replaceAll(`{${k}}`, String(v));
        }
      }
      return s;
    },
    [locale],
  );

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

export function monthLabels(locale: Locale): string[] {
  return dict["pat.monthNames"][locale].split("|");
}
