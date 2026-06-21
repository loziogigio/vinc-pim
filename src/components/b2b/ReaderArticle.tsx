import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServerBlockRenderer } from "@/components/renderer/ServerBlockRenderer";
import { SuiteHeader } from "@/components/b2b/SuiteHeader";
import type { HomeNewsArticle } from "@/lib/services/blog/home-news.service";
import { CONTENT_MAX_WIDTH } from "@/lib/utils/layout";

// "container" layout follows the main theme container (same width as the app bar / launcher);
// "full-width" layout is edge-to-edge.
const CONTAINER = `mx-auto w-full ${CONTENT_MAX_WIDTH} px-4 sm:px-6 lg:px-8`;

interface ReaderArticleProps {
  tenant: string;
  username?: string;
  email?: string;
  role?: string;
  article: HomeNewsArticle;
}

/**
 * Read-only article view in the petrol launcher shell. Width is NOT hardcoded:
 * each block is laid out from its own `layout` field ("full-width" → edge-to-edge,
 * "container"/unset → centered max-width), exactly like the rest of the dynamic pages.
 * Shared by the news reader and the static-page reader.
 */
export function ReaderArticle({ tenant, username, email, role, article }: ReaderArticleProps) {
  return (
    <div className="vinc-login suite-bg min-h-screen">
      <SuiteHeader tenant={tenant} username={username} email={email} role={role} />

      <main className="py-8 sm:py-10 lg:py-12">
        <div className={CONTAINER}>
          <Link
            href={`/${tenant}/b2b`}
            className="c-ink-50 hover-accent mb-6 inline-flex items-center gap-1.5 text-[0.85rem] font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna alla home
          </Link>

          <header className="bd-line border-b pb-7">
            <p className="eyebrow">{article.category || "VendereInCloud"}</p>
            <h1 className="c-ink mt-3.5 display text-[2rem] font-bold leading-[1.08] text-balance sm:text-[2.55rem]">
              {article.title}
            </h1>
            {article.dateLabel && (
              <p className="mono c-ink-45 mt-3 text-[0.7rem] uppercase tracking-[0.14em]">{article.dateLabel}</p>
            )}
          </header>

          {article.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.coverUrl} alt="" className="bd-line mt-7 w-full rounded-2xl border object-cover" />
          )}
        </div>

        <div className="reader-prose mt-8">
          {article.blocks.length > 0 ? (
            article.blocks.map((block) => (
              <div key={block.id} className={block.layout === "full-width" ? "w-full" : CONTAINER}>
                <ServerBlockRenderer block={block} />
              </div>
            ))
          ) : (
            <div className={CONTAINER}>
              <p className="c-ink-60">Nessun contenuto disponibile.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
