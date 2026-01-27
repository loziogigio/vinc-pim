import { AppLayout } from "@/components/layouts/AppLayout";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<AdminNavigation />}>
      {children}
    </AppLayout>
  );
}
