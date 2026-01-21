/**
 * Bulk Publish Script
 * Publishes products based on completeness score threshold
 *
 * Usage:
 *   pnpm bulk-publish [options]
 *
 * Options:
 *   --min-score <number>   Minimum score to publish (default: 80)
 *   --max-items <number>   Maximum items to publish (default: unlimited)
 *   --dry-run              Only show what would be published (default: true)
 *   --execute              Actually publish (sets dry_run=false)
 *   --no-recalculate       Skip score recalculation (use stored scores)
 *
 * Examples:
 *   pnpm bulk-publish                         # Dry run with default settings
 *   pnpm bulk-publish -- --min-score 70       # Dry run with score >= 70
 *   pnpm bulk-publish -- --execute            # Actually publish
 *   pnpm bulk-publish -- --execute --max-items 100  # Publish max 100 items
 */

import mongoose from "mongoose";
import { connectWithModels } from "@/lib/db/connection";
import { calculateCompletenessScore, findCriticalIssues } from "@/lib/pim/scorer";

// Parse command line arguments
const args = process.argv.slice(2);

function getArg(name: string, defaultValue?: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return defaultValue;
  if (index + 1 < args.length && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }
  return defaultValue;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const MIN_SCORE = parseInt(getArg("min-score", "80") || "80");
const MAX_ITEMS = getArg("max-items") ? parseInt(getArg("max-items")!) : undefined;
const DRY_RUN = !hasFlag("execute");
const RECALCULATE = !hasFlag("no-recalculate");

async function main() {
  console.log("\n🚀 Bulk Publish Script");
  console.log("=".repeat(50));
  console.log(`📊 Min Score: ${MIN_SCORE}`);
  console.log(`📦 Max Items: ${MAX_ITEMS || "unlimited"}`);
  console.log(`🔄 Recalculate Scores: ${RECALCULATE}`);
  console.log(`🏃 Mode: ${DRY_RUN ? "DRY RUN (use --execute to publish)" : "EXECUTE"}`);
  console.log("=".repeat(50));

  // Get tenant ID from environment
  const tenantId = process.env.VINC_TENANT_ID;
  if (!tenantId) {
    console.error('❌ VINC_TENANT_ID environment variable is required');
    console.error('   Usage: VINC_TENANT_ID=hidros-it pnpm run bulk-publish');
    process.exit(1);
  }

  const dbName = `vinc-${tenantId}`;

  // Connect to MongoDB using app's connection logic
  console.log("\n📡 Connecting to MongoDB...");
  const { PIMProduct } = await connectWithModels(dbName);
  console.log(`✅ Connected to ${dbName}`);

  try {
    // Find all draft products
    const query: any = {
      isCurrent: true,
      status: "draft",
    };

    if (!RECALCULATE) {
      query.completeness_score = { $gte: MIN_SCORE };
    }

    const drafts = await PIMProduct.find(query)
      .limit(MAX_ITEMS ? MAX_ITEMS * 2 : 0)
      .lean() as any[];

    console.log(`\n📋 Found ${drafts.length} draft products to evaluate`);

    // Process and filter eligible products
    const eligible: any[] = [];
    const scoreChanges: { entity_code: string; old: number; new: number }[] = [];

    for (const product of drafts) {
      let score = product.completeness_score || 0;
      let issues = product.critical_issues || [];

      if (RECALCULATE) {
        const newScore = calculateCompletenessScore(product);
        const newIssues = findCriticalIssues(product);

        if (newScore !== score) {
          scoreChanges.push({
            entity_code: product.entity_code,
            old: score,
            new: newScore,
          });
        }

        score = newScore;
        issues = newIssues;
      }

      if (score >= MIN_SCORE) {
        eligible.push({
          ...product,
          completeness_score: score,
          critical_issues: issues,
        });

        if (MAX_ITEMS && eligible.length >= MAX_ITEMS) {
          break;
        }
      }
    }

    console.log(`\n✅ ${eligible.length} products eligible (score >= ${MIN_SCORE})`);

    if (scoreChanges.length > 0) {
      console.log(`\n📊 Score changes detected for ${scoreChanges.length} products:`);
      scoreChanges.slice(0, 10).forEach((c) => {
        console.log(`   ${c.entity_code}: ${c.old} → ${c.new}`);
      });
      if (scoreChanges.length > 10) {
        console.log(`   ... and ${scoreChanges.length - 10} more`);
      }
    }

    // Show eligible products
    if (eligible.length > 0) {
      console.log(`\n📦 Eligible products:`);
      console.log("-".repeat(80));
      console.log("Entity Code".padEnd(20) + "SKU".padEnd(20) + "Score".padEnd(10) + "Issues".padEnd(10) + "Name");
      console.log("-".repeat(80));

      eligible.slice(0, 20).forEach((p) => {
        const name = typeof p.name === "string"
          ? p.name
          : p.name?.it || p.name?.en || Object.values(p.name || {})[0] || "";
        console.log(
          p.entity_code.padEnd(20) +
          (p.sku || "").slice(0, 18).padEnd(20) +
          String(p.completeness_score).padEnd(10) +
          String(p.critical_issues?.length || 0).padEnd(10) +
          (name as string).slice(0, 30)
        );
      });

      if (eligible.length > 20) {
        console.log(`... and ${eligible.length - 20} more`);
      }
      console.log("-".repeat(80));
    }

    // Execute or dry run
    if (DRY_RUN) {
      console.log(`\n🏃 DRY RUN: Would publish ${eligible.length} products`);
      console.log(`   To actually publish, run with --execute flag`);
    } else {
      console.log(`\n🚀 Publishing ${eligible.length} products...`);

      const publishedAt = new Date();
      let successCount = 0;
      let failCount = 0;

      for (const product of eligible) {
        try {
          await PIMProduct.updateOne(
            { entity_code: product.entity_code, isCurrent: true },
            {
              $set: {
                status: "published",
                published_at: publishedAt,
                isCurrentPublished: true,
                completeness_score: product.completeness_score,
                critical_issues: product.critical_issues,
                updated_at: publishedAt,
              },
            }
          );
          successCount++;
          process.stdout.write(`\r   Published: ${successCount}/${eligible.length}`);
        } catch (error: any) {
          failCount++;
          console.error(`\n❌ Failed ${product.entity_code}: ${error.message}`);
        }
      }

      console.log(`\n\n🎉 Complete!`);
      console.log(`   ✅ Published: ${successCount}`);
      if (failCount > 0) {
        console.log(`   ❌ Failed: ${failCount}`);
      }
    }

    // Show stats
    const totalDrafts = await PIMProduct.countDocuments({ isCurrent: true, status: "draft" });
    const totalPublished = await PIMProduct.countDocuments({ isCurrent: true, status: "published" });

    console.log(`\n📈 Current Stats:`);
    console.log(`   Draft: ${totalDrafts}`);
    console.log(`   Published: ${totalPublished}`);

  } finally {
    // Disconnect from MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    console.log("\n👋 Done\n");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
