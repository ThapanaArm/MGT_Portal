import { useState } from "react";
import { BarChart, LineChart, AreaChart, StackedBarChart, ComboChart, DonutChart, PieChart, HorizontalBarChart, type ChartSeries } from "@/shared/components/charts";
import { Select } from "@/shared/components/design-system";

export default function ChartsPage() {
  const [dataset, setDataset] = useState("standard");
  const labels = dataset === "single" ? ["Oct"] : ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const series: ChartSeries[] = dataset === "empty" ? [] : dataset === "single" ? [{ name: "Requests", values: [24] }] : dataset === "zero" ? [{ name: "Requests", values: [0,0,0,0,0,0] }] : dataset === "mixed" ? [{ name: "Net change", values: [12, -8, 0, null, -4, 16] }] : [{ name: "Submitted", values: [24, 32, 28, 45, 38, 52] }, { name: "Approved", values: [18, 25, 24, 35, 32, 44] }];
  const stackedSeries = dataset === "standard" ? [{name:"Approved",values:[18,25,24,35,32,44]},{name:"Awaiting decision",values:[6,7,4,10,6,8]}] : series;
  const data = labels.flatMap((label,index) => { const value = series[0]?.values[index]; return typeof value === "number" ? [{label,value}] : []; });
  return <><div className="example-chart-controls"><label>Example dataset<Select value={dataset} onChange={event => setDataset(event.target.value)}><option value="standard">Monthly comparison</option><option value="mixed">Negative and missing values</option><option value="single">Single data point</option><option value="zero">All zero values</option><option value="empty">Empty state</option></Select></label><span className="text-xs text-ink-dim">Illustrative sample data · not live Portal activity</span></div><div className="example-chart-grid">
    <BarChart title="Grouped bar chart" description="Compare multiple series across categories." labels={labels} series={series} unit="Requests" />
    <LineChart title="Line chart" description="Track trends over time. Missing values leave a gap." labels={labels} series={series} unit="Requests" />
    <AreaChart title="Area chart" description="Emphasize volume and changes over time." labels={labels} series={series} unit="Requests" />
    <StackedBarChart title="Stacked bar chart" description="See the combined total and each series contribution." labels={labels} series={stackedSeries} unit="Requests" />
    <HorizontalBarChart title="Horizontal bar chart" description="Compare category values, including negative changes." data={data} unit="Requests" />
    <ComboChart title="Bar and line chart" description="Compare the first series as bars and subsequent series as lines, using the same unit." labels={labels} series={series} unit="Requests" />
    <DonutChart title="Donut chart" description="Compare non-negative proportions with a total in the center." data={data} unit="Requests" />
    <PieChart title="Pie chart" description="Show each category's share of the non-negative total." data={data} unit="Requests" />
  </div></>;
}
