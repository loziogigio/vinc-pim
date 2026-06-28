import { redirect } from "next/navigation";

export default function LegacyFcmSettingsPage() {
  redirect("/b2b/notifications/settings");
}
