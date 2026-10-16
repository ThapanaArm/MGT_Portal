import { useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { useLocale } from "@/shared/lib/locale-context";
import ThemeToggle from "@/shared/components/ThemeToggle";
import LanguageToggle from "@/shared/components/LanguageToggle";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-line bg-surface px-6.5 py-2.5">
      <LanguageToggle />
      <ThemeToggle />
      <div className="flex items-center gap-2 pl-3 border-l border-line" title={user?.email}>
        <div className="w-7 h-7 rounded-full bg-amber-soft text-amber flex items-center justify-center text-[13.5px] font-bold flex-shrink-0">
          {user?.displayName?.slice(0, 2) ?? "--"}
        </div>
        <span className="text-[15px] font-semibold whitespace-nowrap">{user ? t(`roles.${user.roleKey}`) : ""}</span>
      </div>
      <button
        onClick={() => {
          logout();
          navigate("/login");
        }}
        className="text-[14.5px] font-semibold border border-line-strong rounded-lg px-3 py-1.5 hover:bg-surface-2 whitespace-nowrap"
      >
        {t("common.logout")}
      </button>
    </header>
  );
}
