import { AppLayout } from "@/components/layouts/AppLayout";
import { B2BPortalNavigation } from "@/components/b2b/B2BPortalNavigation";

export default function B2BPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<B2BPortalNavigation />}>
      {children}
    </AppLayout>
  );
}
