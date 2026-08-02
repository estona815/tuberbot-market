import Image from "next/image";
import type { MarketplacePackage } from "@/lib/market-data";

export function PackageMedia({ item, priority = false }: { item: MarketplacePackage; priority?: boolean }) {
  return (
    <div className="package-media">
      <Image
        alt={`${item.title} 추상 미디어 썸네일`}
        fill
        priority={priority}
        sizes="(max-width: 640px) 45vw, (max-width: 1100px) 30vw, 260px"
        src={item.image}
      />
    </div>
  );
}
