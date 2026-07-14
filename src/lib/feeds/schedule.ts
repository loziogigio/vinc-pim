/**
 * Pure scheduling helpers for feed destinations. Kept separate from the
 * worker module so tests never instantiate a BullMQ Worker.
 */
export function feedSchedulerId(
  tenantDb: string,
  destinationId: string,
  kind: "delta" | "full"
): string {
  return `feed-${kind}-${tenantDb}-${destinationId}`;
}

export function feedCronPatterns(dest: {
  delta_interval_minutes: number;
  full_reconcile_hour: number;
}): { delta: string; full: string } {
  const minutes = Math.max(5, dest.delta_interval_minutes);
  const delta =
    minutes < 60
      ? `*/${minutes} * * * *`
      : `0 */${Math.max(1, Math.round(minutes / 60))} * * *`;
  return { delta, full: `0 ${dest.full_reconcile_hour} * * *` };
}
