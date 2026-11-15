import { useEffect, useMemo, useRef, useState } from "react";
import { findSource, flagged, splitText } from "./evidenceMatch";

export default function FindingText({ finding, evidence, onOpen }) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  const ids = finding.evidence_ids || [];

  const parts = useMemo(() => {
    const cited = evidence.filter((e) => ids.includes(e.id));
    const pool = cited.length ? cited : evidence;
    const bad = finding.unverified_numbers || [];
    return splitText(finding.text).map((p) => {
      if (!p.isNum) return p;
      if (flagged(p.text, bad)) return { ...p, state: "bad" };
      const src = findSource(p.text, pool);
      return src ? { ...p, state: "ok", src } : p;
    });
  }, [finding, evidence]);

  useEffect(() => {
    if (open === null) return;
    const out = (e) => ref.current && !ref.current.contains(e.target) && setOpen(null);
    const esc = (e) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", out);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span ref={ref}>
      {parts.map((p, i) => {
        if (!p.state) return <span key={i}>{p.text}</span>;
        const src = p.src;
        return (
          <span key={i} className="nbwrap" onMouseEnter={() => setOpen(i)} onMouseLeave={() => setOpen(null)}>
            <button type="button" className={"nb " + p.state} aria-expanded={open === i} onClick={() => setOpen(i)}>
              {p.text}
              <span className="mk">{p.state === "ok" ? "\u2713" : "!"}</span>
            </button>
            {open === i && (
              <span className={"pop " + p.state} role="tooltip">
                {p.state === "ok" ? (
                  <>
                    <span className="t ok">Verified: found in tool output</span>
                    <span className="r">Step {src.id} &middot; {src.tool}</span>
                    <span className="r">Field: <code>{src.path}</code></span>
                    {src.formula && <span className="r">Formula: <code>{src.formula}</code></span>}
                    {src.rows != null && <span className="r">Rows used: {String(src.rows)}</span>}
                    <button type="button" className="lnk" onClick={() => onOpen(src.id)}>Open in Evidence</button>
                  </>
                ) : (
                  <>
                    <span className="t bad">Not found in cited results</span>
                    <span className="r">
                      {p.text} does not appear in {ids.length ? ids.join(", ") : "any step"}, so the claim checker could not confirm it.
                    </span>
                    {ids[0] && <button type="button" className="lnk" onClick={() => onOpen(ids[0])}>Open in Evidence</button>}
                  </>
                )}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}