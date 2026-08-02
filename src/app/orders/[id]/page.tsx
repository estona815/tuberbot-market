import type { Metadata } from "next";
import { OrderWorkspace } from "@/components/order-workspace";

export const metadata: Metadata = { title: "주문 작업방", robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderWorkspace orderId={id} />;
}
