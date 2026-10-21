import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/layout/Layout";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { EdaPage } from "@/pages/EdaPage";
import { ForecastPage } from "@/pages/ForecastPage";
import { ModelPage } from "@/pages/ModelPage";
import { ProcessedDataPage } from "@/pages/ProcessedDataPage";
import { RawDataPage } from "@/pages/RawDataPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/raw" replace />} />
                <Route path="raw" element={<RawDataPage />} />
                <Route path="processed" element={<ProcessedDataPage />} />
                <Route path="eda" element={<EdaPage />} />
                <Route path="model" element={<ModelPage />} />
                <Route path="forecast" element={<ForecastPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
