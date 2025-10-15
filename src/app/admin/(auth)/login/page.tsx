import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminSession } from "@/lib/auth/session";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session.isLoggedIn) {
    redirect("/admin/page-builder");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted">
      <div className="w-full max-w-md rounded-3xl border bg-background p-8 shadow-sm">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-semibold">VINC Admin Login</h1>
          <p className="text-sm text-muted-foreground">Use the admin credentials to access the builder.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Default credentials: <span className="font-medium">admin / admin</span>
        </p>
      </div>
    </div>
  );
}
