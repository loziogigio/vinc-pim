import { AppLayout } from "@/components/layouts/AppLayout";
import { DocumentsNavigation } from "@/components/documents/DocumentsNavigation";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout navigation={<DocumentsNavigation />}>
      {children}
    </AppLayout>
  );
}
