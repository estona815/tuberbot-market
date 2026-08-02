import Link from "next/link";
import { PlayIcon } from "@/components/icons";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="튜버봇 마켓 홈">
      <PlayIcon size={30} />
      <span>TUBERBOT{compact ? "" : " MARKET"}</span>
    </Link>
  );
}
