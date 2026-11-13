import { useMemo } from "react";

import type { ComputeResponse } from "../api";
import { Metric, Plot, ResultsTable, VerdictCard } from "../components/common";
import { rm, rmSigned } from "../format";

export default function PlanPage({ data }: { data: ComputeResponse }) {
  const { result: r, cost_path: path } = data;
  const cur = r.inputs.currency;

  const costChart = useMemo(() => ({
    data: [
      {
        x: path.map((p) => p.month), y: path.map((p) => p.cost_foreign),
        name: `Foreign cost (${cur})`, mode: "lines+markers", line: { color: "#0F766E" },
        hovertemplate: `Month %{x}<br>${cur} %{y:,.2f}<extra></extra>`,
      },
      {
        x: path.map((p) => p.month), y: path.map((p) => p.myr_needed), yaxis: "y2",
        name: "MYR needed (at PPP rate)", mode: "lines+markers", line: { color: "#F59E0B" },
        hovertemplate: "Month %{x}<br>RM%{y:,.2f}<extra></extra>",
      },
    ],
    layout: {
      title: { text: "Cost over time until departure", font: { size: 14 } },
      xaxis: { title: { text: "Months from today" } },
      yaxis: { title: { text: cur }, tickformat: ",.0f" },
      yaxis2: { title: { text: "MYR" }, tickformat: ",.0f", overlaying: "y", side: "right" },
      legend: { orientation: "h", y: -0.25 },
      hovermode: "x unified",
    },
  }), [path, cur]);

  const barChart = useMemo(() => {
    const values = [r.pv_convert_now, r.pv_convert_later, r.pv_forward];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.6, hi * 0.01);
    return {
      data: [{
        type: "bar", x: ["Convert now", "Convert later", "Forward contract"], y: values,
        text: values.map(rm), textposition: "outside",
        marker: { color: ["#0F766E", "#F59E0B", "#94A3B8"] },
        hovertemplate: "%{x}<br>RM%{y:,.2f}<extra></extra>",
      }],
      layout: {
        title: { text: "Present value in today's MYR (lower is cheaper)", font: { size: 14 } },
        yaxis: { range: [lo - pad, hi + pad], tickformat: ",.0f", title: { text: "MYR" } },
      },
    };
  }, [r]);

  return (
    <section>
      <div className="metrics">
        <Metric label="PV of converting later" value={rm(r.pv_convert_later)} />
        <Metric label="PV of converting now" value={rm(r.pv_convert_now)} />
        <Metric label="Saving from converting now" value={rmSigned(r.saving_from_converting_now)} />
      </div>
      <VerdictCard r={r} />

      <div className="grid-2">
        <div className="card"><Plot data={costChart.data} layout={costChart.layout} /></div>
        <div className="card">
          <Plot data={barChart.data} layout={barChart.layout} />
          <p className="caption">The bar axis is zoomed in so small differences are visible.</p>
        </div>
      </div>

      <h3>Results from the finance engine</h3>
      <ResultsTable r={r} />
    </section>
  );
}
