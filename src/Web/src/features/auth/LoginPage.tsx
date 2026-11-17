import { Btn } from "@/shared/components/ui";
import { Alert } from "@/shared/components/feedback";
import "./auth.css";
import { useState } from "react";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { useLocale } from "@/shared/lib/locale-context";
import { ApiError } from "@/shared/lib/api";
import { Link } from "react-router";

// Lucide icon paths (ISC).
const icons = {
  back: "m12 19-7-7 7-7m-7 7h14",
  eye: "M2.1 12.3a1 1 0 0 1 0-.6 10.75 10.75 0 0 1 19.8 0 1 1 0 0 1 0 .6 10.75 10.75 0 0 1-19.8 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  eyeOff: "m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8m-2.6-6.3a10.9 10.9 0 0 1 11 4.9 10.8 10.8 0 0 1-2.7 3.1M6 6.8A11 11 0 0 0 2 12a10.8 10.8 0 0 0 14.1 4.6",
  chevron: "m6 9 6 6 6-6",
};

function SignInIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[name]} />
    </svg>
  );
}

const ROLE_PRESETS = [
  { email: "sales.staff@megachem.co.th", password: "Sales@123", labelKey: "login.roleSales" },
  { email: "purchase.staff@megachem.co.th", password: "Purchase@123", labelKey: "login.rolePurchase" },
  { email: "finance.staff@megachem.co.th", password: "Finance@123", labelKey: "login.roleFinance" },
  { email: "hr.staff@megachem.co.th", password: "Hr@123", labelKey: "login.roleHr" },
  { email: "it-digital@megachem.co.th", password: "Admin@123", labelKey: "login.roleAdmin" },
];

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
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try { await login(email, password, remember); }
    catch (err) { setError(err instanceof ApiError ? err.message : t("login.loginFailed")); }
    finally { setBusy(false); }
  };
  return (
    <div className="auth-pattern-page">
      <div className="auth-shell">
        <Link className="auth-back" to="/"><SignInIcon name="back" /> Back to home</Link>
        <div className="auth-pattern-card">
          <aside className="auth-pattern-brand" aria-label="MGT Portal">
            <div className="auth-wordmark"><img src="/mgt-logo.png" alt="" /> MGT Portal</div>
            <div className="auth-brand-copy">
              <p>Apps for your team</p>
              <span>Open company apps, request an app for your team, and track its review.</span>
            </div>
          </aside>
          <section className="auth-pattern-form-panel">
            <form onSubmit={submit} className="auth-pattern-form">
              <header><h1>Sign in</h1><p>Use your company email to access MGT Portal.</p></header>
              <div className="auth-field">
                <label htmlFor="login-email">{t("login.companyEmail")}</label>
                <input id="login-email" type="email" autoComplete="username" required placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="auth-field">
                <label htmlFor="login-password">{t("login.password")}</label>
                <div className="auth-password-field">
                  <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")} onClick={() => setShowPassword(!showPassword)}>
                    <SignInIcon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </div>
              <label className="auth-remember">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} aria-labelledby="login-remember-label" aria-describedby="login-remember-hint" />
                <span>
                  <span id="login-remember-label">{t("login.rememberMe")}</span>
                  <small id="login-remember-hint">Reopen this browser and stay signed in until your session expires.</small>
                </span>
              </label>
              {error && <Alert tone="danger" title="Sign-in failed">{error}</Alert>}
              <Btn variant="primary" size="lg" className="auth-sign-in" type="submit" disabled={busy}>{busy ? t("login.loggingIn") : t("login.loginBtn")}</Btn>
              <button className="auth-forgot" type="button" onClick={() => toast(t("login.forgotToast"))}>{t("login.forgotPassword")}</button>
              <details className="auth-more-options">
                <summary>Other sign-in options <SignInIcon name="chevron" /></summary>
                <div>
                  <label htmlFor="login-role">{t("login.role")}</label>
                  <select id="login-role" value={roleIdx} onChange={(event) => {
                    const index = Number(event.target.value);
                    setRoleIdx(index); setEmail(ROLE_PRESETS[index].email); setPassword(ROLE_PRESETS[index].password);
                  }}>{ROLE_PRESETS.map((role, index) => <option key={role.email} value={index}>{t(role.labelKey)}</option>)}</select>
                  <button type="button" onClick={() => toast(t("login.ssoToast"))}>{t("login.ssoBtn")}</button>
                </div>
              </details>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
