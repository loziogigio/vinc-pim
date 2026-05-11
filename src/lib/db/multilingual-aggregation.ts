import type { Model, PipelineStage } from "mongoose";
import { safeRegexQuery } from "@/lib/security";

/**
 * Return distinct, non-empty string values from a `MultilingualText` field,
 * collected across every language key (e.g. `{ it: "Cavi", en: "Cables" }`
 * yields both "Cavi" and "Cables").
 *
 * `MultilingualText` fields are persisted as Mixed in MongoDB, so a few legacy
 * documents may store a plain string (or an empty string) instead of a language
 * map. `$objectToArray` only accepts document inputs and throws on those rows,
 * so we restrict the pipeline to documents where the field is actually an
 * object before unwinding it.
 *
 * @param model     Mongoose model to aggregate over.
 * @param fieldPath Dotted path to the multilingual field (e.g. `"category.name"`).
 * @param baseMatch Extra `$match` conditions applied first (e.g. `{ isCurrent: true }`).
 * @param search    Optional case-insensitive substring filter on the values.
 * @param limit     Maximum number of distinct values to return.
 */
export async function distinctMultilingualValues(
  model: Model<unknown>,
  fieldPath: string,
  baseMatch: Record<string, unknown> = {},
  search = "",
  limit = 10
): Promise<string[]> {
  const valueMatch: Record<string, unknown> = { $type: "string", $ne: "" };
  if (search) Object.assign(valueMatch, safeRegexQuery(search));

  const pipeline: PipelineStage[] = [
    { $match: { ...baseMatch, [fieldPath]: { $type: "object" } } },
    { $project: { names: { $objectToArray: `$${fieldPath}` } } },
    { $unwind: "$names" },
    { $match: { "names.v": valueMatch } },
    { $group: { _id: "$names.v" } },
    { $sort: { _id: 1 } },
    { $limit: limit },
  ];

  const rows = await model.aggregate<{ _id: unknown }>(pipeline);
  return rows
    .map((row) => row._id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}
