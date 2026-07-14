import { AppLayout } from "@/components/layouts/AppLayout";
import { FeedsNavigation } from "@/components/feeds/FeedsNavigation";

export default function FeedsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<FeedsNavigation />}>
      {children}
    </AppLayout>
  );
}
