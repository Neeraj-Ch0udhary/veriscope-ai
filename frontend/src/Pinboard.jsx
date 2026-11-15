import Chart from "./Chart";
import { usePins } from "./pins";
import { MAX_PINS, statusInfo } from "./pinLogic";

const day = (iso) => {
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export default function Pinboard({ onOpenRun }) {
  const { items, remove, clear } = usePins();
  return (
    <div className="board fade">
      <div className="row">
        <h3 style={{ margin: 0 }}>Pinboard</h3>
        <span className="muted small">{items.length} of {MAX_PINS} pins, saved in this browser</span>
        <div className="grow" />
        {items.length > 0 && (
          <button className="btn ghost sm" onClick={() => window.confirm("Remove all pinned charts?") && clear()}>Clear board</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card pad" style={{ textAlign: "center" }}>
          <h3 style={{ margin: "0 0 6px" }}>Nothing pinned yet</h3>
          <p className="muted" style={{ margin: 0 }}>Open the Charts tab on any answer and press Pin to collect charts here.</p>
        </div>
      ) : (
        <div className="board-grid">
          {items.map((p) => {
            const [label, tone] = statusInfo(p.status);
            return (
              <div key={p.id} className="card pad tile">
                <div className="tt">{p.title}</div>
                <div className="tq">{p.question}</div>
                <Chart figure={p.figure} height={220} />
                <div className="foot">
                  <span className={"badge " + tone}>{label}</span>
                  <span className="muted">{day(p.created_at)}</span>
                  <div className="grow" />
                  <button className="lnkbtn" onClick={() => onOpenRun(p.run_id)}>Open run</button>
                  <button className="btn ghost sm" onClick={() => remove(p.id)}>Unpin</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}