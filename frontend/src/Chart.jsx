import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import useThemeVars from "./useThemeVars";

const Plot = createPlotlyComponent(Plotly);

export default function Chart({ figure }) {
  const v = useThemeVars();
  const layout = useMemo(() => {
    const base = figure.layout || {};
    const axis = (a) => ({ ...(a || {}), gridcolor: v.border, zerolinecolor: v.border, linecolor: v.border });
    return {
      ...base,
      title: undefined,
      autosize: true,
      height: 340,
      margin: { l: 56, r: 20, t: 16, b: 48 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { ...(base.font || {}), color: v.text },
      xaxis: axis(base.xaxis),
      yaxis: axis(base.yaxis),
      legend: { ...(base.legend || {}), font: { color: v.text } },
    };
  }, [figure, v]);
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