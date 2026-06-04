"use client";
import { Toaster } from "sonner";
import { CircleCheckBig, CircleX, TriangleAlert, Info, Loader2 } from "lucide-react";

const icon = (Icon: React.ElementType) => (
  <Icon className="h-4 w-4 text-primary shrink-0" />
);

export function CustomToaster() {
  return (
    <Toaster
      position="bottom-right"
      offset={24}
      closeButton
      duration={4500}
      icons={{
        success: icon(CircleCheckBig),
        error:   icon(CircleX),
        warning: icon(TriangleAlert),
        info:    icon(Info),
        loading: <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: [
            "!font-[var(--font-exo2)] !rounded-xl !bg-white !text-foreground",
            "!border !border-border !border-l-[3px] !border-l-primary",
            "!shadow-[0_8px_32px_rgba(0,0,0,0.08)] !px-4 !py-3.5 !gap-3",
          ].join(" "),
          title:       "!font-semibold !text-sm !text-foreground !leading-snug",
          description: "!text-xs !text-muted-foreground !leading-relaxed",
          closeButton: "!rounded-lg !border-border !bg-white hover:!bg-muted/60 !text-muted-foreground",
        },
      }}
    />
  );
}
