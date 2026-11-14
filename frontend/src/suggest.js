export function suggest(profile) {
  if (!profile) return [];
  const cols = profile.columns || [];
  const num = cols.filter((c) => c.kind === "numeric").map((c) => c.name);
  const dt = cols.find((c) => c.kind === "datetime")?.name;
  const cat = cols
    .filter((c) => c.kind !== "numeric" && c.kind !== "datetime" && !/(^|_)id$/i.test(c.name))
    .map((c) => c.name);
  const n =
    num.find((x) => /revenue|sales|amount/i.test(x)) ||
    num.find((x) => !/price|rate|pct|percent|id$/i.test(x)) ||
    num[0];
  const price = num.find((x) => /price/i.test(x));
  const out = [];
  if (n && cat[0]) out.push(`Which ${cat[0]} has the highest total ${n}?`);
  if (n && dt) out.push(`How did ${n} change by month?`);
  if (n && cat[0]) out.push(`What is each ${cat[0]}'s share of total ${n}?`);
  if (price) out.push(`Are there outliers in ${price}?`);
  else if (n) out.push(`Are there outliers in ${n}?`);
  if (n) out.push(`What happens to total ${n} if it increases by 10%?`);
  if (num.length > 1) out.push("Which numeric columns are most correlated?");
  return out.slice(0, 5);
}