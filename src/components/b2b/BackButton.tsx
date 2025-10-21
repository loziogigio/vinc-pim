"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type BackButtonProps = {
  label?: string;
  fallbackHref?: string;
};

export function BackButton({ label = "Back", fallbackHref = "/b2b/dashboard" }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // Try to go back in history, fallback to dashboard
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className="gap-2"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
