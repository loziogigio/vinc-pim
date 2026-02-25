import { AppLayout } from "@/components/layouts/AppLayout";
import { B2CNavigation } from "@/components/b2c/B2CNavigation";

export default function B2CLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<B2CNavigation />}>
      {children}
    </AppLayout>
  );
}
