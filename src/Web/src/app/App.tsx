import { ThemeProvider } from "@/shared/lib/theme-context";
import { LocaleProvider } from "@/shared/lib/locale-context";
import { ToastProvider } from "@/shared/lib/toast";
import { AuthProvider } from "@/shared/lib/auth";
import AppRoutes from "@/app/routes";

/** Provider ทั้งหมดของแอป — AuthProvider ต้องอยู่ใน BrowserRouter เพราะใช้ useNavigate */
export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
