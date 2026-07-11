/**
 * Shared client helpers for the admin menu API.
 */

/** Build the `/api/b2b/menu` list URL for a (channel, location, language) version. */
export function buildMenuListUrl(params: {
  location: string;
  channel: string;
  language?: string;
  includeInactive?: boolean;
}): string {
  const search = new URLSearchParams({
    location: params.location,
    channel: params.channel,
  });
  if (params.includeInactive) search.set("include_inactive", "true");
  if (params.language) search.set("language", params.language);
  return `/api/b2b/menu?${search.toString()}`;
}
