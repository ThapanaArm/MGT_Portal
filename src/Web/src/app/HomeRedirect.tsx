import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import LoadingScreen from "@/shared/components/LoadingScreen";

export default function HomeRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate(user ? "/dashboard" : "/login", { replace: true });
  }, [loading, user, navigate]);

  return <LoadingScreen fullScreen delay={150} message="Loading MGT Hub" detail="Checking your sign-in..." />;
}
