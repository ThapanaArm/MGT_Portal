import { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { useEnv } from "@/features/catalog/env-context";
import { useAudience } from "@/features/catalog/audience-context";
import { useToast } from "@/shared/lib/toast";
import { api } from "@/shared/lib/api";
import { MethodBadge, Btn } from "@/shared/components/ui";
import LiveTryPanel from "@/features/catalog/components/LiveTryPanel";
import AiCopyButton from "@/features/catalog/components/AiCopyButton";
import { isLiveEndpoint, buildQuery, hasCatalogScope, GATEWAY_TOKEN_ID_HEADER, GATEWAY_TOKEN_SECRET_HEADER } from "@/features/catalog/gateway";
import { buildCurl, buildEndpointMarkdown, gatewayUrl, isWrite, prettyJson, requestBody, resolvedScope, hasModuleChoice, IDEMPOTENCY_HEADER, ZOHO_MODULES, DEFAULT_ZOHO_MODULE, type ZohoModule } from "@/features/catalog/aiSpec";
import { Segmented } from "@/shared/components/design-system";
import { CopyButton } from "@/shared/components/CopyButton";
import type { AppSummaryDto, CategoryDto, EndpointDto } from "@/shared/lib/types";

function ParamTable({ rows, headers, requiredCol }: { rows: string[][]; headers: string[]; requiredCol?: number }) {
  if (!rows.length) return <div className="text-[15px] text-ink-faint">No parameters</div>;
  return (
    <table className="w-full border-collapse text-[15px]">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} className="text-left text-ink-faint font-semibold text-[13px] uppercase tracking-wide pb-1.5 pr-2 border-b border-line">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => {
              const isRequired = j === requiredCol && (cell === "yes" || cell === "required");
              const isOptional = j === requiredCol && (cell === "no" || cell === "optional");
              return (
                <td key={j} className="py-1.5 pr-2 border-b border-line align-top">
                  {j === 0 ? (
                    <code className="text-teal-strong text-[14.5px]">{cell}</code>
                  ) : isRequired ? (
                    <span className="text-danger text-[12.5px] font-bold">required</span>
                  ) : isOptional ? (
                    "optional"
                  ) : (
                    cell
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function paramsSentence(params: EndpointDto["params"]): string {
  if (!params.length) return "";
  const required = params.filter((p) => p[3] === "yes").map((p) => p[4]);
  const optional = params.filter((p) => p[3] !== "yes").map((p) => p[4]);
  const parts: string[] = [];
  if (required.length) parts.push("Required: " + required.join(", "));
  if (optional.length) parts.push("Optional: " + optional.join(", "));
  return parts.join(" · ");
}

/**
 * Splits respFields into item-level labels ("data[].total" → "total") and
 * top-level/meta labels ("total" stays "total") — the same bare name can mean
 * different things at each level, so they must not be merged into one map.
 */
function buildLabelMaps(respFields: EndpointDto["respFields"]): { item: Record<string, string>; meta: Record<string, string> } {
  const item: Record<string, string> = {};
  const meta: Record<string, string> = {};
  for (const [field, , desc] of respFields) {
    if (field.startsWith("data[].")) {
      item[field.slice("data[].".length)] = desc;
    } else {
      meta[field] = desc;
    }
  }
  return { item, meta };
}

export default function EndpointCard({
  category,
  endpoint,
  categoryLabel,
  detailsOnly = false,
}: {
  category: CategoryDto;
  endpoint: EndpointDto;
  /** Shown as a small tag above the headline — used on the cross-category search page where results mix categories. */
  categoryLabel?: string;
  detailsOnly?: boolean;
}) {
  const { user, hasScope } = useAuth();
  const { env } = useEnv();
  const { audience } = useAudience();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(detailsOnly);
  const [myApps, setMyApps] = useState<AppSummaryDto[] | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  // Query values typed into the live Try-it panel; kept here so the Request URL bar follows them.
  const [queryValues, setQueryValues] = useState<Record<string, string>>(() =>
    endpoint.params.some((p) => p[0] === "limit" && p[1] === "query") ? { limit: "5" }
      : endpoint.params.some((p) => p[0] === "module" && p[1] === "query") ? { module: DEFAULT_ZOHO_MODULE }
        : ({} as Record<string, string>));
  // Zoho cards serve several modules — the chosen one fills {module} in the URL, cURL and examples.
  const [zohoModule, setZohoModule] = useState<ZohoModule>(DEFAULT_ZOHO_MODULE);
  const moduleChoice = hasModuleChoice(endpoint);
  const chosenModule = moduleChoice ? zohoModule : undefined;

  const allowed = hasCatalogScope(hasScope, endpoint.scope);
  // Live endpoints are served by the real Gateway; anything else is documentation only.
  const live = isLiveEndpoint(category.key, endpoint.method, endpoint.path);
  // The in-page Try it sends real GET requests only, and only where no path value is needed.
  const canTryLive = live && endpoint.method.toUpperCase() === "GET" && !endpoint.path.includes("{");
  const write = isWrite(endpoint.method);
  const labelMaps = buildLabelMaps(endpoint.respFields);

  useEffect(() => {
    if (open && audience === "business" && myApps === null) {
      api
        .get<AppSummaryDto[]>("/api/applications")
        .then((apps) => setMyApps(apps.filter((a) => a.ownerEmail === user?.email)))
        .catch(() => setMyApps([]));
    }
  }, [open, audience, myApps, user?.email]);

  const myActiveApp = myApps?.find((a) => a.status === "active" && a.products.includes(category.key));
  const qs = canTryLive ? buildQuery(queryValues) : "";
  const baseUrl = canTryLive ? gatewayUrl(category, endpoint) : gatewayUrl(category, endpoint, false, chosenModule);
  const requestUrl = qs ? `${baseUrl}?${qs}` : baseUrl;
  const curl = buildCurl(category, endpoint, chosenModule);
  const requestJson = moduleChoice ? requestBody(endpoint, chosenModule) : prettyJson(endpoint.reqBody);
  const scope = resolvedScope(endpoint, chosenModule);
  const responseJson = prettyJson(endpoint.respExample);
  const aiText = () => buildEndpointMarkdown(category, endpoint, true, chosenModule);
  const chooseModule = (label: string) => {
    const next = ZOHO_MODULES.find((m) => m.label === label)?.value ?? DEFAULT_ZOHO_MODULE;
    setZohoModule(next);
    if (canTryLive) setQueryValues((values) => ({ ...values, module: next }));
  };
  const moduleChooser = moduleChoice && (
    <div className="endpoint-module-choice">
      <span className="endpoint-module-label">Zoho module</span>
      <Segmented label="Zoho module" items={ZOHO_MODULES.map((m) => m.label)} value={ZOHO_MODULES.find((m) => m.value === zohoModule)?.label ?? ""} onChange={chooseModule} />
      <span className="endpoint-ai-hint">Pick what your app works with — it fills <code>{endpoint.path.includes("{module}") ? "{module}" : "module"}</code> with <code>{zohoModule}</code> in the URL, cURL and examples.</span>
    </div>
  );
  const detailParams = endpoint.params.filter(
    (p) => ![GATEWAY_TOKEN_ID_HEADER, GATEWAY_TOKEN_SECRET_HEADER, IDEMPOTENCY_HEADER].includes(p[0]),
  );

  const requestUrlBar = (
    <div className="request-url-bar">
      <span className="request-url-label">Request URL</span>
      <div className="request-url-box">
        <MethodBadge method={endpoint.method} />
        <code>{requestUrl}</code>
        <CopyButton value={requestUrl} label="Copy URL" />
      </div>
    </div>
  );

  const facts = (
    <div className="endpoint-facts">
      {scope && <span className="endpoint-fact"><AppIcon value="fa:lock" /> Scope <code>{scope}</code></span>}
      <span className="endpoint-fact"><AppIcon value="fa:code" /> Headers <code>{GATEWAY_TOKEN_ID_HEADER}</code> <code>{GATEWAY_TOKEN_SECRET_HEADER}</code>{write && <code>{IDEMPOTENCY_HEADER}</code>}</span>
      <span className="endpoint-fact"><AppIcon value="fa:info" /> {env === "sandbox" ? "Use a Sandbox token (test systems: SAP DEV, Zoho sandbox)" : "Use a Production token (live data)"}</span>
      {!live && <span className="endpoint-fact is-warning"><AppIcon value="fa:warning" /> Not available in the Gateway yet — documentation only</span>}
    </div>
  );

  const aiActions = (hint: string) => (
    <div className="endpoint-ai-actions">
      <AiCopyButton text={aiText} />
      <CopyButton value={curl} label="Copy cURL" />
      <span className="endpoint-ai-hint">{hint}</span>
    </div>
  );

  const requestAccess = async () => {
    setRequestLoading(true);
    try {
      const apps: AppSummaryDto[] =
        myApps ?? (await api.get<AppSummaryDto[]>("/api/applications").then((all) => all.filter((a) => a.ownerEmail === user?.email)));
      if (myApps === null) setMyApps(apps);
      navigate(apps.length === 0 ? "/my-apps?new=1" : "/my-apps");
    } catch {
      toast({ tone: "success", message: "Unable to check application access. Please try again." });
    } finally {
      setRequestLoading(false);
    }
  };

  const headerRow = <div className="endpoint-summary-row"><button type="button" className="endpoint-summary-button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span className="endpoint-service-icon"><AppIcon value={endpoint.icon} /></span><span className="endpoint-service-copy">{categoryLabel && <span className="endpoint-category-label">{categoryLabel}</span>}<strong>{endpoint.summary}</strong><span className="endpoint-path-line"><MethodBadge method={endpoint.method} /><code>{endpoint.path}</code></span></span><span className="endpoint-open-label">{open ? "Close details" : "View details"}<span className={open ? "endpoint-chevron is-open" : "endpoint-chevron"}><AppIcon value="fa:chevron-right" /></span></span></button></div>;

  return (
    <div className={`portal-endpoint border border-line rounded-[10px] bg-surface mb-2.5 overflow-hidden ${audience === "developer" && !allowed ? "opacity-70" : ""}`}>
      {!detailsOnly && headerRow}
      {(endpoint.sourcePlatform || open) && <div className="endpoint-source"><AppIcon value="fa:globe" /> Source platform: <strong>{endpoint.sourcePlatform || "Not specified"}</strong></div>}

      {open && audience === "business" && (
        <div className="border-t border-line p-4 bg-paper">
          {moduleChooser}
          {requestUrlBar}
          {endpoint.scenario && (
            <div className="flex items-start gap-2 bg-teal-soft text-teal-strong rounded-lg px-3 py-2.5 text-[15px] mb-3.5 leading-relaxed">
              <AppIcon value="fa:info" /> <span>{endpoint.scenario}</span>
            </div>
          )}
          {paramsSentence(detailParams) && (
            <div className="text-[14.5px] text-ink-dim mb-3.5">{paramsSentence(detailParams)}</div>
          )}

          {canTryLive ? (
            <LiveTryPanel category={category} endpoint={endpoint} variant="business" values={queryValues} onValuesChange={setQueryValues} itemLabelMap={labelMaps.item} metaLabelMap={labelMaps.meta} />
          ) : live ? (
            aiActions(write ? "This API changes data in SAP, so it is not run from this page. Give the copied text to your developer or paste it into Claude." : "Give the copied text to your developer or paste it into Claude.")
          ) : (
            <div className="endpoint-fact is-warning"><AppIcon value="fa:warning" /> Not available in the Gateway yet — documentation only</div>
          )}

          <div className="flex items-center gap-2.5 mt-4 pt-3.5 border-t border-line flex-wrap">
            {allowed ? (
              <span className="text-[14px] text-post font-semibold">
                <AppIcon value="fa:tick"/> Access granted{myActiveApp ? ` · ${myActiveApp.name}` : ""}
              </span>
            ) : (
              <>
                <span className="text-[14px] text-ink-dim">
                  <AppIcon value="fa:lock"/> Required scope: <code className="font-mono text-[13.5px] bg-surface-2 rounded px-1.5 py-0.5">{endpoint.scope}</code>
                </span>
                <Btn size="sm" onClick={requestAccess} disabled={requestLoading}>
                  {requestLoading ? "Checking..." : "Request access"}
                </Btn>
              </>
            )}
          </div>
        </div>
      )}

      {open && audience === "developer" && (
        <div className="border-t border-line p-4 bg-paper">
          {moduleChooser}
          {requestUrlBar}
          {allowed ? (
            <>
              <p className="text-[15px] text-ink-dim leading-relaxed mb-3">{endpoint.description || endpoint.summary}</p>
              {facts}
              {aiActions("Paste into Claude to generate the code — includes rules, cURL, JSON and status codes.")}

              <div className="endpoint-code-grid">
                <div>
                  <div className="endpoint-code-head"><h4>Request · cURL</h4><CopyButton value={curl} label="Copy" /></div>
                  <pre className="endpoint-code">{curl}</pre>
                  {requestJson && (
                    <>
                      <div className="endpoint-code-head"><h4>Request body · JSON</h4><CopyButton value={requestJson} label="Copy" /></div>
                      <pre className="endpoint-code">{requestJson}</pre>
                    </>
                  )}
                </div>
                <div>
                  <div className="endpoint-code-head"><h4>Response · JSON</h4>{responseJson && <CopyButton value={responseJson} label="Copy" />}</div>
                  <pre className="endpoint-code">{responseJson && responseJson !== "{}" ? responseJson : write ? "No content (204) or SAP's JSON response" : "{}"}</pre>
                  <p className="endpoint-code-note">Errors: <code>{`{"message": "..."}`}</code></p>
                </div>
              </div>

              {canTryLive && (
                <LiveTryPanel category={category} endpoint={endpoint} variant="developer" values={queryValues} onValuesChange={setQueryValues} itemLabelMap={labelMaps.item} metaLabelMap={labelMaps.meta} />
              )}

              {(detailParams.length > 0 || endpoint.respFields.length > 0) && (
                <details className="endpoint-more">
                  <summary>More details</summary>
                  {detailParams.length > 0 && (
                    <>
                      <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2 mt-3">Parameters</h4>
                      <ParamTable headers={["Parameter", "Location", "Type", "Required", "Description"]} rows={detailParams} requiredCol={3} />
                    </>
                  )}
                  {endpoint.respFields.length > 0 && (
                    <>
                      <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2 mt-4">Response fields</h4>
                      <ParamTable headers={["Field", "Type", "Description"]} rows={endpoint.respFields.map((f) => [f[0], f[1], f[2]])} />
                    </>
                  )}
                </details>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2.5 bg-danger-soft text-danger rounded-lg px-3 py-2.5 text-[15px]">
              <AppIcon value="fa:lock"/> <span>Your role does not have access to <code className="font-mono">{endpoint.scope}</code> — Request additional access before calling this API.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
