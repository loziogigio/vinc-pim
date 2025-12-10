import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "AI Enhancement - VINC PIM",
  description: "AI Enhancement feature",
};

export default function AIEnhancementPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-amber-100 p-4">
            <AlertCircle className="h-12 w-12 text-amber-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">
          AI Enhancement Not Active
        </h1>
        <p className="text-muted-foreground">
          Contact your commercial reference to activate this feature.
        </p>
      </div>
    </div>
  );
}
