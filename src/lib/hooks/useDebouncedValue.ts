import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of no
 * further changes. Use to drive a SERVER-SIDE query from a search box without
 * firing a request on every keystroke (the API does the filtering, not the
 * client — see the client-filtering standard).
 *
 *   const search = useState("");
 *   const appliedSearch = useDebouncedValue(search, 300);
 *   useEffect(() => { fetch(`/api/...?search=${appliedSearch}`) }, [appliedSearch]);
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
