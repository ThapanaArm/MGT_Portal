import { AppIcon } from "@/shared/components/Icon";
import { Input,Select } from "@/shared/components/design-system";
import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";
import { useLocale } from "@/shared/lib/locale-context";
import { Btn, EmptyRow, EnvChip, Panel, ScopeTag } from "@/shared/components/ui";
import type { CategoryDto, CredEnv, EndpointDto, TokenDto } from "@/shared/lib/types";

export default function TokensPage() {
  const { user, hasScope } = useAuth();
  const { t } = useLocale();
  const toast = useToast();
  const [tokens, setTokens] = useState<TokenDto[]>([]);
  const [allScopes, setAllScopes] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [env, setEnv] = useState<CredEnv>("sandbox");
  const [expiry, setExpiry] = useState("90 days");

  const load = () => api.get<TokenDto[]>("/api/tokens").then(setTokens);

  useEffect(() => {
    load();
    api.get<CategoryDto[]>("/api/categories").then(async (cats) => {
      const all = await Promise.all(cats.map((c) => api.get<EndpointDto[]>(`/api/categories/${c.key}/endpoints`)));
      const scopes = Array.from(new Set(all.flat().map((e) => e.scope)));
      setAllScopes(scopes);
    });
  }, []);

  const toggle = (s: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const generate = async () => {
    if (checked.size === 0) {
      toast({ tone: "warning", message: "Select at least one scope" });
      return;
    }
    await api.post("/api/tokens", { scopes: Array.from(checked), env, expiry });
    toast(env === "production" ? "Production token created. Store it securely." : "Token created");
    setChecked(new Set());
    load();
  };

  const revoke = async (id: number) => {
    await api.del(`/api/tokens/${id}`);
    toast({ tone: "success", message: "Token revoked" });
    load();
  };

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    toast({ tone: "success", message: "Token copied" });
  };

  return (
    <div>
      <div className="portal-page-heading mb-3.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> My Account
        </div>
        <h1 className="text-[26px] font-bold">My Tokens</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">
          Create and manage tokens for Megachem APIs. Available scopes are restricted to your role ({user ? t(`roles.${user.roleKey}`) : ""})
        </p>
      </div>

      <div className="portal-settings-grid">
      <Panel title="Create token" hint="Choose scopes and an environment. Disabled scopes are not available to your role.">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(["sandbox", "production"] as const).map((e) => (
            <label key={e} className="flex items-center gap-2 border border-line-strong rounded-lg px-2.5 py-2 text-[15px] cursor-pointer">
              <Input type="radio" name="env" checked={env === e} onChange={() => setEnv(e)} className="accent-teal" />
              {e === "sandbox" ? "Developer (Sandbox)" : "Production"}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {allScopes.map((s) => {
            const ok = hasScope(s);
            return (
              <label key={s} className={`flex items-center gap-2 border border-line-strong rounded-lg px-2.5 py-2 text-[15px] ${ok ? "cursor-pointer" : "opacity-45 cursor-not-allowed"}`}>
                <Input type="checkbox" disabled={!ok} checked={checked.has(s)} onChange={() => toggle(s)} className="accent-teal" />
                <code className="font-mono text-[14px]">{s}</code>
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
          <label className="text-[15px] text-ink-dim">Expiration</label>
          <Select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="border border-line-strong bg-paper rounded-lg px-2.5 py-2 text-[15px]">
            <option>30 days</option>
            <option>90 days</option>
            <option>Never expires</option>
          </Select>
        </div>
        <Btn variant="primary" onClick={generate}><AppIcon value="fa:plus"/> Create token</Btn>
      </Panel>

      <Panel title="Active tokens" hint={`${tokens.length} token`}>
        {tokens.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr>
                  {["Token", "Environment", "Scope", "Created", "Expires in", ""].map((h) => (
                    <th key={h} className="text-left text-ink-faint text-[13px] uppercase tracking-wide font-bold pr-2.5 pb-2 border-b border-line whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 pr-2.5 border-b border-line"><code className="font-mono bg-surface-2 rounded-md px-2 py-0.5 text-[14px]">{t.value}</code></td>
                    <td className="py-2.5 pr-2.5 border-b border-line"><EnvChip env={t.env} /></td>
                    <td className="py-2.5 pr-2.5 border-b border-line">
                      <div className="flex gap-1 flex-wrap">
                        {t.scopes.map((s) => (
                          <ScopeTag key={s}>{s}</ScopeTag>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-2.5 border-b border-line whitespace-nowrap">{t.createdAt.slice(0, 10)}</td>
                    <td className="py-2.5 pr-2.5 border-b border-line whitespace-nowrap">{t.expiry}</td>
                    <td className="py-2.5 border-b border-line">
                      <div className="flex gap-1.5">
                        <Btn size="sm" onClick={() => copy(t.value)}>Copy</Btn>
                        <Btn size="sm" danger onClick={() => revoke(t.id)}>Revoke</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyRow>No tokens yet. Create your first token above.</EmptyRow>
        )}
      </Panel>
      </div>
    </div>
  );
}
