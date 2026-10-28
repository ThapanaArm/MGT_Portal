import { useId, useState } from "react";
import "./charts.css";

export type ChartSeries = { name: string; values: (number | null)[] };
export type ChartProps = {
  title: string;
  description?: string;
  labels: string[];
  series: ChartSeries[];
  unit?: string;
  formatValue?: (value: number) => string;
};
export { DonutChart, PieChart, HorizontalBarChart } from "./distribution-charts";
export type { DistributionChartProps } from "./distribution-charts";

const compact = (value: number) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/** Categorical comparison chart. Null and non-finite values are treated as missing data. */
export function BarChart(props: ChartProps) { return <Chart {...props} kind="bar" />; }
/** Categorical trend chart. Missing values break the line rather than implying zero. */
export function LineChart(props: ChartProps) { return <Chart {...props} kind="line" />; }

export function AreaChart(props: ChartProps) { return <Chart {...props} kind="area" />; }
export function StackedBarChart(props: ChartProps) { return <Chart {...props} kind="stacked" />; }
/** First series uses bars; subsequent series use lines on the same unit and axis. */
export function ComboChart(props: ChartProps) { return <Chart {...props} kind="combo" />; }

function Chart({ title, description, labels, series, unit, formatValue = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value), kind }: ChartProps & { kind: "bar" | "line" | "area" | "stacked" | "combo" }) {
  const id = useId();
  const [active, setActive] = useState<{ category: string; name: string; value: number } | null>(null);
  const valid = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
  const values = series.flatMap(item => labels.map((_, index) => item.values[index]).filter(valid));
  const stacks = labels.map((_,index) => series.reduce((sum,item) => { const value = item.values[index]; if (valid(value)) { sum[value >= 0 ? 0 : 1] += value; } return sum; }, [0,0]));
  const domainValues = kind === "stacked" ? stacks.flat() : values;
  const low = Math.min(0, ...domainValues), high = Math.max(0, ...domainValues);
  const range = high - low || 1;
  const step = 10 ** Math.floor(Math.log10(range / 4));
  const tickStep = [1, 2, 5, 10].map(multiplier => multiplier * step).find(value => value >= range / 4) ?? step * 10;
  const min = Math.floor(low / tickStep) * tickStep;
  const max = high === low ? min + tickStep * 4 : Math.ceil(high / tickStep) * tickStep;
  const ticks = Array.from({ length: Math.round((max - min) / tickStep) + 1 }, (_, index) => min + index * tickStep);
  const width = 680, height = 290, left = 66, right = 22, top = 20, bottom = 48;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const y = (value: number) => top + (max - value) / (max - min) * plotHeight;
  const slot = plotWidth / Math.max(1, labels.length);
  const x = (index: number) => left + slot * (index + .5);
  const barWidth = Math.min(36, slot * .7 / Math.max(1, kind === "bar" ? series.length : 1));
  const selectedValue = active ? series.find(item => item.name === active.name)?.values[labels.indexOf(active.category)] : null;
  const reveal = (category: string, name: string, value: number) => setActive({ category, name, value });
  return <figure className="mgt-chart" aria-labelledby={`${id}-title`}>
    <figcaption><div><h3 id={`${id}-title`}>{title}</h3>{description && <p>{description}</p>}</div>{unit && <span className="mgt-chart-unit">{unit}</span>}</figcaption>
    {!values.length ? <div className="mgt-chart-empty">No chart data available</div> : <>
      <ul className="mgt-chart-legend" aria-label="Chart series">{series.map((item,index) => <li key={`${item.name}-${index}`}><span className={`mgt-chart-swatch chart-series-${index % 8}`} />{item.name}</li>)}</ul>
      <div className="mgt-chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${title}. ${kind} chart. Focus a data point for its value.`} onMouseLeave={() => setActive(null)}>
        {ticks.map(tick => <g key={tick}><line className={tick === 0 ? "mgt-chart-baseline" : "mgt-chart-grid"} x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} /><text className="mgt-chart-axis" x={left-12} y={y(tick)+4} textAnchor="end">{compact(tick)}</text></g>)}
        {labels.map((label,index) => <text key={index} className="mgt-chart-axis" x={x(index)} y={height-20} textAnchor="middle"><title>{label}</title>{label.length > 12 ? `${label.slice(0,11)}…` : label}</text>)}
        {series.map((item,seriesIndex) => {
          const points = labels.map((label,index) => ({ label, index, value: item.values[index] }));
          const path = points.map((point,index) => valid(point.value) ? `${index === 0 || !valid(points[index-1].value) ? "M" : "L"}${x(point.index)},${y(point.value)}` : "").join(" ");
          const segments: string[] = [];
          let segment: typeof points = [];
          for (const point of [...points, {label:"",index:0,value:null}]) {
            if (valid(point.value)) segment.push(point);
            else if (segment.length) { segments.push(`M${x(segment[0].index)},${y(0)} ${segment.map(p => `L${x(p.index)},${y(p.value as number)}`).join(" ")} L${x(segment[segment.length-1].index)},${y(0)} Z`); segment = []; }
          }
          const isBar = kind === "bar" || kind === "stacked" || (kind === "combo" && seriesIndex === 0);
          return <g key={`${item.name}-${seriesIndex}`} className={`chart-series-${seriesIndex % 8}`}>
            {kind === "area" && <path className="mgt-chart-area" d={segments.join(" ")} />}
            {!isBar && <path className="mgt-chart-line" d={path} strokeDasharray={seriesIndex % 2 ? "7 4" : undefined} />}
            {points.filter(point => valid(point.value)).map(point => { const value = point.value as number; const label = `${point.label}, ${item.name}: ${formatValue(value)}${unit ? ` ${unit}` : ""}`; const handlers = { tabIndex: 0, role: "img", "aria-label": label, onFocus: () => reveal(point.label,item.name,value), onBlur: () => setActive(null), onMouseEnter: () => reveal(point.label,item.name,value), onClick: () => reveal(point.label,item.name,value) }; const previous = kind === "stacked" ? series.slice(0,seriesIndex).reduce((sum,prior) => { const v = prior.values[point.index]; return valid(v) && (v >= 0) === (value >= 0) ? sum + v : sum; },0) : 0; return isBar ? <rect key={point.index} {...handlers} className="mgt-chart-bar" x={kind === "bar" ? x(point.index) - barWidth * series.length / 2 + seriesIndex * barWidth + 2 : x(point.index) - barWidth / 2 + 2} y={Math.min(y(previous + value),y(previous))} width={Math.max(1,barWidth-4)} height={Math.max(2,Math.abs(y(previous + value)-y(previous)))} rx={4}><title>{label}</title></rect> : <circle key={point.index} {...handlers} className="mgt-chart-point" cx={x(point.index)} cy={y(value)} r={5}><title>{label}</title></circle>; })}
          </g>;
        })}
      </svg></div>
      <div className="mgt-chart-readout" aria-live="polite">{active && valid(selectedValue) ? <><strong>{active.category}</strong><span>{active.name}</span><b>{formatValue(selectedValue)}{unit ? ` ${unit}` : ""}</b></> : <span>Hover, tap, or focus a data point to see its value.</span>}</div>
    </>}
    {!!values.length && <details className="mgt-chart-data"><summary>View chart data</summary><div><table><caption className="sr-only">{title}{unit ? ` (${unit})` : ""}</caption><thead><tr><th scope="col">Category</th>{series.map((item,index) => <th scope="col" key={index}>{item.name}</th>)}</tr></thead><tbody>{labels.map((label,index) => <tr key={index}><th scope="row">{label}</th>{series.map((item,seriesIndex) => <td key={seriesIndex}>{valid(item.values[index]) ? formatValue(item.values[index] as number) : "No data"}</td>)}</tr>)}</tbody></table></div></details>}
  </figure>;
}

