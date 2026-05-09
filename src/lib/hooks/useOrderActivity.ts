"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivitySectionName,
  ActivitySectionPage,
  ActivitySectionsMap,
} from "@/lib/types/order-activity";
import { ACTIVITY_SECTION_NAMES } from "@/lib/types/order-activity";

interface AllSectionsResponse {
  success: true;
  data: { sections: ActivitySectionsMap };
}

interface OneSectionResponse {
  success: true;
  data: { section: ActivitySectionName; page: ActivitySectionPage };
}

interface UseOrderActivityOptions {
  orderId: string;
  /** When truthy (e.g. order.processing_status === "processing") the hook polls every 10s. */
  pollWhileActive?: boolean;
  /** When false, the hook is idle — used to skip fetching until the modal opens. */
  enabled?: boolean;
}

export interface UseOrderActivityResult {
  sections: ActivitySectionsMap | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: (section: ActivitySectionName) => Promise<void>;
  loadingSection: ActivitySectionName | null;
  /** ISO timestamp of the last successful fetch. */
  lastFetchedAt: string | null;
}

const POLL_INTERVAL_MS = 10_000;

function emptySections(): ActivitySectionsMap {
  const sections = {} as ActivitySectionsMap;
  for (const name of ACTIVITY_SECTION_NAMES) {
    sections[name] = { events: [], nextCursor: null, totalCount: 0 };
  }
  return sections;
}

export function useOrderActivity({
  orderId,
  pollWhileActive = false,
  enabled = true,
}: UseOrderActivityOptions): UseOrderActivityResult {
  const [sections, setSections] = useState<ActivitySectionsMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSection, setLoadingSection] =
    useState<ActivitySectionName | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // Ref pattern keeps the polling timer in sync without retriggering effects.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const pollRef = useRef(pollWhileActive);
  pollRef.current = pollWhileActive;

  const fetchAll = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!orderId) return;
      if (mode === "initial") setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const res = await fetch(
          `/api/b2b/orders/${encodeURIComponent(orderId)}/activity`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error || `Activity load failed (${res.status})`);
        }
        const body = (await res.json()) as AllSectionsResponse;
        setSections(body.data.sections);
        setError(null);
        setLastFetchedAt(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mode === "initial") setIsLoading(false);
        else setIsRefreshing(false);
      }
    },
    [orderId],
  );

  const loadMore = useCallback(
    async (section: ActivitySectionName) => {
      if (!orderId) return;
      const cursor = sections?.[section]?.nextCursor;
      if (!cursor) return;
      setLoadingSection(section);
      try {
        const url = new URL(
          `/api/b2b/orders/${encodeURIComponent(orderId)}/activity`,
          window.location.origin,
        );
        url.searchParams.set("section", section);
        url.searchParams.set("cursor", cursor);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error || `Load more failed (${res.status})`);
        }
        const body = (await res.json()) as OneSectionResponse;
        setSections((prev) => {
          if (!prev) return prev;
          const existing = prev[section];
          return {
            ...prev,
            [section]: {
              events: [...existing.events, ...body.data.page.events],
              nextCursor: body.data.page.nextCursor,
              totalCount: body.data.page.totalCount,
            },
          };
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingSection(null);
      }
    },
    [orderId, sections],
  );

  // Initial fetch when enabled becomes true.
  useEffect(() => {
    if (!enabled || !orderId) return;
    fetchAll("initial");
  }, [enabled, orderId, fetchAll]);

  // Poll while active.
  useEffect(() => {
    if (!enabled || !orderId || !pollWhileActive) return;
    const id = setInterval(() => {
      if (enabledRef.current && pollRef.current) {
        fetchAll("refresh");
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, orderId, pollWhileActive, fetchAll]);

  const refresh = useCallback(() => fetchAll("refresh"), [fetchAll]);

  return useMemo(
    () => ({
      sections,
      isLoading,
      isRefreshing,
      error,
      refresh,
      loadMore,
      loadingSection,
      lastFetchedAt,
    }),
    [
      sections,
      isLoading,
      isRefreshing,
      error,
      refresh,
      loadMore,
      loadingSection,
      lastFetchedAt,
    ],
  );
}

export { emptySections };
