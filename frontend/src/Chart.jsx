import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import useThemeVars from "./useThemeVars";

const Plot = createPlotlyComponent(Plotly);

const WAY = {
  dark: ["#10b981", "#06b6d4", "#a3e635", "#f59e0b", "#8b5cf6", "#ec4899"],
  light: ["#059669", "#0891b2", "#65a30d", "#d97706", "#7c3aed", "#db2777"],
};

export default function Chart({ figure, height = 340 }) {
  const v = useThemeVars();
  const layout = useMemo(() => {
    const base = figure.layout || {};
    const axis = (a) => ({ ...(a || {}), gridcolor: v.border, zerolinecolor: v.border, linecolor: v.border });
    return {
      ...base,
      title: undefined,
      autosize: true,
      height,
      colorway: WAY[v.theme] || WAY.dark,
      margin: { l: 56, r: 20, t: 16, b: 48 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { ...(base.font || {}), color: v.text },
      hoverlabel: { bgcolor: v.surface, bordercolor: v.border, font: { color: v.text } },
      xaxis: axis(base.xaxis),
      yaxis: axis(base.yaxis),
      legend: { ...(base.legend || {}), font: { color: v.text } },
    };
  }, [figure, v, height]);
  return (
    <Plot
      data={figure.data}
      layout={layout}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}