import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { useEnv, ENV_HOST } from "@/features/catalog/env-context";
import { useAudience } from "@/features/catalog/audience-context";
import { useToast } from "@/shared/lib/toast";
import { api } from "@/shared/lib/api";
import { buildRespTabs, buildReqHeaders } from "@/features/catalog/errorExamples";
import { MethodBadge, ScopeTag, Btn } from "@/shared/components/ui";
import FriendlyResult from "@/features/catalog/components/FriendlyResult";
import JsonTable from "@/features/catalog/components/JsonTable";
import type { AppSummaryDto, CategoryDto, EndpointDto } from "@/shared/lib/types";

function ParamTable({ rows, headers, requiredCol }: { rows: string[][]; headers: string[]; requiredCol?: number }) {
  if (!rows.length) return <div className="text-[15px] text-ink-faint">ไม่มีพารามิเตอร์</div>;
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
  if (required.length) parts.push("ต้องระบุ: " + required.join(", "));
  if (optional.length) parts.push("ระบุเพิ่มได้ (ไม่บังคับ): " + optional.join(", "));
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
}: {
  category: CategoryDto;
  endpoint: EndpointDto;
  /** Shown as a small tag above the headline — used on the cross-category search page where results mix categories. */
  categoryLabel?: string;
}) {
  const { user, hasScope } = useAuth();
  const { env } = useEnv();
  const { audience } = useAudience();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(200);
  const [status, setStatus] = useState<{ text: string; pending: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [myApps, setMyApps] = useState<AppSummaryDto[] | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  const allowed = hasScope(endpoint.scope);

  useEffect(() => {
    if (open && audience === "business" && myApps === null) {
      api
        .get<AppSummaryDto[]>("/api/applications")
        .then((apps) => setMyApps(apps.filter((a) => a.ownerEmail === user?.email)))
        .catch(() => setMyApps([]));
    }
  }, [open, audience, myApps, user?.email]);

  const myActiveApp = myApps?.find((a) => a.status === "active" && a.products.includes(category.key));
  const tabs = buildRespTabs(endpoint);
  const activeTab = tabs.find((t) => t.code === tab) ?? tabs[0];
  const host = ENV_HOST[env];
  const curl =
    `curl -X ${endpoint.method} https://${host}${category.basePath}${endpoint.path} \\\n  -H "Authorization: Bearer <token>"` +
    (endpoint.reqBody ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${endpoint.reqBody.replace(/\n\s*/g, " ")}'` : "");

  const tryIt = () => {
    setLoading(true);
    setStatus({ text: "กำลังเรียก...", pending: true });
    setTab(200);
    setTimeout(() => {
      setStatus({ text: `200 OK · ${env === "sandbox" ? "Sandbox" : "Production"} · 118ms`, pending: false });
      setLoading(false);
    }, 550);
  };

  const requestAccess = async () => {
    setRequestLoading(true);
    try {
      const apps: AppSummaryDto[] =
        myApps ?? (await api.get<AppSummaryDto[]>("/api/applications").then((all) => all.filter((a) => a.ownerEmail === user?.email)));
      if (myApps === null) setMyApps(apps);
      navigate(apps.length === 0 ? "/my-apps?new=1" : "/my-apps");
    } catch {
      toast("ตรวจสอบ Application ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setRequestLoading(false);
    }
  };

  const headerRow =
    audience === "business" ? (
      <div className="flex items-center gap-3 px-3.5 py-3.5 cursor-pointer select-none hover:bg-surface-2" onClick={() => setOpen((o) => !o)}>
        <span className="text-[26px] flex-shrink-0">{endpoint.icon}</span>
        <div className="flex-1 min-w-0">
          {categoryLabel && (
            <span className="inline-block text-[12.5px] font-semibold text-teal-strong bg-teal-soft rounded-full px-2 py-0.5 mb-1">
              {categoryLabel}
            </span>
          )}
          <div className="text-[16.5px] font-semibold leading-snug">{endpoint.summary}</div>
          <div className="font-mono text-[12.5px] text-ink-faint mt-0.5">
            {endpoint.method} {endpoint.path}
          </div>
        </div>
        <span className={`text-ink-faint flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </div>
    ) : (
      <div className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none hover:bg-surface-2" onClick={() => setOpen((o) => !o)}>
        <MethodBadge method={endpoint.method} />
        <span className="font-mono text-[15.5px] flex-shrink-0">{endpoint.path}</span>
        <span className="text-ink-dim text-[15px] overflow-hidden text-ellipsis whitespace-nowrap flex-1">{endpoint.summary}</span>
        {allowed ? <ScopeTag>{endpoint.scope}</ScopeTag> : <span className="text-[13.5px] text-danger flex items-center gap-1 flex-shrink-0">🔒 locked</span>}
        <span className={`text-ink-faint flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </div>
    );

  return (
    <div className={`border border-line rounded-[10px] bg-surface mb-2.5 overflow-hidden ${audience === "developer" && !allowed ? "opacity-70" : ""}`}>
      {headerRow}

      {open && audience === "business" && (
        <div className="border-t border-line p-4 bg-paper">
          {endpoint.scenario && (
            <div className="flex items-start gap-2 bg-teal-soft text-teal-strong rounded-lg px-3 py-2.5 text-[15px] mb-3.5 leading-relaxed">
              💡 <span>{endpoint.scenario}</span>
            </div>
          )}
          {paramsSentence(endpoint.params) && (
            <div className="text-[14.5px] text-ink-dim mb-3.5">{paramsSentence(endpoint.params)}</div>
          )}

          <div className="flex items-center gap-2.5 mb-1">
            <Btn variant="primary" onClick={tryIt} disabled={loading}>
              ▶ ลองเลย
            </Btn>
            <span className="text-[14px] text-ink-faint">ปลอดภัย ทดลองได้ ไม่กระทบข้อมูลจริง (โหมดทดลอง)</span>
          </div>

          {status && (
            <div className="mt-4">
              <div className={`inline-flex items-center gap-1.5 text-[13.5px] font-mono rounded-full px-2.5 py-1 mb-2.5 ${status.pending ? "bg-surface-2 text-ink-faint" : "bg-post-soft text-post"}`}>
                {status.text}
              </div>
              {!status.pending && (() => {
                const { item, meta } = buildLabelMaps(endpoint.respFields);
                return <FriendlyResult json={endpoint.respExample} itemLabelMap={item} metaLabelMap={meta} />;
              })()}
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-4 pt-3.5 border-t border-line flex-wrap">
            {allowed ? (
              <>
                <span className="text-[14px] text-post font-semibold">
                  ✓ มีสิทธิ์แล้ว{myActiveApp ? ` · ${myActiveApp.name}` : ""}
                </span>
                <Btn size="sm" variant="primary" onClick={tryIt} disabled={loading}>
                  ทดลอง API
                </Btn>
              </>
            ) : (
              <>
                <span className="text-[14px] text-ink-dim">
                  🔐 ต้องการสิทธิ์: <code className="font-mono text-[13.5px] bg-surface-2 rounded px-1.5 py-0.5">{endpoint.scope}</code>
                </span>
                <Btn size="sm" onClick={requestAccess} disabled={requestLoading}>
                  {requestLoading ? "กำลังตรวจสอบ..." : "ขอสิทธิ์ใช้งาน"}
                </Btn>
              </>
            )}
          </div>
        </div>
      )}

      {open && audience === "developer" && (
        <div className="border-t border-line p-4 bg-paper">
          {allowed ? (
            <>
              <p className="text-[15px] text-ink-dim leading-relaxed mb-3.5">{endpoint.description || endpoint.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2">Request Headers</h4>
                  <ParamTable headers={["Header", "ค่า", "จำเป็น", "คำอธิบาย"]} rows={buildReqHeaders(endpoint.method)} requiredCol={2} />

                  <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2 mt-3.5">Parameters</h4>
                  <ParamTable headers={["Parameter", "ตำแหน่ง", "ชนิด", "จำเป็น", "คำอธิบาย"]} rows={endpoint.params} requiredCol={3} />

                  {endpoint.reqBody && (
                    <>
                      <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2 mt-3.5">Request Body</h4>
                      <JsonTable json={endpoint.reqBody} />
                    </>
                  )}

                  <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2 mt-3.5">cURL</h4>
                  <pre className="bg-surface-3 border border-line rounded-lg p-3 font-mono text-[14.5px] leading-relaxed overflow-x-auto whitespace-pre">{curl}</pre>
                </div>

                <div>
                  <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2">ตัวอย่าง Response</h4>
                  <div className="flex gap-1 flex-wrap mb-2.5">
                    {tabs.map((t) => (
                      <button
                        key={t.code}
                        onClick={() => setTab(t.code)}
                        className={`border font-mono text-[13.5px] px-2.5 py-1 rounded-md ${
                          tab === t.code ? "bg-teal-soft border-teal text-teal-strong font-bold" : "border-line-strong bg-surface text-ink-dim hover:bg-surface-2"
                        }`}
                      >
                        {t.code} {t.label}
                      </button>
                    ))}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 text-[13.5px] font-mono rounded-full px-2.5 py-1 mb-2 ${status?.pending === false ? "bg-post-soft text-post" : "bg-surface-2 text-ink-faint"}`}>
                    {status?.text ?? "ยังไม่ได้เรียกใช้งาน"}
                  </div>
                  <div className="border border-line rounded-lg p-3 bg-surface">
                    <JsonTable json={activeTab.body} />
                  </div>
                  <div className="flex items-center gap-2.5 mt-3">
                    <button
                      onClick={tryIt}
                      disabled={loading}
                      className="bg-brand text-white rounded-lg px-3 py-1.5 text-[15px] font-semibold disabled:opacity-60"
                    >
                      ▶ Try it out
                    </button>
                    <span className="text-[14px] text-ink-faint">จำลองการเรียก API ด้วยข้อมูลตัวอย่าง</span>
                  </div>

                  {endpoint.respFields.length > 0 && (
                    <>
                      <h4 className="text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-2 mt-4">Response Fields</h4>
                      <ParamTable headers={["Field", "ชนิด", "คำอธิบาย"]} rows={endpoint.respFields.map((f) => [f[0], f[1], f[2]])} />
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 bg-danger-soft text-danger rounded-lg px-3 py-2.5 text-[15px]">
              🔒 <span>บทบาทของคุณไม่มีสิทธิ์ <code className="font-mono">{endpoint.scope}</code> — ต้องขอสิทธิ์เพิ่มเติมก่อนเรียกใช้งาน</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
