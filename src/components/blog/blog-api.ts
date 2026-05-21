import type { BlogPostListItem, SalesChannelOption, BlogTaxonomyItem } from "./types";

async function asJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export interface ListPostsParams {
  channel: string;
  locale?: string;
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export async function fetchPosts(
  params: ListPostsParams,
): Promise<{ items: BlogPostListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const qs = new URLSearchParams();
  qs.set("channel", params.channel);
  if (params.locale) qs.set("locale", params.locale);
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 20));
  const json = await asJson(await fetch(`/api/b2b/blog/posts?${qs.toString()}`, { cache: "no-store" }));
  return json.data;
}

export async function createPost(body: {
  title: string;
  slug?: string;
  channels: string[];
  default_locale: string;
}): Promise<{ post_id: string; slug: string }> {
  const json = await asJson(
    await fetch(`/api/b2b/blog/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return json.data;
}

export async function updatePost(postId: string, body: Record<string, unknown>): Promise<void> {
  await asJson(
    await fetch(`/api/b2b/blog/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deletePost(postId: string): Promise<void> {
  await asJson(await fetch(`/api/b2b/blog/posts/${postId}`, { method: "DELETE" }));
}

export async function fetchChannels(): Promise<SalesChannelOption[]> {
  const json = await asJson(await fetch(`/api/b2b/channels`, { cache: "no-store" }));
  return (json.channels || []).map((c: { code: string; name: string }) => ({ code: c.code, name: c.name }));
}

export async function fetchTaxonomy(kind: "categories" | "tags"): Promise<BlogTaxonomyItem[]> {
  const json = await asJson(await fetch(`/api/b2b/blog/${kind}`, { cache: "no-store" }));
  return json.data.items;
}

export async function createTaxonomy(kind: "categories" | "tags", body: Record<string, unknown>): Promise<void> {
  await asJson(
    await fetch(`/api/b2b/blog/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function updateTaxonomy(kind: "categories" | "tags", id: string, body: Record<string, unknown>): Promise<void> {
  await asJson(
    await fetch(`/api/b2b/blog/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteTaxonomy(kind: "categories" | "tags", id: string): Promise<void> {
  await asJson(await fetch(`/api/b2b/blog/${kind}/${id}`, { method: "DELETE" }));
}
