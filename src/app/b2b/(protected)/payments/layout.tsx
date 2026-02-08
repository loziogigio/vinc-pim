import { AppLayout } from "@/components/layouts/AppLayout";
import { PaymentsNavigation } from "@/components/payments/PaymentsNavigation";

export default function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<PaymentsNavigation />}>
      {children}
    </AppLayout>
  );
}
