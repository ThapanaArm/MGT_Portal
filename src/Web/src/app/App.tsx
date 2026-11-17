import { EditingGuardProvider } from "@/shared/lib/editing-guard";
import { ThemeProvider } from "@/shared/lib/theme-context";
import { LocaleProvider } from "@/shared/lib/locale-context";
import { ToastProvider } from "@/shared/lib/toast";
import { AuthProvider } from "@/shared/lib/auth";
import AppRoutes from "@/app/routes";

/** All application providers. AuthProvider requires a router for navigation. */
export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <ToastProvider>
          <EditingGuardProvider><AuthProvider>
            <AppRoutes />
          </AuthProvider></EditingGuardProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

