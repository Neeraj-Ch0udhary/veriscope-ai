import { useEffect, useState } from "react";

function read() {
  const s = getComputedStyle(document.documentElement);
  const g = (n) => s.getPropertyValue(n).trim();
  return { text: g("--text"), muted: g("--muted"), border: g("--border") };
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