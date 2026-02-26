/**
 * Sales Channel Constants
 *
 * Channels control visibility/publication scope for entities across storefronts and markets.
 * Channels are dynamic per tenant (stored in `saleschannels` collection).
 * This file provides only the default value and validation helpers.
 */

/** Default channel code — assigned when no channel is specified */
export const DEFAULT_CHANNEL = "default";

/**
 * Validate a channel code (kebab-case: lowercase alphanumeric + hyphens).
 * Same rules as customer tag codes.
 */
export function isValidChannelCode(code: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(code);
}
