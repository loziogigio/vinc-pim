import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getPlatformPost } from "@/lib/services/blog/home-news.service";
import { ReaderArticle } from "@/components/b2b/ReaderArticle";

// Served at /b2b/news/[slug] — reached via the proxy rewrite of /{tenant}/b2b/news/[slug].
// Standalone (outside the (protected) group) so it carries its own petrol shell.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPlatformPost(slug).catch(() => null);
  if (!article) return { title: "Novità" };
  return { title: article.seo?.title || article.title, description: article.seo?.description };
}

export default async function NewsReaderPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getB2BSession();
  if (!session.isLoggedIn || !session.tenantId) redirect("/login");

  const article = await getPlatformPost(slug, { viewerTenant: session.tenantId });
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
