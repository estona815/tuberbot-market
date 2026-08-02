import type { ReactNode } from "react";
import { CheckIcon, ShieldIcon } from "@/components/icons";

export function StatusLabel({ children, tone = "neutral", icon = "check" }: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "info";
  icon?: "check" | "shield";
}) {
  return (
    <span className={`status-label status-label--${tone}`}>
      {icon === "shield" ? <ShieldIcon size={15} /> : <CheckIcon size={15} />}
      {children}
    </span>
  );
}
