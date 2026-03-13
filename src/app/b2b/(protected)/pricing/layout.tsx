import { AppLayout } from "@/components/layouts/AppLayout";
import { PricingNavigation } from "@/components/pricing/PricingNavigation";

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<PricingNavigation />}>
      {children}
    </AppLayout>
  );
}
