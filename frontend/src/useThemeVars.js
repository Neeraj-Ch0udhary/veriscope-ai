import { useEffect, useState } from "react";

function read() {
  const root = document.documentElement;
  const s = getComputedStyle(root);
  const g = (n) => s.getPropertyValue(n).trim();
  return {
    theme: root.dataset.theme || "dark",
    text: g("--text"),
    muted: g("--muted"),
    border: g("--border"),
    surface: g("--surface"),
  };
}

export default function useThemeVars() {
  const [v, setV] = useState(read);
  useEffect(() => {
    const o = new MutationObserver(() => setV(read()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => o.disconnect();
  }, []);
  return v;
}