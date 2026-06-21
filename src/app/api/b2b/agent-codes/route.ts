/**
 * Agent Codes API
 *
 * GET /api/b2b/agent-codes — list sales agents currently assigned to at least
 * one customer or address (reserved `agente:` tag prefix), with a live customer
 * count. Powers the promotion editor's agent picker; agents with no customers
 * auto-retire (do not appear).
 */

import { NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { AGENT_TAG_PREFIX, parseFullTag } from "@/lib/constants/customer-tag";
import { getTagAuth } from "@/app/api/b2b/customer-tags/_auth";

export async function GET() {
  const auth = await getTagAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { Customer, CustomerTag } = await connectWithModels(auth.tenantDb);

  // Distinct agent full_tags actually assigned (customer tags ∪ address overrides),
  // counted per customer.
  const rows: Array<{ _id: string; customer_count: number }> = await Customer.aggregate([
    {
      $project: {
        agent_tags: {
          $setUnion: [
            {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$tags", []] },
                    as: "t",
                    cond: { $eq: ["$$t.prefix", AGENT_TAG_PREFIX] },
                  },
                },
                as: "t",
                in: "$$t.full_tag",
              },
            },
            {
              $reduce: {
                input: { $ifNull: ["$addresses", []] },
                initialValue: [],
                in: {
                  $setUnion: [
                    "$$value",
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ["$$this.tag_overrides", []] },
                            as: "o",
                            cond: { $eq: ["$$o.prefix", AGENT_TAG_PREFIX] },
                          },
                        },
                        as: "o",
                        in: "$$o.full_tag",
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
    { $unwind: "$agent_tags" },
    { $group: { _id: "$agent_tags", customer_count: { $sum: 1 } } },
  ]);

  const fullTags = rows.map((r) => r._id);
  const defs = fullTags.length
    ? await CustomerTag.find({ prefix: AGENT_TAG_PREFIX, full_tag: { $in: fullTags } }).lean()
    : [];
  const defByTag = new Map(defs.map((d: { full_tag: string }) => [d.full_tag, d]));

  const agents = rows
    .map((r) => {
      const def = defByTag.get(r._id) as { code?: string; description?: string } | undefined;
      const code = def?.code ?? parseFullTag(r._id)?.code ?? r._id;
      return {
        full_tag: r._id,
        code,
        name: def?.description ?? code,
        customer_count: r.customer_count,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return NextResponse.json({ success: true, agents });
}
