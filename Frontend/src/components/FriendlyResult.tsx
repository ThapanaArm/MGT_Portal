"use client";

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return v.toLocaleString("th-TH");
  if (typeof v === "boolean") return v ? "ใช่" : "ไม่ใช่";
  return String(v);
}

function FieldRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-baseline gap-2 py-1 text-[12.5px]">
      <span className="text-ink-dim flex-shrink-0 min-w-[120px]">{label}</span>
      <span className="font-semibold">{formatValue(value)}</span>
    </div>
  );
}

/**
 * Renders a JSON API response as plain-language rows instead of raw code,
 * using the endpoint's respFields descriptions as friendly labels.
 *
 * itemLabelMap covers fields inside a `data[]` array item (respFields entries like
 * "data[].total"); metaLabelMap covers top-level fields (respFields entries like "total").
 * These are kept separate because the same bare name can mean different things at
 * each level (e.g. an order's amount vs. the list's total item count).
 */
export default function FriendlyResult({
  json,
  itemLabelMap,
  metaLabelMap,
}: {
  json: string;
  itemLabelMap: Record<string, string>;
  metaLabelMap: Record<string, string>;
}) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return <div className="text-[12.5px] text-ink-dim">{json}</div>;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return <div className="text-[13px] font-semibold">{formatValue(parsed)}</div>;
  }

  const obj = parsed as Record<string, unknown>;
  const list = Array.isArray(obj.data) ? (obj.data as Record<string, unknown>[]) : null;
  const meta = Object.entries(obj).filter(([k]) => k !== "data");

  return (
    <div className="flex flex-col gap-2.5">
      {list ? (
        <>
          {list.map((item, i) => (
            <div key={i} className="border border-line rounded-lg px-3 py-2 bg-surface">
              {Object.entries(item).map(([k, v]) => (
                <FieldRow key={k} label={itemLabelMap[k] ?? k} value={v} />
              ))}
            </div>
          ))}
          {meta.length > 0 && (
            <div className="text-[11.5px] text-ink-faint flex gap-3 flex-wrap">
              {meta.map(([k, v]) => (
                <span key={k}>
                  {metaLabelMap[k] ?? k}: <b>{formatValue(v)}</b>
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="border border-line rounded-lg px-3 py-2 bg-surface">
          {Object.entries(obj).map(([k, v]) => (
            <FieldRow key={k} label={metaLabelMap[k] ?? k} value={v} />
          ))}
        </div>
      )}
    </div>
  );
}
