import { useState } from "react";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { useLocale } from "@/shared/lib/locale-context";
import { ApiError } from "@/shared/lib/api";
import LanguageToggle from "@/shared/components/LanguageToggle";

const ROLE_PRESETS = [
  { email: "sales.staff@megachem.co.th", password: "Sales@123", labelKey: "login.roleSales" },
  { email: "purchase.staff@megachem.co.th", password: "Purchase@123", labelKey: "login.rolePurchase" },
  { email: "finance.staff@megachem.co.th", password: "Finance@123", labelKey: "login.roleFinance" },
  { email: "hr.staff@megachem.co.th", password: "Hr@123", labelKey: "login.roleHr" },
  { email: "it-digital@megachem.co.th", password: "Admin@123", labelKey: "login.roleAdmin" },
];

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
      <rect x="4" y="10.5" width="16" height="9.5" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5" />
    </svg>
  );
}
function IconEye({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5" />
          <path d="M6.6 6.7C4.5 8.1 3 10 2 12c1.7 3.6 5.5 7 10 7 1.6 0 3.1-.4 4.5-1.1M9.8 5.2A10.6 10.6 0 0 1 12 5c4.5 0 8.3 3.4 10 7a13.4 13.4 0 0 1-2.3 3.4" />
        </>
      ) : (
        <>
          <path d="M2 12c1.7-3.6 5.5-7 10-7s8.3 3.4 10 7c-1.7 3.6-5.5 7-10 7s-8.3-3.4-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M16.5 5.5l2 2M13.5 8.5l2 2" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
// This page is a branded entry screen and is designed to always look the same
// regardless of the visitor's OS/browser theme — so the shared dark-mode media
// query (which otherwise flips --surface/--ink/etc. for the rest of the app)
// is deliberately overridden here with the light values, scoped to this page only.
const LIGHT_THEME_VARS = {
  "--paper": "#f5f6f4",
  "--surface": "#ffffff",
  "--surface-2": "#edf0ee",
  "--surface-3": "#e4e8e5",
  "--ink": "#12181a",
  "--ink-dim": "#4b5457",
  "--ink-faint": "#7c8688",
  "--line": "rgba(18, 24, 26, 0.10)",
  "--line-strong": "rgba(18, 24, 26, 0.20)",
  "--teal": "#0e6e66",
  "--teal-strong": "#0a544e",
  "--teal-soft": "#e3f1ee",
  "--amber": "#b96a24",
  "--amber-soft": "#f7e9da",
  "--danger": "#b2413a",
  "--danger-soft": "#f6e4e2",
} as React.CSSProperties;

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const { t } = useLocale();
  const [roleIdx, setRoleIdx] = useState(0);
  const [email, setEmail] = useState(ROLE_PRESETS[0].email);
  const [password, setPassword] = useState(ROLE_PRESETS[0].password);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyRole = (idx: number) => {
    setRoleIdx(idx);
    setEmail(ROLE_PRESETS[idx].email);
    setPassword(ROLE_PRESETS[idx].password);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, remember);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  const inputWrap = "flex items-center gap-2.5 border border-line-strong bg-paper rounded-xl px-3.5 py-3 focus-within:border-teal transition-colors";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ ...LIGHT_THEME_VARS, background: "linear-gradient(160deg, #EAF4F2, #F7FAF9)" }}
    >
      <div className="relative w-full max-w-[1000px] grid grid-cols-1 md:grid-cols-[1.05fr_1fr] bg-surface rounded-[28px] shadow-2xl overflow-hidden">
        {/* ---- Left panel ---- */}
        <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden" style={{ background: "linear-gradient(165deg, #E4F1EE, #F1F8F6)" }}>
          <div>
            <img src="/mgt-logo.png" alt="MGT — Do It Right" className="h-9 w-auto object-contain" />

            <h1 className="mt-9 text-[46px] leading-none font-extrabold text-ink">
              MGT <span style={{ color: "var(--teal-strong)" }}>Hub</span>
            </h1>
            <div className="w-11 h-1 rounded-full mt-4 mb-4" style={{ background: "var(--teal)" }} />
            <div className="text-[22px] font-bold text-ink">{t("login.forDepartment")}</div>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-dim max-w-[36ch]">{t("login.heroDesc")}</p>
          </div>

          {/* Illustration: aurora-lit tile with a glass "API request" card and a floating security
              badge — depicts an authorized API call. Pure CSS (no source asset available for this). */}
          <div
            className="relative h-[268px] mt-8 rounded-[26px] overflow-hidden select-none"
            aria-hidden
            style={{ background: "linear-gradient(155deg, #04100f, #06201c 45%, #0b2a25)" }}
          >
            {/* aurora blobs */}
            <div className="absolute rounded-full" style={{ width: 280, height: 280, left: -80, top: -110, background: "radial-gradient(circle, rgba(95,208,194,.5), transparent 62%)", filter: "blur(34px)" }} />
            <div className="absolute rounded-full" style={{ width: 240, height: 240, right: -70, bottom: -100, background: "radial-gradient(circle, rgba(14,110,102,.75), transparent 62%)", filter: "blur(36px)" }} />
            <div className="absolute rounded-full" style={{ width: 160, height: 160, right: 30, top: -60, background: "radial-gradient(circle, rgba(224,149,75,.3), transparent 62%)", filter: "blur(32px)" }} />

            {/* fine grid, faded at the edges */}
            <div
              className="absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
                maskImage: "radial-gradient(115% 85% at 50% 42%, #000 38%, transparent 76%)",
                WebkitMaskImage: "radial-gradient(115% 85% at 50% 42%, #000 38%, transparent 76%)",
              }}
            />

            {/* drifting light specks */}
            <span className="absolute w-1 h-1 rounded-full bg-white/60 mgt-float-soft" style={{ left: "12%", top: "26%" }} />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-[#7ee0d1]/70 mgt-float" style={{ right: "13%", top: "20%" }} />
            <span className="absolute w-1 h-1 rounded-full bg-[#e0954b]/70 mgt-float-soft" style={{ right: "20%", bottom: "16%" }} />

            <div className="relative h-full flex items-center justify-center">
              <div className="relative mgt-float">
                {/* Glass request card */}
                <div
                  className="relative w-[286px] rounded-[18px] overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,.09)",
                    border: "1px solid rgba(255,255,255,.2)",
                    boxShadow: "0 26px 55px -14px rgba(0,0,0,.65)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                  }}
                >
                  {/* light sweep across the glass */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                      className="absolute top-0 bottom-0 w-16 mgt-sweep"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent)" }}
                    />
                  </div>

                  {/* title bar */}
                  <div className="relative flex items-center gap-1.5 px-3.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    <span className="w-[7px] h-[7px] rounded-full bg-white/25" />
                    <span className="w-[7px] h-[7px] rounded-full bg-white/25" />
                    <span className="w-[7px] h-[7px] rounded-full bg-white/25" />
                    <span
                      className="ml-auto text-[11.5px] font-bold tracking-[0.12em] rounded-full px-2 py-[3px]"
                      style={{ color: "#8ee8da", background: "rgba(126,224,209,.14)", border: "1px solid rgba(126,224,209,.3)" }}
                    >
                      200 OK
                    </span>
                  </div>

                  {/* request line */}
                  <div className="relative px-3.5 pt-3.5 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] font-extrabold tracking-wider rounded px-1.5 py-[3px]" style={{ color: "#06302b", background: "#5fd0c2" }}>
                        GET
                      </span>
                      <span className="font-mono text-[14px] text-white/90">/v1/sales/orders</span>
                    </div>

                    {/* response skeleton */}
                    <div className="mt-3.5 flex flex-col gap-[7px]">
                      <div className="flex gap-1.5">
                        <span className="h-[7px] rounded-full bg-white/22" style={{ width: "34%" }} />
                        <span className="h-[7px] rounded-full" style={{ width: "22%", background: "rgba(126,224,209,.55)" }} />
                        <span className="h-[7px] rounded-full bg-white/14" style={{ width: "18%" }} />
                      </div>
                      <div className="flex gap-1.5">
                        <span className="h-[7px] rounded-full bg-white/14" style={{ width: "26%" }} />
                        <span className="h-[7px] rounded-full bg-white/22" style={{ width: "42%" }} />
                      </div>
                      <div className="flex gap-1.5">
                        <span className="h-[7px] rounded-full" style={{ width: "20%", background: "rgba(224,149,75,.5)" }} />
                        <span className="h-[7px] rounded-full bg-white/14" style={{ width: "30%" }} />
                        <span className="h-[7px] rounded-full bg-white/22" style={{ width: "16%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating security badge */}
                <div className="absolute -right-5 -bottom-5 mgt-float-soft">
                  <span className="absolute inset-0 rounded-[18px] mgt-ring" style={{ background: "rgba(95,208,194,.45)" }} />
                  <div
                    className="relative w-[58px] h-[58px] rounded-[18px] flex items-center justify-center"
                    style={{
                      background: "linear-gradient(145deg, #6fdccd, #0e6e66)",
                      border: "1px solid rgba(255,255,255,.35)",
                      boxShadow: "0 14px 30px -6px rgba(0,0,0,.55), 0 0 34px rgba(95,208,194,.45)",
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <rect x="4" y="10.5" width="16" height="9.5" rx="2" />
                      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
                    </svg>
                  </div>
                </div>

                {/* Scope chip */}
                <div
                  className="absolute -left-4 -top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 mgt-float-soft"
                  style={{
                    background: "rgba(255,255,255,.12)",
                    border: "1px solid rgba(255,255,255,.24)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    boxShadow: "0 10px 24px -8px rgba(0,0,0,.5)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#7ee0d1" }} />
                  <span className="font-mono text-[12px] text-white/85">sales.read</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Right panel: form ---- */}
        <form onSubmit={submit} className="p-10 md:p-12 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[28px] font-extrabold text-ink">{t("login.title")}</h2>
              <div className="text-ink-dim text-[15.5px] mt-1.5 leading-relaxed">
                {t("login.subtitleLine1")}
                <br />
                {t("login.subtitleLine2")}
              </div>
            </div>
            <LanguageToggle />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[15px] text-ink-dim font-semibold">{t("login.companyEmail")}</label>
            <div className={inputWrap}>
              <span className="text-ink-faint flex-shrink-0"><IconMail /></span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="firstname.l@megachem.co.th"
                className="flex-1 min-w-0 bg-transparent outline-none text-[16.5px] text-ink placeholder:text-ink-faint"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[15px] text-ink-dim font-semibold">{t("login.password")}</label>
            <div className={inputWrap}>
              <span className="text-ink-faint flex-shrink-0"><IconLock /></span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                required
                className="flex-1 min-w-0 bg-transparent outline-none text-[16.5px] text-ink"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-ink-faint hover:text-ink-dim flex-shrink-0"
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              >
                <IconEye off={showPassword} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[15px] text-ink-dim font-semibold">{t("login.role")}</label>
            <div className={`${inputWrap} relative`}>
              <span className="text-ink-faint flex-shrink-0"><IconUser /></span>
              <select
                value={roleIdx}
                onChange={(e) => applyRole(Number(e.target.value))}
                className="flex-1 min-w-0 bg-transparent outline-none text-[16.5px] text-ink appearance-none pr-5"
              >
                {ROLE_PRESETS.map((r, i) => (
                  <option key={r.email} value={i}>
                    {t(r.labelKey)}
                  </option>
                ))}
              </select>
              <span className="text-ink-faint flex-shrink-0 pointer-events-none absolute right-3.5">
                <IconChevron />
              </span>
            </div>
          </div>

          {error && <div className="text-[15px] text-danger bg-danger-soft rounded-lg px-3 py-2">{error}</div>}

          <div className="flex items-center justify-between text-[15px] -mt-1">
            <label className="flex items-center gap-2 cursor-pointer text-ink-dim">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-[var(--teal)]"
              />
              {t("login.rememberMe")}
            </label>
            <button
              type="button"
              onClick={() => toast(t("login.forgotToast"))}
              className="font-semibold hover:underline"
              style={{ color: "var(--teal-strong)" }}
            >
              {t("login.forgotPassword")}
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 text-white rounded-xl py-3.5 text-[16.5px] font-bold mt-1 disabled:opacity-60"
            style={{ background: "var(--teal-strong)" }}
          >
            <IconLock />
            {busy ? t("login.loggingIn") : t("login.loginBtn")}
          </button>

          <div className="flex items-center gap-3 text-[14px] text-ink-faint my-0.5">
            <span className="flex-1 h-px bg-line" />
            {t("login.or")}
            <span className="flex-1 h-px bg-line" />
          </div>

          <button
            type="button"
            onClick={() => toast(t("login.ssoToast"))}
            className="flex items-center justify-center gap-2 border border-line-strong rounded-xl py-3.5 text-[16.5px] font-bold text-ink hover:bg-surface-2"
          >
            <IconKey />
            {t("login.ssoBtn")}
          </button>

          <div className="flex items-start gap-2 text-[13.5px] text-ink-faint mt-2 leading-relaxed">
            <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }}>
              <IconShield />
            </span>
            <span>
              {t("login.internalOnly")}
              <br />
              {t("login.copyright")}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
