import { AppIcon } from "@/shared/components/Icon";
import { Btn } from "@/shared/components/ui";
import { Alert } from "@/shared/components/feedback";
import "./auth.css";
import { useState } from "react";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { useLocale } from "@/shared/lib/locale-context";
import { ApiError } from "@/shared/lib/api";

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
      <div className="auth-pattern-card">
        <section className="auth-pattern-brand">
          <div className="auth-pattern-motion" aria-hidden="true">
            <i className="auth-orb auth-orb-blue" /><i className="auth-orb auth-orb-green" /><i className="auth-orbit" />
            <span className="auth-security-chip"><AppIcon value="fa:tick"/> Secure access</span>
            <span className="auth-team-chip"><AppIcon value="fa:circle"/> For the Megachem team</span>
          </div>
          <div className="auth-pattern-brand-copy">
            <span className="auth-wordmark">MGT</span>
            <h1>Build better<br />systems.</h1>
            <p>One reliable foundation for every product team.</p>
            <span className="auth-brand-line" />
          </div>
        </section>
        <section className="auth-pattern-form-panel">
          <form onSubmit={submit} className="auth-pattern-form">
            <header><span>Welcome back</span><h2>Sign in to your workspace</h2></header>
            <div className="auth-field">
              <label htmlFor="login-email">{t("login.companyEmail")}</label>
              <input id="login-email" type="email" autoComplete="username" required placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="login-password">{t("login.password")}</label>
              <div className="auth-password-field">
                <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")} onClick={() => setShowPassword(!showPassword)}>
                  <AppIcon value={showPassword ? "fa:eye-slash" : "fa:eye"}/>
                </button>
              </div>
            </div>
            {error && <Alert tone="danger" title="Sign-in failed">{error}</Alert>}
            <Btn variant="primary" size="lg" className="auth-sign-in" type="submit" disabled={busy}>{busy ? t("login.loggingIn") : t("login.loginBtn")}<span aria-hidden="true"><AppIcon value="fa:arrow-right"/></span></Btn>
            <button className="auth-forgot" type="button" onClick={() => toast(t("login.forgotToast"))}>{t("login.forgotPassword")}</button>
            <details className="auth-more-options">
              <summary>Sign-in options</summary>
              <div>
                <label htmlFor="login-role">{t("login.role")}</label>
                <select id="login-role" value={roleIdx} onChange={(event) => {
                  const index = Number(event.target.value);
                  setRoleIdx(index); setEmail(ROLE_PRESETS[index].email); setPassword(ROLE_PRESETS[index].password);
                }}>{ROLE_PRESETS.map((role, index) => <option key={role.email} value={index}>{t(role.labelKey)}</option>)}</select>
                <label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />{t("login.rememberMe")}</label>
                <button type="button" onClick={() => toast(t("login.ssoToast"))}>{t("login.ssoBtn")}</button>
              </div>
            </details>
          </form>
        </section>
      </div>
    </div>
  );
}
