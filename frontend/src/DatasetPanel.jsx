export default function DatasetPanel({ meta, profile, preview }) {
  const cols = profile?.columns || [];
  const keys = preview[0] ? Object.keys(preview[0]) : [];
  return (
    <details className="card pad" open>
      <summary>
        <b>{meta?.filename || "Dataset"}</b>
        <span className="muted">
          {" "}
          {profile ? `${profile.rows.toLocaleString()} rows, ${cols.length} columns` : "loading profile..."}
        </span>
      </summary>
      <div className="chips">
        {cols.map((c) => (
          <span key={c.name} className={"chip k-" + c.kind} title={c.missing ? `${c.missing} missing` : "no missing values"}>
            {c.name}
            <i>{c.kind}</i>
            {c.missing > 0 && <em>{c.missing} missing</em>}
          </span>
        ))}
      </div>
      {keys.length > 0 && (
        <div className="scroll">
          <table className="tbl">
            <thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>
              {preview.slice(0, 8).map((r, i) => (
                <tr key={i}>{keys.map((k) => <td key={k}>{String(r[k] ?? "")}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}