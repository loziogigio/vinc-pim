/**
 * Languages Management Page
 * Accessible at: /b2b/pim/languages
 */

import LanguageManagement from "@/components/LanguageManagement";

export const metadata = {
  title: "Language Management | PIM",
  description: "Manage multilingual support for your products",
};

export default function LanguagesPage() {
  return <LanguageManagement />;
}
