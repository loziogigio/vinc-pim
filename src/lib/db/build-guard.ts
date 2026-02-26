/**
 * Build-Phase Guard
 *
 * During `next build`, pages are pre-rendered to determine if they're static or dynamic.
 * Database connections are not available during this phase (e.g., Docker builds where
 * MongoDB isn't running). Without this guard, Mongoose waits for the full
 * serverSelectionTimeoutMS (default 30s) per connection attempt, making builds extremely slow.
 *
 * When NEXT_BUILD_PHASE=1 is set (in Dockerfile build stage), database operations
 * throw immediately. Next.js catches the error and marks the page as dynamic
 * (server-rendered at request time), which is the correct behavior for a B2B app.
 */

const BUILD_PHASE_ENV = "NEXT_BUILD_PHASE";

/**
 * Check if we're running during the Next.js build phase.
 * Set NEXT_BUILD_PHASE=1 in Dockerfile before `next build`.
 */
export function isBuildPhase(): boolean {
  return (
    process.env[BUILD_PHASE_ENV] === "1" ||
    process.env[BUILD_PHASE_ENV] === "true"
  );
}

/**
 * Error thrown when database operations are attempted during build phase.
 * Next.js catches this and marks the page as dynamic (SSR at request time).
 */
export class BuildPhaseError extends Error {
  constructor(operation: string) {
    super(
      `[BuildPhase] ${operation} skipped — database not available during build. ` +
        `Page will be server-rendered at request time.`
    );
    this.name = "BuildPhaseError";
  }
}

/**
 * Guard that throws immediately if called during build phase.
 * Use at the top of database connection functions.
 */
export function assertNotBuildPhase(operation: string): void {
  if (isBuildPhase()) {
    throw new BuildPhaseError(operation);
  }
}
