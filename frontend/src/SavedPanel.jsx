import { useSaved } from "./saved";

export default function SavedPanel({ onRun, busy, disabled }) {
  const { items, remove } = useSaved();
  const blocked = busy || disabled;
  return (
    <>
      <div className="label">
        Saved questions <span className="pill"><b>{items.length}</b></span>
      </div>
      {items.length === 0 ? (
        <div className="muted small">Press Save on an answer to keep its question here.</div>
      ) : (
        items.map((s) => (
          <div key={s.id} className="srow">
            <button
              className="lnkbtn"
              disabled={blocked}
              title={disabled ? "Select a dataset first" : "Ask this on the selected dataset"}
              aria-label={"Run: " + s.question}
              onClick={() => onRun(s.question)}
            >
              {"\u25B6"}
            </button>
            <span className="clip sq" title={s.question}>{s.question}</span>
            <button className="lnkbtn muted" aria-label="Remove saved question" onClick={() => remove(s.id)}>{"\u00D7"}</button>
          </div>
        ))
      )}
    </>
  );
}