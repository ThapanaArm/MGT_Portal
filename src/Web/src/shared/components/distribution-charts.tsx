import { useId, useState } from "react";

export type DistributionChartProps = {
  title: string;
  description?: string;
  data: { label: string; value: number }[];
  unit?: string;
};
const number = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
export function DonutChart(props: DistributionChartProps) { return <DistributionChart {...props} kind="donut" />; }
export function PieChart(props: DistributionChartProps) { return <DistributionChart {...props} kind="pie" />; }
export function HorizontalBarChart(props: DistributionChartProps) { return <DistributionChart {...props} kind="horizontal" />; }

function DistributionChart({ title, description, data, unit, kind }: DistributionChartProps & { kind: "donut" | "pie" | "horizontal" }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const finite = data.filter(item => Number.isFinite(item.value));
  const items = kind === "horizontal" ? finite : finite.filter(item => item.value >= 0);
  const total = items.reduce((sum,item) => sum + item.value, 0);
  const unavailable = !items.length || (kind !== "horizontal" && total === 0);
  const min = Math.min(0,...items.map(item => item.value));
  const max = Math.max(0,...items.map(item => item.value));
  const span = max - min || 1;
  const x = (value: number) => 160 + (value-min)/span*370;
  const selected = active === null ? undefined : items[active];
  const point = (angle: number) => [160 + 112 * Math.cos(angle), 145 + 112 * Math.sin(angle)];
  const previous = items.map((_,index) => items.slice(0,index).reduce((sum,item) => sum + item.value,0));
  return <figure className="mgt-chart" aria-labelledby={`${id}-title`}><figcaption><div><h3 id={`${id}-title`}>{title}</h3>{description && <p>{description}</p>}</div>{unit && <span className="mgt-chart-unit">{unit}</span>}</figcaption>
    {finite.length !== data.length && <p className="mgt-chart-validation">Non-finite values are excluded.</p>}{kind !== "horizontal" && finite.some(item => item.value < 0) && <p className="mgt-chart-validation">Negative values cannot be shown as proportions and are excluded.</p>}
    {unavailable ? <div className="mgt-chart-empty">{items.length ? "No positive values to display" : "No chart data available"}</div> : <>
      <div className={kind === "horizontal" ? "mgt-chart-scroll" : "mgt-chart-distribution"}>
        <svg viewBox={kind === "horizontal" ? `0 0 620 ${Math.max(180,items.length*52+44)}` : "0 0 320 290"} role="group" aria-label={`${title}. ${kind} chart. Focus a data point for its value.`} onMouseLeave={() => setActive(null)}>
          {kind === "horizontal" && <line className="mgt-chart-baseline" x1={x(0)} x2={x(0)} y1={14} y2={items.length*52+14} />}
          {items.map((item,index) => {
            const label = `${item.label}: ${number(item.value)}${unit ? ` ${unit}` : ""}${kind === "horizontal" ? "" : ` (${number(item.value/total*100)}%)`}`;
            const handlers = { tabIndex:0, role:"img", "aria-label":label, onFocus:()=>setActive(index), onBlur:()=>setActive(null), onMouseEnter:()=>setActive(index), onClick:()=>setActive(index) };
            const start = -Math.PI/2 + previous[index]/total*Math.PI*2;
            const end = start + item.value/total*Math.PI*2;
            const a = point(start), b = point(end);
            return <g key={index} className={`chart-series-${index%8}`}>
              {kind === "horizontal" ? <><text className="mgt-chart-axis" x={148} y={index*52+35} textAnchor="end"><title>{item.label}</title>{item.label.length>19 ? `${item.label.slice(0,18)}…` : item.label}</text><rect {...handlers} className="mgt-chart-bar" x={Math.min(x(0),x(item.value))} y={index*52+16} width={Math.max(2,Math.abs(x(item.value)-x(0)))} height={30} rx={5}><title>{label}</title></rect><text className="mgt-chart-axis" x={540} y={index*52+35}>{number(item.value)}</text></> : item.value === total ? <circle {...handlers} className="mgt-chart-slice" cx={160} cy={145} r={112}><title>{label}</title></circle> : item.value > 0 ? <path {...handlers} className="mgt-chart-slice" d={`M160,145 L${a[0]},${a[1]} A112,112 0 ${end-start>Math.PI ? 1 : 0},1 ${b[0]},${b[1]} Z`}><title>{label}</title></path> : null}
            </g>;
          })}
          {kind === "donut" && <g pointerEvents="none"><circle cx={160} cy={145} r={76} className="mgt-chart-donut-hole" /><text className="mgt-chart-axis" x={160} y={132} textAnchor="middle">Total</text><text className="mgt-chart-total" x={160} y={162} textAnchor="middle">{number(total)}</text></g>}
        </svg>
        {kind !== "horizontal" && <ul className="mgt-chart-proportions">{items.map((item,index) => <li key={index}><span className={`mgt-chart-swatch chart-series-${index%8}`} /><span>{item.label}</span><strong>{number(item.value/total*100)}%</strong></li>)}</ul>}
      </div>
      <div className="mgt-chart-readout" aria-live="polite">{selected ? <><strong>{selected.label}</strong><b>{number(selected.value)}{unit ? ` ${unit}` : ""}</b></> : <span>Hover, tap, or focus a data point to see its value.</span>}</div>
    </>}
    {!!items.length && <details className="mgt-chart-data"><summary>View chart data</summary><div><table><caption className="sr-only">{title}{unit ? ` (${unit})` : ""}</caption><thead><tr><th scope="col">Category</th><th scope="col">Value{unit ? ` (${unit})` : ""}</th></tr></thead><tbody>{items.map((item,index) => <tr key={index}><th scope="row">{item.label}</th><td>{number(item.value)}</td></tr>)}</tbody></table></div></details>}
  </figure>;
}
