"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "vinc-sidebar-collapsed";
const EVENT = "vinc-sidebar-collapsed-change";

/**
 * Shared collapsed/expanded state for app sidebars, persisted in localStorage
 * and synced across mounted sidebars (and tabs) via a custom event + storage
 * event. Defaults to expanded; reads the stored value after mount to stay
 * SSR-safe.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setCollapsedState(localStorage.getItem(STORAGE_KEY) === "1");
      } catch {
        /* ignore */
      }
    };
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return {
    collapsed,
    setCollapsed,
    toggle: () => setCollapsed(!collapsed),
  };
}
