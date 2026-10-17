import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/layout/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { DataDriversPage } from "@/pages/DataDriversPage";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

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
                <Route index element={<DashboardPage />} />
                <Route path="data-drivers" element={<DataDriversPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
