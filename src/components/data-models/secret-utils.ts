/**
 * Helpers for write-preserving secret field handling in dynamic data-model records.
 *
 * When an admin opens an edit form for a record that has secret fields (e.g. SMTP
 * passwords, API keys), the password input is always rendered empty. On submit,
 * any secret field left blank keeps its stored value rather than overwriting it
 * with an empty string.
 */

/**
 * Merge form values with an existing record, preserving stored secret values
 * when the form input was left blank.
 *
 * @param next - The form values about to be submitted.
 * @param existing - The original record data (e.g. `initial.data`).
 * @param secretSlugs - Field slugs whose type is "secret".
 * @returns A new object suitable for persisting, with blank secret fields
 *          replaced by the stored value.
 */
export function mergeSecretOnSave(
  next: Record<string, unknown>,
  existing: Record<string, unknown>,
  secretSlugs: string[],
): Record<string, unknown> {
  const out = { ...next };
  for (const slug of secretSlugs) {
    if (out[slug] === "" || out[slug] === undefined || out[slug] === null) {
      out[slug] = existing[slug];
    }
  }
  return out;
}
