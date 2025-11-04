import { ImportProductsView } from "@/components/pim/ImportProductsView";

export default function B2BImportPage() {
  return (
    <ImportProductsView
      breadcrumbItems={[
        { label: "Dashboard", href: "/b2b/dashboard" },
        { label: "Import" },
        { label: "Import Products" }
      ]}
      redirectPath="/b2b/pim/jobs"
      sourcesHref="/b2b/pim/sources"
    />
  );
}
