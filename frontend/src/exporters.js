export function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function toMarkdown(run) {
  const r = run.report || {};
  const L = [];
  L.push(`# ${r.headline || "VeriScope AI report"}`, "", `**Question:** ${run.question}`,
         `**Verification:** ${(r.verification || {}).status || "unknown"}`, "", "## Findings");
  (r.findings || []).forEach((f, i) =>
    L.push(`${i + 1}. ${f.verified ? "[verified]" : "[unverified]"} ${f.text} _(evidence: ${(f.evidence_ids || []).join(", ")})_`));
  if ((r.recommendations || []).length) L.push("", "## Recommendations", ...r.recommendations.map((x) => `- ${x}`));
  if ((r.limitations || []).length) L.push("", "## Limitations", ...r.limitations.map((x) => `- ${x}`));
  L.push("", "## Evidence");
  (run.evidence || []).forEach((e) => {
    const ev = e.evidence || {};
    L.push(`- **${e.id}** \`${e.tool}\` ${JSON.stringify(e.params)}`);
    if (e.summary) L.push(`  - ${e.summary}`);
    if (ev.formula) L.push(`  - formula: \`${ev.formula}\``);
    if (ev.assumption) L.push(`  - assumption: ${ev.assumption}`);
  });
  return L.join("\n") + "\n";
}