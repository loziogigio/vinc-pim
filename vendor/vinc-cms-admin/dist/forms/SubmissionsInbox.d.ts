import { type JSX } from "react";
import { CmsAdminError } from "../client.js";
export interface SubmissionsInboxProps {
    /** Lets the host intercept a write failure (e.g. the B2B portal's 409
     *  NOT_MIGRATED gate). Return true when handled, to suppress the generic
     *  inline error. */
    onWriteError?: (err: CmsAdminError) => boolean;
}
/**
 * Submissions inbox (form submissions list + detail modal).
 *
 * Chrome-less: the host owns breadcrumbs, page title, and the Submissions/Definitions
 * tab bar (see `FormsScreen`). Extracted from CS
 * `app/b2b/(protected)/b2c/storefronts/[slug]/forms/page.tsx`'s submissions-tab portion.
 *
 * Filtering, pagination, selection and CSV export all happen server-side — this
 * component never filters `submissions` itself.
 *
 * @remarks The adapter passed to CmsAdminProvider must be memoized.
 */
export declare function SubmissionsInbox({ onWriteError }?: SubmissionsInboxProps): JSX.Element;
//# sourceMappingURL=SubmissionsInbox.d.ts.map