import { AppLayout } from "@/components/layouts/AppLayout";
import { NotificationsNavigation } from "@/components/notifications/NotificationsNavigation";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<NotificationsNavigation />}>
      {children}
    </AppLayout>
  );
}
