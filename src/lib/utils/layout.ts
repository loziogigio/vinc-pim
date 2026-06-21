/**
 * Shared layout sizing for the Commerce Suite shell. The fixed (non-full)
 * width matches the legacy dashboard so the two chromes line up.
 */
export const CONTENT_MAX_WIDTH = "max-w-[1600px]";

/** Width classes for a page/app-bar container, driven by the full-width toggle. */
export function contentWidthClass(fullWidth: boolean): string {
  return fullWidth ? "w-full" : `mx-auto ${CONTENT_MAX_WIDTH}`;
}
