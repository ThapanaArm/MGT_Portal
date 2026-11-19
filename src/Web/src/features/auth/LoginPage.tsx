import { AppIcon } from "@/shared/components/Icon";
import { Btn } from "@/shared/components/ui";
import { Alert } from "@/shared/components/feedback";
import "./auth.css";
import { useEffect, useState } from "react";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { useLocale } from "@/shared/lib/locale-context";
import { api, ApiError } from "@/shared/lib/api";

/** Development-only quick sign-in list (GET /api/auth/dev-accounts answers 404 outside Development). */
interface DevAccount { email: string; displayName: string; roleName: string }

export default function LoginPage() {
  const { login, devLogin } = useAuth();
  const toast = useToast();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devAccounts, setDevAccounts] = useState<DevAccount[]>([]);

  useEffect(() => {
    let active = true;
    api.get<DevAccount[]>("/api/auth/dev-accounts").then((rows) => { if (active) setDevAccounts(rows); }).catch(() => { /* not Development: no quick sign-in */ });
    return () => { active = false; };
  }, []);

  const quickSignIn = async (accountEmail: string) => {
    if (!accountEmail) return;
    setError(null);
    setBusy(true);
    try { await devLogin(accountEmail, remember); }
    catch (err) { setError(err instanceof ApiError ? err.message : t("login.loginFailed")); }
    finally { setBusy(false); }
  };
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
              <input id="login-email" type="email" autoComplete="username" autoFocus required placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
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
            <details className="auth-more-options" open={devAccounts.length > 0 || undefined}>
              <summary>Sign-in options</summary>
              <div>
                {devAccounts.length > 0 && <>
                  <label htmlFor="login-quick">Quick sign-in (development only)</label>
                  <select id="login-quick" value="" disabled={busy} onChange={(event) => void quickSignIn(event.target.value)}>
                    <option value="" disabled>Choose an account to sign in as…</option>
                    {devAccounts.map((account) => <option key={account.email} value={account.email}>{account.displayName} · {account.roleName}</option>)}
                  </select>
                </>}
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
