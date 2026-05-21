import { AppLayout } from "@/components/layouts/AppLayout";
import { BlogNavigation } from "@/components/blog/BlogNavigation";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout navigation={<BlogNavigation />}>{children}</AppLayout>;
}
