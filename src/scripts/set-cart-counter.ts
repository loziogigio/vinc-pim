/**
 * Set Cart Counter
 *
 * Sets the per-year cart-number counter for a tenant. The next cart created
 * that year receives <value> + 1.
 *
 * Usage:
 *   pnpm set:cart-counter --tenant hidros-it --value 99999
 *   pnpm set:cart-counter --tenant hidros-it --value 99999 --year 2026 --dry-run
 *   pnpm set:cart-counter --tenant hidros-it --value 99999 --yes
 *   pnpm set:cart-counter --tenant hidros-it --value 1000 --force   # allow lowering (risks dup numbers)
 *
 * Safety: refuses to set the counter BELOW max(current counter, highest existing
 * cart_number for that year) unless --force is given, because that would risk
 * duplicate cart numbers on the next cart creation.
 */

import "dotenv/config";
import { getCartCounter, setCartCounter } from "../lib/db/models/counter";
import {
  getPooledConnection,
  closeAllConnections,
} from "../lib/db/connection-pool";

interface Args {
  tenant?: string;
  value?: number;
  year: number;
  dryRun: boolean;
  yes: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = {
    year: new Date().getFullYear(),
    dryRun: false,
    yes: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--tenant":
        out.tenant = argv[++i];
        break;
      case "--value":
        out.value = parseInt(argv[++i], 10);
        break;
      case "--year":
        out.year = parseInt(argv[++i], 10);
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      case "--yes":
      case "-y":
        out.yes = true;
        break;
      case "--force":
        out.force = true;
        break;
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(1);
    }
  }
  return out;
}

function usage(): never {
  console.log(`
Set the per-year cart-number counter for a tenant.

Usage:
  pnpm set:cart-counter --tenant <id> --value <n> [--year <yyyy>] [--dry-run] [--yes] [--force]

Options:
  --tenant <id>    Tenant id (database "vinc-<id>"). Required.
  --value <n>      Counter value to set; next cart that year = n + 1. Required.
  --year <yyyy>    Year of the cart-number sequence. Default: current year.
  --dry-run        Show what would change without writing.
  --yes, -y        Skip the confirmation prompt.
  --force          Allow lowering the counter (risks duplicate cart numbers).

Example (next hidros-it cart in ${new Date().getFullYear()} becomes 100000):
  pnpm set:cart-counter --tenant hidros-it --value 99999
`);
  process.exit(1);
}

async function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} `, (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function main() {
  const args = parseArgs();
  if (
    !args.tenant ||
    args.value === undefined ||
    Number.isNaN(args.value) ||
    Number.isNaN(args.year)
  ) {
    usage();
  }
  if (args.value! < 0) {
    console.error("❌ --value must be a non-negative integer");
    process.exit(1);
  }

  const tenantDb = `vinc-${args.tenant}`;
  console.log(`\n🔢 Set cart-number counter`);
  console.log(`   Tenant : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Year   : ${args.year}`);
  console.log(
    `   Target : ${args.value}  →  next cart number will be ${args.value! + 1}\n`,
  );

  const conn = await getPooledConnection(tenantDb);

  const currentCounter = await getCartCounter(tenantDb, args.year);
  const maxDoc = await conn
    .collection("orders")
    .find({ year: args.year, cart_number: { $exists: true, $ne: null } })
    .sort({ cart_number: -1 })
    .limit(1)
    .next();
  const maxExisting: number = (maxDoc?.cart_number as number) ?? 0;

  console.log(`   Current counter value       : ${currentCounter}`);
  console.log(
    `   Highest existing cart_number : ${maxExisting} (year ${args.year})\n`,
  );

  const floor = Math.max(currentCounter, maxExisting);
  if (args.value! < floor && !args.force) {
    console.error(
      `❌ Refusing: target ${args.value} is below ${floor}, which would risk duplicate cart numbers.\n` +
        `   Re-run with --force if you really mean it.`,
    );
    await closeAllConnections();
    process.exit(1);
  }

  if (args.dryRun) {
    console.log("🌵 Dry run — no changes written.");
    await closeAllConnections();
    return;
  }

  if (!args.yes) {
    const ok = await confirm(
      `Set cart_number_${args.year} = ${args.value} for ${tenantDb}? Type 'yes' to confirm:`,
    );
    if (!ok) {
      console.log("\nCancelled.");
      await closeAllConnections();
      return;
    }
  }

  await setCartCounter(tenantDb, args.year, args.value!);
  const after = await getCartCounter(tenantDb, args.year);
  console.log(
    `\n✅ Done. cart_number_${args.year} = ${after}. Next cart number will be ${after + 1}.`,
  );

  await closeAllConnections();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed:", err);
    process.exit(1);
  });
