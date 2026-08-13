"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api";

const ROLE_PRESETS = [
  { email: "sales.staff@megachem.co.th", password: "Sales@123", label: "พนักงานขาย (Sales)" },
  { email: "purchase.staff@megachem.co.th", password: "Purchase@123", label: "พนักงานจัดซื้อ (Purchase)" },
  { email: "finance.staff@megachem.co.th", password: "Finance@123", label: "พนักงานการเงิน (Finance)" },
  { email: "hr.staff@megachem.co.th", password: "Hr@123", label: "ฝ่ายบุคคล (HR)" },
  { email: "it-digital@megachem.co.th", password: "Admin@123", label: "ผู้ดูแลระบบ (Admin)" },
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
      setError(err instanceof ApiError ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mgt-logo.png" alt="MGT — Do It Right" className="h-9 w-auto object-contain" />

            <h1 className="mt-9 text-[42px] leading-none font-extrabold text-ink">
              MGT <span style={{ color: "var(--teal-strong)" }}>Hub</span>
            </h1>
            <div className="w-11 h-1 rounded-full mt-4 mb-4" style={{ background: "var(--teal)" }} />
            <div className="text-[19px] font-bold text-ink">สำหรับพนักงานทุกแผนก</div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-dim max-w-[36ch]">
              เข้าถึง API ของบริษัทแบบรวมศูนย์ พร้อมระบบสิทธิ์ตามบทบาท (Role-based Access) และ Token
              สำหรับเรียกใช้งานแต่ละหมวดหมู่
            </p>
          </div>

          {/* Illustration: isometric cards evoking "API" + secured access, built with real 3D transforms (no source asset available for this) */}
          <div className="relative h-[210px] mt-8 flex items-center justify-center select-none" aria-hidden style={{ perspective: "1000px" }}>
            <div className="relative" style={{ transformStyle: "preserve-3d", transform: "rotateX(52deg) rotateZ(-38deg)" }}>
              {/* base platform */}
              <div
                className="absolute rounded-[28px]"
                style={{
                  width: 190,
                  height: 190,
                  left: -95,
                  top: -95,
                  background: "rgba(255,255,255,.55)",
                  transform: "translateZ(0px)",
                  boxShadow: "0 6px 30px rgba(10,84,78,.18)",
                }}
              />
              {/* API card — extruded block: side face + top face */}
              <div className="absolute" style={{ transform: "translate(-46px, -34px) translateZ(0px)" }}>
                <div className="absolute rounded-2xl" style={{ width: 118, height: 88, left: 0, top: 0, background: "var(--teal-strong)" }} />
                <div
                  className="absolute rounded-2xl flex items-center justify-center"
                  style={{ width: 118, height: 88, left: 0, top: 0, transform: "translateZ(26px)", background: "linear-gradient(155deg, var(--teal), var(--teal-strong))" }}
                >
                  <span className="text-white font-extrabold text-[18px] tracking-wide" style={{ transform: "rotateZ(38deg) rotateX(-52deg)" }}>
                    API
                  </span>
                </div>
              </div>
              {/* Lock card — extruded block */}
              <div className="absolute" style={{ transform: "translate(28px, 20px) translateZ(0px)" }}>
                <div className="absolute rounded-2xl" style={{ width: 104, height: 104, left: 0, top: 0, background: "#CFE3DE" }} />
                <div
                  className="absolute rounded-2xl flex items-center justify-center bg-white"
                  style={{ width: 104, height: 104, left: 0, top: 0, transform: "translateZ(30px)" }}
                >
                  <span style={{ color: "var(--teal-strong)", transform: "rotateZ(38deg) rotateX(-52deg)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9">
                      <rect x="4" y="10.5" width="16" height="9.5" rx="2" />
                      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Right panel: form ---- */}
        <form onSubmit={submit} className="p-10 md:p-12 flex flex-col gap-4">
          <div>
            <h2 className="text-[24px] font-extrabold text-ink">เข้าสู่ระบบ</h2>
            <div className="text-ink-dim text-[13px] mt-1.5 leading-relaxed">
              ใช้บัญชี Megachem SSO ของคุณ
              <br />
              (ต้นแบบ — ไม่เชื่อมต่อระบบจริง)
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] text-ink-dim font-semibold">อีเมลบริษัท</label>
            <div className={inputWrap}>
              <span className="text-ink-faint flex-shrink-0"><IconMail /></span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="firstname.l@megachem.co.th"
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-faint"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] text-ink-dim font-semibold">รหัสผ่าน</label>
            <div className={inputWrap}>
              <span className="text-ink-faint flex-shrink-0"><IconLock /></span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                required
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-ink-faint hover:text-ink-dim flex-shrink-0"
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                <IconEye off={showPassword} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] text-ink-dim font-semibold">บทบาท (สำหรับแผนก)</label>
            <div className={`${inputWrap} relative`}>
              <span className="text-ink-faint flex-shrink-0"><IconUser /></span>
              <select
                value={roleIdx}
                onChange={(e) => applyRole(Number(e.target.value))}
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink appearance-none pr-5"
              >
                {ROLE_PRESETS.map((r, i) => (
                  <option key={r.email} value={i}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="text-ink-faint flex-shrink-0 pointer-events-none absolute right-3.5">
                <IconChevron />
              </span>
            </div>
          </div>

          {error && <div className="text-[12.5px] text-danger bg-danger-soft rounded-lg px-3 py-2">{error}</div>}

          <div className="flex items-center justify-between text-[12.5px] -mt-1">
            <label className="flex items-center gap-2 cursor-pointer text-ink-dim">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-[var(--teal)]"
              />
              จำฉันไว้ในระบบ
            </label>
            <button
              type="button"
              onClick={() => toast("กรุณาติดต่อฝ่าย IT เพื่อรีเซ็ตรหัสผ่าน")}
              className="font-semibold hover:underline"
              style={{ color: "var(--teal-strong)" }}
            >
              ลืมรหัสผ่าน?
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 text-white rounded-xl py-3.5 text-[14px] font-bold mt-1 disabled:opacity-60"
            style={{ background: "var(--teal-strong)" }}
          >
            <IconLock />
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

          <div className="flex items-center gap-3 text-[11.5px] text-ink-faint my-0.5">
            <span className="flex-1 h-px bg-line" />
            หรือ
            <span className="flex-1 h-px bg-line" />
          </div>

          <button
            type="button"
            onClick={() => toast("การเข้าสู่ระบบด้วย SSO ยังไม่เปิดใช้งานในต้นแบบนี้")}
            className="flex items-center justify-center gap-2 border border-line-strong rounded-xl py-3.5 text-[14px] font-bold text-ink hover:bg-surface-2"
          >
            <IconKey />
            เข้าสู่ระบบด้วย SSO
          </button>

          <div className="flex items-start gap-2 text-[11px] text-ink-faint mt-2 leading-relaxed">
            <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }}>
              <IconShield />
            </span>
            <span>
              ระบบภายในสำหรับพนักงานเท่านั้น
              <br />© 2026 Megachem (สงวนลิขสิทธิ์)
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
