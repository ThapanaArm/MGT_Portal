import { AppIcon } from "@/shared/components/Icon";
import { useTheme } from "@/shared/lib/theme-context";

function SunIcon({ className }: { className?: string }) {
  return (
    <AppIcon value="fa:sun" className={className}/>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <AppIcon value="fa:moon" className={className}/>
  );
}

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <SunIcon className={!isDark ? "text-amber" : "text-ink-faint"} />
      <button
        type="button"
        onClick={toggle}
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`relative w-11 h-6 rounded-full border transition-colors duration-200 flex-shrink-0 ${
          isDark ? "bg-brand border-brand" : "bg-surface-2 border-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
            isDark ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <MoonIcon className={isDark ? "text-teal-strong" : "text-ink-faint"} />
    </div>
  );
}
