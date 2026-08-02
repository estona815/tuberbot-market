import { verifySandboxVerticalFlow } from "../src/application/verify-sandbox-vertical";

async function main() {
  const report = await verifySandboxVerticalFlow();
  console.log(JSON.stringify({
    mode: report.mode,
    orderId: report.orderId,
    orderStatus: report.orderStatus,
    contractSha256: report.contractSha256,
    paymentStatus: report.paymentStatus,
    paymentWebhookDeduplicated: report.paymentWebhookDeduplicated,
    sellerStatus: report.sellerStatus,
    payoutStatus: report.payoutStatus,
    contractAmountKrw: report.contractAmountKrw.toString(),
    platformFeeKrw: report.platformFeeKrw.toString(),
    creatorReceivableKrw: report.creatorReceivableKrw.toString(),
    ledgerTransactions: report.ledger.length,
    orderEvents: report.orderEventCount,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Sandbox verification failed");
  process.exitCode = 1;
});
