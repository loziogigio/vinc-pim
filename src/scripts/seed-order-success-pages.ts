/**
 * Seed: per-language "order received" CMS pages (default portal).
 *
 * Creates one b2bpage + published richText template per language, holding the
 * post-order confirmation message. The storefront redirects here after a plain
 * (sync) order submit when the channel's `cart_settings.order_success_pages`
 * maps the language to the page's slug (see seed-data-model-cart-settings.ts).
 *
 * Each language is its own page/slug (CMS slugs are globally unique with a
 * per-page lang gate). Pages are `show_in_nav: false` so they don't appear in
 * navigation. Re-runs skip existing pages unless --force (then content is reset).
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-order-success-pages.ts --tenant baseprotection-com
 *   pnpm tsx src/scripts/seed-order-success-pages.ts --tenant baseprotection-com --force
 *   pnpm tsx src/scripts/seed-order-success-pages.ts --tenant baseprotection-com --dry-run
 */

import "dotenv/config";
import { connectWithModels, closeAllConnections } from "@/lib/db/connection";
import { createPage } from "@/lib/services/b2b-page.service";
import {
  saveB2BPageTemplateDraft,
  publishB2BPageTemplate,
} from "@/lib/db/b2b-page-templates";

const PORTAL_SLUG = "default";

interface PageDef {
  lang: string;
  slug: string;
  title: string;
  paragraphs: string[];
}

// Content supplied by the tenant. First paragraph = confirmation, second =
// availability note. Rendered as a richText block (<h2> + <p> per paragraph).
const PAGES: PageDef[] = [
  {
    lang: "it",
    slug: "ordine-ricevuto",
    title: "Ordine ricevuto",
    paragraphs: [
      "Grazie per il vostro ordine. Lo troverete a breve nell’area utente tra “I Miei Ordini”.",
      "La disponibilità effettiva sarà confermata solo con l’invio della conferma ordine. Verrete avvisati quando l'ordine sarà elaborato.",
    ],
  },
  {
    lang: "en",
    slug: "order-received",
    title: "Order received",
    paragraphs: [
      "Thank you for your order. You will soon find it in your user area under “My Orders”.",
      "Actual availability will only be confirmed when the order confirmation is sent. You will be notified when the order has been processed.",
    ],
  },
  {
    lang: "fr",
    slug: "commande-recue",
    title: "Commande reçue",
    paragraphs: [
      "Merci pour votre commande. Vous la trouverez bientôt dans votre espace utilisateur sous « Mes commandes ».",
      "La disponibilité réelle ne sera confirmée qu’avec l’envoi de la confirmation de commande. Vous serez informé lorsque la commande aura été traitée.",
    ],
  },
  {
    lang: "de",
    slug: "bestellung-erhalten",
    title: "Bestellung erhalten",
    paragraphs: [
      "Vielen Dank für Ihre Bestellung. Sie werden diese in Kürze in Ihrem Benutzerbereich unter „Meine Bestellungen“ finden.",
      "Die tatsächliche Verfügbarkeit wird erst mit dem Versand der Auftragsbestätigung bestätigt. Sie werden benachrichtigt, sobald die Bestellung bearbeitet wurde.",
    ],
  },
  {
    lang: "es",
    slug: "pedido-recibido",
    title: "Pedido recibido",
    paragraphs: [
      "Gracias por su pedido. Lo encontrará en breve en su área de usuario en “Mis pedidos”.",
      "La disponibilidad real se confirmará únicamente con el envío de la confirmación del pedido. Se le notificará cuando el pedido haya sido procesado.",
    ],
  },
  {
    lang: "pt",
    slug: "pedido-recebido",
    title: "Pedido recebido",
    paragraphs: [
      "Obrigado pelo seu pedido. Em breve poderá encontrá-lo na sua área de utilizador em “Os meus pedidos”.",
      "A disponibilidade efetiva só será confirmada com o envio da confirmação do pedido. Será notificado quando o pedido for processado.",
    ],
  },
];

function buildHtml(def: PageDef): string {
  const paras = def.paragraphs.map((p) => `<p>${p}</p>`).join("");
  return `<h2>${def.title}</h2>${paras}`;
}

function buildBlock(def: PageDef) {
  return {
    id: `order-success-${def.lang}`,
    type: "richText",
    config: {
      variant: "richText",
      content: buildHtml(def),
      width: "contained",
      textAlign: "left",
      padding: "medium",
    },
  };
}

interface Args {
  tenant?: string;
  force: boolean;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--tenant":
        out.tenant = argv[++i];
        break;
      case "--force":
        out.force = true;
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (!args.tenant) {
    console.error("Usage: --tenant <id> [--force] [--dry-run]");
    process.exit(1);
  }
  const tenantDb = `vinc-${args.tenant}`;

  console.log(`\n📄 Seed order-success CMS pages`);
  console.log(`   Tenant : ${args.tenant} (database: ${tenantDb})`);
  console.log(`   Portal : ${PORTAL_SLUG}`);
  console.log(`   Pages  : ${PAGES.map((p) => `${p.lang}:${p.slug}`).join(", ")}\n`);

  if (args.dryRun) {
    for (const def of PAGES) {
      console.log(`— ${def.lang} /${def.slug} —`);
      console.log(`   title: ${def.title}`);
      console.log(`   html : ${buildHtml(def)}\n`);
    }
    console.log("🌵 Dry run — nothing written.");
    return;
  }

  const { B2BPage } = await connectWithModels(tenantDb);

  for (const def of PAGES) {
    const existing = await B2BPage.findOne({
      portal_slug: PORTAL_SLUG,
      slug: def.slug,
    }).lean();

    if (existing && !args.force) {
      console.log(`↩️  ${def.lang} /${def.slug} already exists — left untouched (pass --force to reset content).`);
      continue;
    }

    if (!existing) {
      await createPage(tenantDb, PORTAL_SLUG, {
        slug: def.slug,
        title: def.title,
        lang: def.lang,
        show_in_nav: false,
        sort_order: 900,
      });
      console.log(`✅ ${def.lang} /${def.slug} — page created`);
    }

    await saveB2BPageTemplateDraft(
      PORTAL_SLUG,
      def.slug,
      { blocks: [buildBlock(def)] },
      tenantDb,
    );
    await publishB2BPageTemplate(PORTAL_SLUG, def.slug, tenantDb);
    console.log(`   ${existing ? "✏️  content reset" : "📝 content published"} for /${def.slug}`);
  }

  console.log("\n✨ Done.\n");
}

main()
  .catch(async (err) => {
    console.error("\n💥 Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllConnections();
  });
