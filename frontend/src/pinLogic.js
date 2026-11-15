export const MAX_PINS = 30;

export function removePin(list, id) {
  return list.filter((p) => p.id !== id);
}

export function togglePin(list, pin, max = MAX_PINS) {
  if (list.some((p) => p.id === pin.id)) return { list: removePin(list, pin.id), error: null };
  if (list.length >= max) return { list, error: `The board is full (${max} pins). Unpin something first.` };
  return { list: [pin, ...list], error: null };
}

export function statusInfo(status) {
  return (
    {
      verified: ["Verified", "good"],
      partially_verified: ["Partially verified", "warn"],
      no_data: ["No data", "bad"],
      tool_summaries_only: ["Tool summaries only", "bad"],
    }[status] || ["Unchecked", "warn"]
  );
}