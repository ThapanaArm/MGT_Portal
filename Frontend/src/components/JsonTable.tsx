"use client";

function inferType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function FieldTable({ title, rows }: { title?: string; rows: [string, unknown][] }) {
  if (!rows.length) return null;
  return (
    <div className="mb-2 last:mb-0">
      {title && <div className="text-[10.5px] uppercase tracking-wide text-ink-faint font-bold mb-1">{title}</div>}
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {["Field", "Type", "Value"].map((h) => (
              <th key={h} className="text-left text-ink-faint font-semibold text-[10.5px] uppercase tracking-wide pb-1.5 pr-2 border-b border-line">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1.5 pr-2 border-b border-line align-top">
                <code className="text-teal-strong text-[12px]">{k}</code>
              </td>
              <td className="py-1.5 pr-2 border-b border-line align-top text-ink-faint font-mono text-[11px]">{inferType(v)}</td>
              <td className="py-1.5 pr-2 border-b border-line align-top break-all">{formatVal(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders a JSON string (request body or response example) as detail tables instead of a raw code block. */
export default function JsonTable({ json }: { json: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return <pre className="bg-surface-3 border border-line rounded-lg p-3 font-mono text-[12px] leading-relaxed overflow-x-auto whitespace-pre">{json}</pre>;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return <div className="text-[13px] font-semibold">{formatVal(parsed)}</div>;
  }

  const obj = parsed as Record<string, unknown>;
  const list = Array.isArray(obj.data) ? (obj.data as Record<string, unknown>[]) : null;
  const meta = Object.entries(obj).filter(([k]) => k !== "data");

  if (!list) {
    return <FieldTable rows={Object.entries(obj)} />;
  }

  return (
    <div>
      {list.map((item, i) => (
        <FieldTable key={i} title={list.length > 1 ? `data[${i}]` : "data"} rows={Object.entries(item)} />
      ))}
      <FieldTable rows={meta} />
    </div>
  );
}
