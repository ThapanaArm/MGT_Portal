import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";

export default function HomeRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate(user ? "/ecosystem" : "/login", { replace: true });
  }, [loading, user, navigate]);

  return null;
}
