import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/shared/lib/auth";

/**
 * กันหน้า /admin/* ไม่ให้ผู้ใช้ทั่วไปเปิดได้ (ตรวจซ้ำกับ API ซึ่งเป็นตัวป้องกันจริง)
 * PortalLayout ตรวจแล้วว่า login อยู่ จึงเช็คแค่ role ที่นี่
 */
export default function RequireAdmin() {
  const { user } = useAuth();
  if (user?.roleKey !== "admin") return <Navigate to="/ecosystem" replace />;
  return <Outlet />;
}
