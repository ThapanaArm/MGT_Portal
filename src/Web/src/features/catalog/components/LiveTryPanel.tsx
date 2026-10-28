import { useState } from "react";
import { AppIcon } from "@/shared/components/IconPicker";
import { Input, Segmented } from "@/shared/components/design-system";
import { Btn } from "@/shared/components/ui";
import FriendlyResult from "@/features/catalog/components/FriendlyResult";
import JsonTable from "@/features/catalog/components/JsonTable";
import { callGateway, type GatewayResult } from "@/features/catalog/gateway";
import { CopyButton } from "@/shared/components/CopyButton";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

/**
 * Sends a real request to the Gateway with the caller's application Token ID/Secret,
 * so people who don't use Postman can see live data from the catalog page.
 * Credentials stay in component state only and are never stored.
 */
export default function LiveTryPanel({
  category,
  endpoint,
  variant,
  values,
  onValuesChange: setValues,
  itemLabelMap,
  metaLabelMap,
}: {
  category: CategoryDto;
  endpoint: EndpointDto;
  variant: "business" | "developer";
  /** Query values live in EndpointCard so its Request URL bar and cURL update while typing. */
  values: Record<string, string>;
  onValuesChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  itemLabelMap: Record<string, string>;
  metaLabelMap: Record<string, string>;
}) {
  const queryParams = endpoint.params.filter((p) => p[1] === "query");
  const [tokenId, setTokenId] = useState("");
  const [tokenSecret, setTokenSecret] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<GatewayResult | null>(null);
  const [networkError, setNetworkError] = useState("");
  const formattedView = variant === "business" ? "Readable" : "Table";
  const [view, setView] = useState(formattedView);

  const send = async () => {
    if (!tokenId.trim() || !tokenSecret.trim()) {
      setTokenError("Enter the Token ID and Token Secret from your application's API credentials");
      return;
    }
    setSending(true);
    setNetworkError("");
    try {
      setResult(await callGateway(category.basePath, endpoint.path, values, tokenId, tokenSecret));
    } catch {
      setResult(null);
      setNetworkError("Couldn't reach the Gateway. Check that the Portal API is running.");
    } finally {
      setSending(false);
    }
  };

  const message = (result?.body as { message?: string } | null)?.message;

  return (
    <div className="border border-line rounded-lg p-3 bg-surface mt-3">
      <div className="flex items-center gap-2 mb-2.5 text-[14px] font-semibold">
        <AppIcon value="fa:play" /> Live request · real data through the Gateway
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <label className="text-[13.5px] text-ink-dim">
          Token ID
          <Input
            value={tokenId}
            onChange={(e) => { setTokenId(e.target.value); setTokenError(""); }}
            placeholder="mgc_id_test_a1b2c3"
            autoComplete="off"
            className="w-full mt-1 font-mono"
          />
        </label>
        <label className="text-[13.5px] text-ink-dim">
          Token Secret
          <Input
            type="password"
            value={tokenSecret}
            onChange={(e) => { setTokenSecret(e.target.value); setTokenError(""); }}
            placeholder="mgc_secret_test_..."
            autoComplete="off"
            className="w-full mt-1 font-mono"
          />
        </label>
        {queryParams.map(([name, , type, , description]) => (
          <label key={name} className="text-[13.5px] text-ink-dim">
            <code className="text-teal-strong">{name}</code>
            <Input
              type={type === "integer" ? "number" : "text"}
              value={values[name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
              title={description}
              className="w-full mt-1"
            />
          </label>
        ))}
      </div>
      {tokenError && <p className="text-[13px] text-danger mt-2">{tokenError}</p>}
      <div className="flex items-center gap-2.5 mt-3">
        <Btn variant="primary" onClick={send} loading={sending}>
          Send request
        </Btn>
        <span className="text-[13.5px] text-ink-faint">Sandbox tokens read sample data. Get tokens from your application's API credentials.</span>
      </div>

      {networkError && <p className="text-[13.5px] text-danger mt-3">{networkError}</p>}
      {result && (
        <div className="mt-3.5">
          <div className={`inline-flex items-center gap-1.5 text-[13.5px] font-mono rounded-full px-2.5 py-1 mb-2 ${result.ok ? "bg-post-soft text-post" : "bg-danger-soft text-danger"}`}>
            {result.status} · {result.ms}ms · {endpoint.method} {result.url}
          </div>
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <Segmented items={[formattedView, "JSON"]} value={view} onChange={setView} label="Response view" />
            {view === "JSON" && (
              <CopyButton value={JSON.stringify(result.body, null, 2)} label="Copy JSON" />
            )}
          </div>
          {view === "JSON" ? (
            <pre className="bg-surface-3 border border-line rounded-lg p-3 font-mono text-[13.5px] leading-relaxed overflow-auto max-h-[480px] whitespace-pre">{JSON.stringify(result.body, null, 2)}</pre>
          ) : !result.ok ? (
            <p className="text-[14.5px] text-danger">{message ?? "The Gateway rejected the request."}</p>
          ) : variant === "business" ? (
            <FriendlyResult json={JSON.stringify(result.body)} itemLabelMap={itemLabelMap} metaLabelMap={metaLabelMap} />
          ) : (
            <div className="border border-line rounded-lg p-3 bg-surface">
              <JsonTable json={JSON.stringify(result.body)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
