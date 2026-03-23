import React, { useEffect } from "react";
import { AuthProvider } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { I18nProvider } from "./hooks/useI18n";
import { ProductProvider } from "./providers/ProductProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { setupGlobalErrorHandling } from "./utils/apiUtils";
import AppLayout from "./components/layout/AppLayout";
import { useI18n } from "./hooks/useI18n";

const queryClient = new QueryClient();

function AppContent() {
  const { isRTL, tl } = useI18n();

  return (
    <ProductProvider>
      <AppLayout />
      <ToastContainer
        position="top-center"
        autoClose={3000}
        rtl={isRTL}
        ariaLabel={tl("Notifications")}
      />
    </ProductProvider>
  );
}

function App() {
  useEffect(() => {
    // Set up global error handling for API calls
    setupGlobalErrorHandling();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <I18nProvider>
            <AppContent />
          </I18nProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
