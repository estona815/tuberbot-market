import Link from "next/link";
import { PlayIcon } from "@/components/icons";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link aria-label="튜버봇 홈" className="brand" data-compact={compact || undefined} href="/">
      <PlayIcon size={30} />
      <span>TUBERBOT{compact ? "" : ""}</span>
    </Link>
  );
}
