import { useEffect, useState } from "react";
import { isSaved, removeSaved, toggleSaved } from "./savedLogic";

const KEY = "vs-saved";
const listeners = new Set();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

let cache = read();

function write(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return { error: "Could not save. Browser storage is full or blocked." };
  }
  cache = next;
  listeners.forEach((f) => f(next));
  return { ok: true };
}

export function useSaved() {
  const [items, setItems] = useState(cache);
  useEffect(() => {
    listeners.add(setItems);
    const onStorage = (e) => {
      if (e.key === KEY) {
        cache = read();
        setItems(cache);
      }
    };
    window.addEventListener("storage", onStorage);
    setItems(cache);
    return () => {
      listeners.delete(setItems);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const has = (question) => isSaved(items, question);
  const toggle = (item) => {
    const r = toggleSaved(cache, { ...item, created_at: new Date().toISOString() });
    return r.error ? { error: r.error } : write(r.list);
  };
  const remove = (id) => write(removeSaved(cache, id));
  return { items, has, toggle, remove };
}