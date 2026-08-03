import { NextResponse } from "next/server";
import type { Model } from "mongoose";
import { buildCsv } from "@/lib/utils/csv";
import {
  FORM_EXPORT_MAX_ROWS,
  resolveCsvDelimiter,
} from "@/lib/constants/form-export";
import {
  buildSubmissionCsvColumns,
  buildSubmissionQuery,
  parseSubmissionFilters,
  toSubmissionCsvRow,
  type ExportDefinition,
  type ExportSubmission,
  type SubmissionCsvLabels,
  type SubmissionScopeField,
} from "@/lib/services/form-submission.service";

/**
 * The body of both export routes. Kept here so the b2c and b2b handlers differ
 * only in the models and the scope key — the same reason the list routes now share
 * buildSubmissionQuery.
 */
export async function exportSubmissionsToCsv(opts: {
  body: Record<string, unknown>;
  scopeField: SubmissionScopeField;
  slug: string;
  submissionModel: Model<unknown>;
  definitionModel: Model<unknown>;
  labels: SubmissionCsvLabels;
}): Promise<NextResponse> {
  const { body, scopeField, slug, submissionModel, definitionModel, labels } = opts;

  const ids = body.submission_ids;
  const allMatching = body.all_matching === true;
  const hasIds = Array.isArray(ids) && ids.length > 0;

  if (!hasIds && !allMatching) {
    return NextResponse.json(
      { error: "Provide a non-empty submission_ids array or all_matching: true" },
      { status: 400 }
    );
  }

  // The scope key is applied first and unconditionally, so a caller passing ids
  // from another storefront/portal simply gets no rows for them.
  const query: Record<string, unknown> = hasIds
    ? { [scopeField]: slug, _id: { $in: ids } }
    : buildSubmissionQuery(
        scopeField,
        slug,
        parseSubmissionFilters(
          (body.filters as Record<string, unknown> | undefined) ?? {}
        )
      );

  const total = await submissionModel.countDocuments(query);

  if (total === 0) {
    return NextResponse.json(
      { error: "No submissions match this export", code: "NO_ROWS" },
      { status: 404 }
    );
  }

  if (total > FORM_EXPORT_MAX_ROWS) {
    return NextResponse.json(
      {
        error: "Too many rows to export",
        code: "EXPORT_TOO_LARGE",
        total,
        max: FORM_EXPORT_MAX_ROWS,
      },
      { status: 413 }
    );
  }

  const submissions = (await submissionModel
    .find(query)
    .sort({ created_at: -1 })
    .lean()) as unknown as ExportSubmission[];

  const definitions = (await definitionModel
    .find({ [scopeField]: slug })
    .lean()) as unknown as ExportDefinition[];

  const columns = buildSubmissionCsvColumns(submissions, definitions, labels);
  const rows = submissions.map((submission) =>
    toSubmissionCsvRow(submission, columns, labels)
  );

  const csv = buildCsv({
    columns,
    rows,
    delimiter: resolveCsvDelimiter(body.delimiter),
  });

  const today = new Date().toISOString().split("T")[0];
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="form-submissions-${slug}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * CSV headers are operator-facing but a route handler has no `useTranslation`.
 * The inbox sends no locale today, so English headers are used server-side; the
 * labels are threaded through as a parameter so a future `?lang=` needs no
 * refactor of the column builder.
 */
export const DEFAULT_CSV_LABELS: SubmissionCsvLabels = {
  submitted_at: "Submitted",
  form: "Form",
  form_type: "Form Type",
  page_slug: "Page",
  submitter_email: "Email",
  ip_address: "IP",
  seen: "Seen",
  yes: "Yes",
  no: "No",
  page_form: "Page Form",
  standalone: "Standalone",
};
