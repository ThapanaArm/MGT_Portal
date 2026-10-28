import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/shared/lib/auth";

/** Protect admin pages by role. Authentication is checked by PortalLayout; the API enforces authorization independently. */
export default function RequireAdmin() {
  const { user } = useAuth();
  if (user?.roleKey !== "admin") return <Navigate to="/ecosystem" replace />;
  return <Outlet />;
}
