import { NextResponse } from "next/server";
import { evaluateLivePaymentReadiness, getRuntimeConfig } from "@/lib/server/runtime-config";

export const dynamic = "force-dynamic";

export function GET() {
  const config = getRuntimeConfig();
  const readiness = evaluateLivePaymentReadiness(config);
  return NextResponse.json(
    {
      status: "ok",
      service: "tuberbot-market",
      payment: {
        provider: config.PAYMENT_PROVIDER,
        mode: config.PAYMENT_MODE.toUpperCase(),
        livePayment: readiness.allowed ? "READY_FOR_CONTROLLED_PILOT" : "BLOCKED_EXTERNAL",
        payout: config.PAYMENT_MODE === "sandbox" ? "SANDBOX" : config.ENABLE_PAYOUTS ? "CONFIGURED" : "BLOCKED",
        safePaymentPublicBadge: readiness.allowed && config.ENABLE_SAFE_PAYMENT_BADGE ? "ENABLED" : "DISABLED",
      },
      checks: { liveActivationBlockers: readiness.blockers },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
