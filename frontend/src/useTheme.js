import { useEffect, useState } from "react";

const KEY = "vs-theme";

export default function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || "dark"
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}