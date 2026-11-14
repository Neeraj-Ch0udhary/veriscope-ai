import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import useThemeVars from "./useThemeVars";

const Plot = createPlotlyComponent(Plotly);

const WAY = {
  dark: ["#10b981", "#06b6d4", "#a3e635", "#f59e0b", "#8b5cf6", "#ec4899"],
  light: ["#059669", "#0891b2", "#65a30d", "#d97706", "#7c3aed", "#db2777"],
};
const GOOD = { dark: "#34d399", light: "#059669" };
const BAD = { dark: "#f87171", light: "#dc2626" };

function hue(c) {
  const s = String(c).trim();
  let r, g, b;
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  } else {
    m = s.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
    if (!m) return null;
    r = +m[1]; g = +m[2]; b = +m[3];
  }
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 20) return -1;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

function semantic(c, theme, way) {
  const h = hue(c);
  if (h === null || h === -1) return c;
  if (h >= 80 && h < 170) return GOOD[theme] || GOOD.dark;
  if (h < 25 || h >= 335) return BAD[theme] || BAD.dark;
  if (h >= 170 && h < 270) return way[1];
  return c;
}

export default function Chart({ figure, height = 340 }) {
  const v = useThemeVars();
  const theme = v.theme === "light" ? "light" : "dark";
  const way = WAY[theme];

  const data = useMemo(
    () =>
      (figure.data || []).map((t, i) => {
        const tr = { ...t };
        const pick = way[i % way.length];
        if (t.marker) {
          tr.marker = { ...t.marker };
          const col = tr.marker.color;
          if (typeof col === "string") {
            tr.marker.color = pick;
          } else if (Array.isArray(col) && col.length && col.every((c) => typeof c === "string")) {
            tr.marker.color =
              new Set(col).size <= 3
                ? col.map((c) => semantic(c, theme, way))
                : col.map((_, k) => way[k % way.length]);
          }
          if (t.type === "bar") tr.marker.line = { width: 0 };
        }
        if (t.line && typeof t.line.color === "string") tr.line = { ...t.line, color: pick };
        if (t.type === "bar" && !t.hovertemplate) tr.hovertemplate = "%{x}: %{y:,.2f}<extra></extra>";
        return tr;
      }),
    [figure, way, theme]
  );

  const layout = useMemo(() => {
    const base = figure.layout || {};
    const axis = (a) => ({
      ...(a || {}),
      gridcolor: v.border,
      zerolinecolor: v.border,
      linecolor: v.border,
      showspikes: false,
    });
    return {
      ...base,
      title: undefined,
      autosize: true,
      height,
      colorway: way,
      margin: { l: 56, r: 20, t: 16, b: 48 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { ...(base.font || {}), color: v.text },
      hoverlabel: { bgcolor: v.surface, bordercolor: v.border, font: { color: v.text } },
      modebar: { bgcolor: "rgba(0,0,0,0)", color: v.muted, activecolor: way[0] },
      xaxis: axis(base.xaxis),
      yaxis: axis(base.yaxis),
      legend: { ...(base.legend || {}), font: { color: v.text } },
    };
  }, [figure, v, height, way]);

  return (
    <Plot
      data={data}
      layout={layout}
      config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}