import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session.isLoggedIn) {
    redirect("/admin/login");
  }

  return <div className="min-h-screen bg-muted">{children}</div>;
}
