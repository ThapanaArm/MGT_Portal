import { useLocale } from "@/shared/lib/locale-context";

export default function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center border border-line-strong rounded-full p-0.5 bg-surface-2 flex-shrink-0">
      <button
        type="button"
        onClick={() => setLocale("th")}
        aria-pressed={locale === "th"}
        className={`px-2.5 py-1 rounded-full text-[13.5px] font-bold transition-colors ${
          locale === "th" ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
        }`}
      >
        TH
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`px-2.5 py-1 rounded-full text-[13.5px] font-bold transition-colors ${
          locale === "en" ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
        }`}
      >
        EN
      </button>
    </div>
  );
}
