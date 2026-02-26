/**
 * Channel Constants
 *
 * Sales channel codes and validation for multi-channel commerce.
 */

/** Default channel code when none is specified */
export const DEFAULT_CHANNEL = "DEFAULT";

/**
 * Validate channel code format.
 * Alphanumeric with optional hyphens (e.g. B2C, B2B, slovakia).
 */
export function isValidChannelCode(code: string): boolean {
  return /^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/.test(code);
}
