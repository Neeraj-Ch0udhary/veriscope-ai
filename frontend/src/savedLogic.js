export const MAX_SAVED = 30;

export const norm = (q) => String(q || "").trim().replace(/\s+/g, " ").toLowerCase();

export function isSaved(list, question) {
  const id = norm(question);
  return !!id && list.some((s) => s.id === id);
}

export function removeSaved(list, id) {
  return list.filter((s) => s.id !== id);
}

export function toggleSaved(list, item, max = MAX_SAVED) {
  const id = norm(item.question);
  if (!id) return { list, error: "There is no question to save." };
  if (list.some((s) => s.id === id)) return { list: removeSaved(list, id), error: null };
  if (list.length >= max) return { list, error: `You can save up to ${max} questions. Remove one first.` };
  return { list: [{ ...item, question: String(item.question).trim(), id }, ...list], error: null };
}