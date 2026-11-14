import useTheme from "./useTheme";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="btn ghost sm" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}