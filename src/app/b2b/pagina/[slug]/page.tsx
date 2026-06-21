import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getPlatformPage } from "@/lib/services/blog/home-news.service";
import { ReaderArticle } from "@/components/b2b/ReaderArticle";

// Served at /b2b/pagina/[slug] — reached via the proxy rewrite of /{tenant}/b2b/pagina/[slug].
// Standalone (outside the (protected) group) so it carries its own petrol shell.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPlatformPage(slug).catch(() => null);
  if (!article) return { title: "Pagina" };
  return { title: article.seo?.title || article.title, description: article.seo?.description };
}

export default async function StaticPageReader({ params }: PageProps) {
  const { slug } = await params;
  const session = await getB2BSession();
  if (!session.isLoggedIn || !session.tenantId) redirect("/login");

  const article = await getPlatformPage(slug);
  if (!article) notFound();

  return (
    <ReaderArticle
      tenant={session.tenantId}
      username={session.username}
      email={session.email}
      role={session.role}
      article={article}
    />
  );
}
