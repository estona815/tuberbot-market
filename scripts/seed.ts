import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed configuration");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("db:seed is intentionally disabled in production");
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 5,
  connection: { application_name: "tuberbot-seeder" },
  onnotice: () => undefined,
});

const safeFeatureFlags = [
  ["ENABLE_MARKETPLACE", true, false, "Marketplace screens and sandbox domain flow"],
  ["ENABLE_CAMPAIGN_BOARD", true, false, "Advertiser campaign board"],
  ["ENABLE_CREATOR_CLAIM", true, false, "Legacy creator ownership claim flow"],
  ["ENABLE_LIVE_PAYMENTS", false, true, "Production payment authorization"],
  ["ENABLE_PAYOUTS", false, true, "Provider payout dispatch"],
  ["ENABLE_SAFE_PAYMENT_BADGE", false, true, "Public safe-payment claim"],
  ["ENABLE_ESTIMATED_AD_RATE", false, true, "Legacy estimated advertisement rates"],
  ["ENABLE_ESTIMATED_CPV", false, true, "Legacy estimated CPV"],
  ["ENABLE_REGULATED_CATEGORIES", false, true, "Regulated advertising categories"],
] as const;

const feeRules = [
  ["MARKETPLACE_STANDARD", 1, 1200, 0, 0, 100_000, { orderKind: "MARKETPLACE" }],
  ["MANAGED_CAMPAIGN", 1, 1200, 700, 0, 100_000, { orderKind: "MANAGED_CAMPAIGN" }],
  ["LICENSE_RENEWAL", 1, 0, 0, 1000, 0, { orderKind: "LICENSE_RENEWAL" }],
  ["WELCOME_SELLER", 1, 500, 0, 0, 100_000, { completedOrderLimit: 3 }],
] as const;

const ledgerAccounts = [
  ["PG_CLEARING", "PG clearing", "ASSET", "DEBIT"],
  ["CUSTOMER_PAYMENT_LIABILITY", "Customer payment liability", "LIABILITY", "CREDIT"],
  ["CREATOR_PAYABLE", "Creator payable", "LIABILITY", "CREDIT"],
  ["PLATFORM_FEE_REVENUE", "Platform fee revenue", "REVENUE", "CREDIT"],
  ["PAYMENT_PROVIDER_FEE_EXPENSE", "Payment provider fee expense", "EXPENSE", "DEBIT"],
  ["REFUND_LIABILITY", "Refund liability", "LIABILITY", "CREDIT"],
  ["CHARGEBACK_LIABILITY", "Chargeback liability", "LIABILITY", "CREDIT"],
  ["TAX_PAYABLE", "Tax payable", "LIABILITY", "CREDIT"],
  ["PROMOTION_EXPENSE", "Promotion expense", "EXPENSE", "DEBIT"],
] as const;

async function main(): Promise<void> {
  try {
    await sql.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(hashtext('tuberbot-safe-configuration-seed'))`;
      await transaction`set local time zone 'UTC'`;

      for (const [key, enabled, requiresApproval, description] of safeFeatureFlags) {
        await transaction`
          insert into feature_flags (
            key,
            environment,
            enabled,
            value,
            description,
            requires_external_approval
          ) values (
            ${key},
            'all',
            ${enabled},
            ${transaction.json(enabled)},
            ${description},
            ${requiresApproval}
          )
          on conflict (key, environment) do nothing
        `;
      }

      for (const [
        code,
        version,
        sellerFeeBps,
        buyerFeeBps,
        licenseFeeBps,
        minimumOrderKrw,
        applicability,
      ] of feeRules) {
        await transaction`
          insert into fee_rules (
            code,
            version,
            seller_fee_bps,
            buyer_fee_bps,
            license_renewal_fee_bps,
            minimum_order_krw,
            applies_to,
            effective_from
          ) values (
            ${code},
            ${version},
            ${sellerFeeBps},
            ${buyerFeeBps},
            ${licenseFeeBps},
            ${minimumOrderKrw},
            ${transaction.json({
              ...applicability,
              source: "master-prompt-2026-08-02",
              productionApproval: false,
            })},
            ${new Date("2026-08-02T00:00:00.000Z")}
          )
          on conflict (code, version) do nothing
        `;
      }

      for (const [code, name, accountType, normalBalance] of ledgerAccounts) {
        await transaction`
          insert into ledger_accounts (code, name, account_type, normal_balance, currency)
          values (${code}, ${name}, ${accountType}, ${normalBalance}, 'KRW')
          on conflict (code) do nothing
        `;
      }
    });

    console.info("[db:seed] safe feature flags, versioned fee rules, and ledger chart seeded");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed failure";
  console.error(`[db:seed] failed: ${message}`);
  process.exitCode = 1;
});
