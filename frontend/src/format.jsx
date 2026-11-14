import { Fragment } from "react";

const NUM = /(-?\d(?:[\d,]*\d)?(?:\.\d+)?%?)/g;

export function Highlight({ text }) {
  const parts = String(text ?? "").split(NUM);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <b key={i} className="num">{p}</b> : <Fragment key={i}>{p}</Fragment>
      )}
    </>
  );
}