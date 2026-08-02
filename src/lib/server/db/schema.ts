import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

const publicId = () => uuid("id").defaultRandom().primaryKey();
const krw = (name: string) => bigint(name, { mode: "bigint" });
const metadata = (name = "metadata") =>
  jsonb(name).$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull();

export const userRoleEnum = pgEnum("user_role", [
  "CREATOR",
  "ADVERTISER",
  "AGENCY",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "RISK",
  "MODERATOR",
]);

export const organizationTypeEnum = pgEnum("organization_type", [
  "INDIVIDUAL",
  "SOLE_PROPRIETOR",
  "CORPORATION",
  "AGENCY",
]);

export const creatorMarketplaceStatusEnum = pgEnum("creator_marketplace_status", [
  "DISCOVERY_ONLY",
  "UNCLAIMED",
  "CLAIM_PENDING",
  "CHANNEL_VERIFIED",
  "SELLER_VERIFICATION_PENDING",
  "PAYOUT_READY",
  "SUSPENDED",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "NOT_STARTED",
  "PENDING",
  "REQUIRES_ACTION",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "SUSPENDED",
]);

export const packageStatusEnum = pgEnum("package_status", [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "ARCHIVED",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "CLOSED",
  "CANCELED",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "DRAFT",
  "SENT",
  "COUNTERED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "DRAFT",
  "AWAITING_ACCEPTANCE",
  "EXECUTED",
  "SUPERSEDED",
  "VOIDED",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "DRAFT",
  "NEGOTIATING",
  "AWAITING_PARTY_ACCEPTANCE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "FUNDED",
  "BRIEF_CONFIRMATION_PENDING",
  "IN_PRODUCTION",
  "DRAFT_SUBMITTED",
  "REVISION_REQUESTED",
  "FINAL_APPROVAL_PENDING",
  "SCHEDULED_FOR_PUBLICATION",
  "PUBLISHED",
  "BUYER_CONFIRMATION_PENDING",
  "PAYOUT_BLOCKED",
  "PAYOUT_SCHEDULED",
  "PAYOUT_PROCESSING",
  "COMPLETED",
  "CANCELLATION_REQUESTED",
  "CANCELED",
  "DISPUTED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "CHARGEBACK",
  "PAYOUT_FAILED",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "CREATED",
  "READY",
  "AUTHORIZED",
  "FUNDED",
  "FAILED",
  "CANCELED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "CHARGEBACK",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "NOT_READY",
  "BLOCKED_VERIFICATION",
  "BLOCKED_DISPUTE",
  "READY",
  "SCHEDULED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELED",
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "OPEN",
  "EVIDENCE_COLLECTION",
  "UNDER_REVIEW",
  "RESOLVED",
  "APPEALED",
  "CLOSED",
]);

export const holdStatusEnum = pgEnum("hold_status", ["ACTIVE", "RELEASED"]);
export const ledgerTransactionStatusEnum = pgEnum("ledger_transaction_status", [
  "DRAFT",
  "POSTED",
]);

export const users = pgTable(
  "users",
  {
    id: publicId(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    locale: text("locale").default("ko-KR").notNull(),
    timeZone: text("time_zone").default("Asia/Seoul").notNull(),
    adminMfaEnabled: boolean("admin_mfa_enabled").default(false).notNull(),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_active_uidx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.deletedAt} is null`),
    check("users_status_check", sql`${table.status} in ('ACTIVE', 'LOCKED', 'SUSPENDED', 'DELETED')`),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    reason: text("reason"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("user_roles_role_idx").on(table.role, table.userId),
    index("user_roles_granted_by_idx").on(table.grantedByUserId),
  ],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: publicId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tokenDigest: text("token_digest").notNull().unique(),
    csrfTokenDigest: text("csrf_token_digest").notNull(),
    authMethod: text("auth_method").notNull(),
    demoRole: userRoleEnum("demo_role"),
    rotatedFromSessionId: uuid("rotated_from_session_id").references(
      (): AnyPgColumn => userSessions.id,
      { onDelete: "restrict" },
    ),
    rotationGeneration: integer("rotation_generation").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_sessions_rotated_from_uidx")
      .on(table.rotatedFromSessionId)
      .where(sql`${table.rotatedFromSessionId} is not null`),
    index("user_sessions_user_active_idx")
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
    index("user_sessions_expiry_idx").on(table.absoluteExpiresAt, table.idleExpiresAt),
    check("user_sessions_token_digest_check", sql`${table.tokenDigest} ~ '^[0-9a-f]{64}$'`),
    check("user_sessions_csrf_digest_check", sql`${table.csrfTokenDigest} ~ '^[0-9a-f]{64}$'`),
    check(
      "user_sessions_auth_method_check",
      sql`${table.authMethod} in ('EXTERNAL_PROVIDER', 'LOCAL_DEMO')`,
    ),
    check(
      "user_sessions_demo_role_check",
      sql`(${table.authMethod} = 'LOCAL_DEMO' and ${table.demoRole} in ('ADVERTISER', 'CREATOR')) or (${table.authMethod} = 'EXTERNAL_PROVIDER' and ${table.demoRole} is null)`,
    ),
    check(
      "user_sessions_rotation_check",
      sql`(${table.rotationGeneration} = 0 and ${table.rotatedFromSessionId} is null) or (${table.rotationGeneration} > 0 and ${table.rotatedFromSessionId} is not null)`,
    ),
    check("user_sessions_rotation_generation_check", sql`${table.rotationGeneration} >= 0`),
    check(
      "user_sessions_expiration_check",
      sql`${table.expiresAt} > ${table.createdAt} and ${table.expiresAt} <= ${table.absoluteExpiresAt} and ${table.idleExpiresAt} > ${table.createdAt} and ${table.idleExpiresAt} <= ${table.absoluteExpiresAt}`,
    ),
    check("user_sessions_last_seen_check", sql`${table.lastSeenAt} >= ${table.createdAt}`),
    check(
      "user_sessions_revocation_check",
      sql`(${table.revokedAt} is null and ${table.revokeReason} is null) or (${table.revokedAt} is not null and ${table.revokeReason} in ('USER_LOGOUT', 'ROTATED', 'ADMIN_REVOKE', 'PASSWORD_CHANGED', 'PRIVILEGE_CHANGED', 'EXPIRED', 'USER_DISABLED', 'SECURITY_EVENT'))`,
    ),
  ],
);

export const organizations = pgTable(
  "organizations",
  {
    id: publicId(),
    publicSlug: text("public_slug").notNull().unique(),
    type: organizationTypeEnum("type").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    status: text("status").default("ACTIVE").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    businessVerificationRef: text("business_verification_ref"),
    ...timestamps,
  },
  (table) => [
    index("organizations_created_by_idx").on(table.createdByUserId),
    check("organizations_status_check", sql`${table.status} in ('ACTIVE', 'SUSPENDED', 'CLOSED')`),
  ],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_members_user_idx").on(table.userId, table.status),
    index("organization_members_invited_by_idx").on(table.invitedByUserId),
    check(
      "organization_members_role_check",
      sql`${table.role} in ('OWNER', 'ADMIN', 'MEMBER', 'BILLING', 'VIEWER')`,
    ),
    check("organization_members_status_check", sql`${table.status} in ('INVITED', 'ACTIVE', 'REVOKED')`),
  ],
);

export const advertiserProfiles = pgTable(
  "advertiser_profiles",
  {
    id: publicId(),
    userId: uuid("user_id").references(() => users.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    publicName: text("public_name").notNull(),
    businessType: organizationTypeEnum("business_type").notNull(),
    verificationStatus: verificationStatusEnum("verification_status").default("NOT_STARTED").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("advertiser_profiles_user_uidx").on(table.userId).where(sql`${table.userId} is not null`),
    uniqueIndex("advertiser_profiles_org_uidx")
      .on(table.organizationId)
      .where(sql`${table.organizationId} is not null`),
    check(
      "advertiser_profiles_owner_check",
      sql`num_nonnulls(${table.userId}, ${table.organizationId}) = 1`,
    ),
  ],
);

export const youtubeChannels = pgTable(
  "youtube_channels",
  {
    id: publicId(),
    externalChannelId: text("external_channel_id").notNull().unique(),
    legacyChannelId: text("legacy_channel_id"),
    handle: text("handle"),
    title: text("title").notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    countryCode: text("country_code"),
    primaryLanguage: text("primary_language"),
    subscriberCount: bigint("subscriber_count", { mode: "bigint" }),
    publicViewCount: bigint("public_view_count", { mode: "bigint" }),
    publicVideoCount: bigint("public_video_count", { mode: "bigint" }),
    source: text("source").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
    sourceAuthorization: text("source_authorization").notNull(),
    sourceConfidence: numeric("source_confidence", { precision: 4, scale: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("youtube_channels_legacy_id_uidx")
      .on(table.legacyChannelId)
      .where(sql`${table.legacyChannelId} is not null`),
    index("youtube_channels_handle_idx").on(table.handle),
    check("youtube_channels_subscribers_check", sql`${table.subscriberCount} is null or ${table.subscriberCount} >= 0`),
    check("youtube_channels_views_check", sql`${table.publicViewCount} is null or ${table.publicViewCount} >= 0`),
  ],
);

export const creatorProfiles = pgTable(
  "creator_profiles",
  {
    id: publicId(),
    userId: uuid("user_id").references(() => users.id),
    youtubeChannelId: uuid("youtube_channel_id")
      .notNull()
      .references(() => youtubeChannels.id),
    publicSlug: text("public_slug").notNull().unique(),
    marketplaceStatus: creatorMarketplaceStatusEnum("marketplace_status")
      .default("UNCLAIMED")
      .notNull(),
    sellerType: organizationTypeEnum("seller_type").default("INDIVIDUAL").notNull(),
    displayName: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    categories: text("categories").array().default(sql`'{}'::text[]`).notNull(),
    languages: text("languages").array().default(sql`'{}'::text[]`).notNull(),
    regionCodes: text("region_codes").array().default(sql`'{}'::text[]`).notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("creator_profiles_channel_uidx").on(table.youtubeChannelId),
    uniqueIndex("creator_profiles_user_uidx").on(table.userId).where(sql`${table.userId} is not null`),
    index("creator_profiles_marketplace_status_idx").on(table.marketplaceStatus, table.updatedAt),
  ],
);

export const legacyCreatorAliases = pgTable(
  "legacy_creator_aliases",
  {
    id: publicId(),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "restrict" }),
    aliasType: text("alias_type").notNull(),
    aliasValue: text("alias_value").notNull(),
    source: text("source").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legacy_creator_aliases_type_value_uidx").on(table.aliasType, table.aliasValue),
    index("legacy_creator_aliases_creator_idx").on(table.creatorProfileId),
  ],
);

export const legacyCreatorImports = pgTable(
  "legacy_creator_imports",
  {
    id: publicId(),
    source: text("source").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    creatorProfileId: uuid("creator_profile_id").references(() => creatorProfiles.id),
    payloadSha256: text("payload_sha256").notNull(),
    archivedPayload: jsonb("archived_payload").$type<Record<string, unknown>>().notNull(),
    estimatedAdRateKrw: krw("estimated_ad_rate_krw"),
    estimatedCpvKrw: krw("estimated_cpv_krw"),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("legacy_creator_imports_source_record_uidx").on(table.source, table.sourceRecordId),
    uniqueIndex("legacy_creator_imports_payload_hash_uidx").on(table.payloadSha256),
    index("legacy_creator_imports_creator_idx").on(table.creatorProfileId),
  ],
);

export const channelVerifications = pgTable(
  "channel_verifications",
  {
    id: publicId(),
    youtubeChannelId: uuid("youtube_channel_id")
      .notNull()
      .references(() => youtubeChannels.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    method: text("method").notNull(),
    status: verificationStatusEnum("status").default("PENDING").notNull(),
    providerReference: text("provider_reference"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    evidenceHash: text("evidence_hash"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("channel_verifications_active_claim_uidx")
      .on(table.youtubeChannelId)
      .where(sql`${table.status} in ('PENDING', 'REQUIRES_ACTION', 'VERIFIED')`),
    index("channel_verifications_creator_idx").on(table.creatorProfileId, table.status),
    index("channel_verifications_requester_idx").on(table.requestedByUserId),
  ],
);

export const sellerVerifications = pgTable(
  "seller_verifications",
  {
    id: publicId(),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    provider: text("provider").notNull(),
    providerSellerId: text("provider_seller_id"),
    status: verificationStatusEnum("status").default("NOT_STARTED").notNull(),
    sellerType: organizationTypeEnum("seller_type").notNull(),
    identityReference: text("identity_reference"),
    businessReference: text("business_reference"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("seller_verifications_provider_seller_uidx")
      .on(table.provider, table.providerSellerId)
      .where(sql`${table.providerSellerId} is not null`),
    index("seller_verifications_creator_status_idx").on(table.creatorProfileId, table.status),
  ],
);

export const payoutAccounts = pgTable(
  "payout_accounts",
  {
    id: publicId(),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    sellerVerificationId: uuid("seller_verification_id")
      .notNull()
      .references(() => sellerVerifications.id),
    provider: text("provider").notNull(),
    providerAccountToken: text("provider_account_token").notNull(),
    accountHolderReference: text("account_holder_reference"),
    bankCode: text("bank_code"),
    accountLast4: text("account_last4"),
    status: verificationStatusEnum("status").default("PENDING").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payout_accounts_provider_token_uidx").on(table.provider, table.providerAccountToken),
    uniqueIndex("payout_accounts_creator_default_uidx")
      .on(table.creatorProfileId)
      .where(sql`${table.isDefault} and ${table.status} = 'VERIFIED'`),
    index("payout_accounts_verification_idx").on(table.sellerVerificationId),
  ],
);

export const dataProvenance = pgTable(
  "data_provenance",
  {
    id: publicId(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    authorizationBasis: text("authorization_basis").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("data_provenance_entity_idx").on(table.entityType, table.entityId),
    check("data_provenance_confidence_check", sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`),
  ],
);

export const creatorPackages = pgTable(
  "creator_packages",
  {
    id: publicId(),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    publicSlug: text("public_slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    format: text("format").notNull(),
    basePriceKrw: krw("base_price_krw").notNull(),
    includedItems: text("included_items").array().default(sql`'{}'::text[]`).notNull(),
    excludedItems: text("excluded_items").array().default(sql`'{}'::text[]`).notNull(),
    productionDays: integer("production_days").notNull(),
    includedRevisions: integer("included_revisions").default(0).notNull(),
    publicationRetentionDays: integer("publication_retention_days"),
    insertionWindow: text("insertion_window"),
    productShippingRequired: boolean("product_shipping_required").default(false).notNull(),
    defaultLicenseTerms: jsonb("default_license_terms")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    bookingLeadDays: integer("booking_lead_days").default(0).notNull(),
    maxConcurrentOrders: integer("max_concurrent_orders").default(1).notNull(),
    cancellationPolicyVersion: text("cancellation_policy_version").notNull(),
    prohibitedCategories: text("prohibited_categories").array().default(sql`'{}'::text[]`).notNull(),
    autoAcceptEnabled: boolean("auto_accept_enabled").default(false).notNull(),
    status: packageStatusEnum("status").default("DRAFT").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("creator_packages_creator_status_idx").on(table.creatorProfileId, table.status, table.createdAt),
    index("creator_packages_market_search_idx").on(table.status, table.category, table.format, table.basePriceKrw),
    check("creator_packages_price_check", sql`${table.basePriceKrw} >= 0`),
    check("creator_packages_production_days_check", sql`${table.productionDays} > 0`),
    check("creator_packages_revisions_check", sql`${table.includedRevisions} >= 0`),
    check("creator_packages_capacity_check", sql`${table.maxConcurrentOrders} > 0`),
  ],
);

export const packageOptions = pgTable(
  "package_options",
  {
    id: publicId(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => creatorPackages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceDeltaKrw: krw("price_delta_krw").default(sql`0`).notNull(),
    additionalProductionDays: integer("additional_production_days").default(0).notNull(),
    terms: metadata("terms"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("package_options_name_uidx").on(table.packageId, table.name),
    index("package_options_package_idx").on(table.packageId, table.sortOrder),
    check("package_options_price_delta_check", sql`${table.priceDeltaKrw} >= 0`),
    check("package_options_days_check", sql`${table.additionalProductionDays} >= 0`),
  ],
);

export const packageAssets = pgTable(
  "package_assets",
  {
    id: publicId(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => creatorPackages.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    storageObjectKey: text("storage_object_key"),
    externalUrl: text("external_url"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "bigint" }),
    sha256: text("sha256"),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index("package_assets_package_idx").on(table.packageId, table.sortOrder),
    check(
      "package_assets_location_check",
      sql`num_nonnulls(${table.storageObjectKey}, ${table.externalUrl}) = 1`,
    ),
    check("package_assets_size_check", sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`),
  ],
);

export const availabilitySlots = pgTable(
  "availability_slots",
  {
    id: publicId(),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    packageId: uuid("package_id").references(() => creatorPackages.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").default(1).notNull(),
    reservedCount: integer("reserved_count").default(0).notNull(),
    status: text("status").default("AVAILABLE").notNull(),
    ...timestamps,
  },
  (table) => [
    index("availability_slots_creator_window_idx").on(table.creatorProfileId, table.startsAt, table.endsAt),
    index("availability_slots_package_window_idx").on(table.packageId, table.startsAt),
    check("availability_slots_window_check", sql`${table.endsAt} > ${table.startsAt}`),
    check("availability_slots_capacity_check", sql`${table.capacity} > 0 and ${table.reservedCount} >= 0 and ${table.reservedCount} <= ${table.capacity}`),
    check("availability_slots_status_check", sql`${table.status} in ('AVAILABLE', 'BLOCKED', 'FULL', 'CANCELED')`),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: publicId(),
    publicSlug: text("public_slug").notNull().unique(),
    advertiserProfileId: uuid("advertiser_profile_id")
      .notNull()
      .references(() => advertiserProfiles.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    productName: text("product_name").notNull(),
    description: text("description").notNull(),
    objective: text("objective").notNull(),
    category: text("category").notNull(),
    budgetMinKrw: krw("budget_min_krw").notNull(),
    budgetMaxKrw: krw("budget_max_krw").notNull(),
    desiredFormats: text("desired_formats").array().default(sql`'{}'::text[]`).notNull(),
    creatorCriteria: metadata("creator_criteria"),
    brief: metadata("brief"),
    desiredPublicationStart: date("desired_publication_start"),
    desiredPublicationEnd: date("desired_publication_end"),
    applicationDeadline: timestamp("application_deadline", { withTimezone: true }),
    creatorSlots: integer("creator_slots").default(1).notNull(),
    status: campaignStatusEnum("status").default("DRAFT").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("campaigns_owner_status_idx").on(table.advertiserProfileId, table.status, table.createdAt),
    index("campaigns_market_search_idx").on(table.status, table.category, table.applicationDeadline),
    index("campaigns_org_idx").on(table.organizationId),
    index("campaigns_created_by_idx").on(table.createdByUserId),
    check("campaigns_budget_check", sql`${table.budgetMinKrw} >= 0 and ${table.budgetMaxKrw} >= ${table.budgetMinKrw}`),
    check("campaigns_slots_check", sql`${table.creatorSlots} > 0`),
    check(
      "campaigns_publication_window_check",
      sql`${table.desiredPublicationEnd} is null or ${table.desiredPublicationStart} is null or ${table.desiredPublicationEnd} >= ${table.desiredPublicationStart}`,
    ),
  ],
);

export const campaignApplications = pgTable(
  "campaign_applications",
  {
    id: publicId(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    status: text("status").default("SUBMITTED").notNull(),
    coverMessage: text("cover_message"),
    proposedAmountKrw: krw("proposed_amount_krw").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_applications_campaign_creator_uidx").on(table.campaignId, table.creatorProfileId),
    index("campaign_applications_creator_status_idx").on(table.creatorProfileId, table.status),
    check("campaign_applications_amount_check", sql`${table.proposedAmountKrw} >= 0`),
    check("campaign_applications_status_check", sql`${table.status} in ('SUBMITTED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')`),
  ],
);

export const campaignInvitations = pgTable(
  "campaign_invitations",
  {
    id: publicId(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").default("PENDING").notNull(),
    message: text("message"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_invitations_campaign_creator_uidx").on(table.campaignId, table.creatorProfileId),
    index("campaign_invitations_creator_status_idx").on(table.creatorProfileId, table.status),
    index("campaign_invitations_inviter_idx").on(table.invitedByUserId),
    check("campaign_invitations_status_check", sql`${table.status} in ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELED')`),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: publicId(),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    packageId: uuid("package_id").references(() => creatorPackages.id),
    applicationId: uuid("application_id").references(() => campaignApplications.id),
    advertiserProfileId: uuid("advertiser_profile_id")
      .notNull()
      .references(() => advertiserProfiles.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    status: proposalStatusEnum("status").default("DRAFT").notNull(),
    currentVersion: integer("current_version").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("proposals_advertiser_status_idx").on(table.advertiserProfileId, table.status, table.createdAt),
    index("proposals_creator_status_idx").on(table.creatorProfileId, table.status, table.createdAt),
    index("proposals_campaign_idx").on(table.campaignId),
    index("proposals_package_idx").on(table.packageId),
    index("proposals_application_idx").on(table.applicationId),
    index("proposals_created_by_idx").on(table.createdByUserId),
    check("proposals_source_check", sql`num_nonnulls(${table.campaignId}, ${table.packageId}) >= 1`),
    check("proposals_version_check", sql`${table.currentVersion} >= 0`),
  ],
);

export const proposalVersions = pgTable(
  "proposal_versions",
  {
    id: publicId(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id),
    version: integer("version").notNull(),
    supersedesVersionId: uuid("supersedes_version_id").references(
      (): AnyPgColumn => proposalVersions.id,
    ),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    cashCompensationKrw: krw("cash_compensation_krw").notNull(),
    productValueKrw: krw("product_value_krw").default(sql`0`).notNull(),
    terms: jsonb("terms").$type<Record<string, unknown>>().notNull(),
    canonicalSha256: text("canonical_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("proposal_versions_proposal_version_uidx").on(table.proposalId, table.version),
    uniqueIndex("proposal_versions_canonical_hash_uidx").on(table.proposalId, table.canonicalSha256),
    index("proposal_versions_creator_idx").on(table.createdByUserId),
    index("proposal_versions_supersedes_idx").on(table.supersedesVersionId),
    check("proposal_versions_cash_check", sql`${table.cashCompensationKrw} >= 0`),
    check("proposal_versions_product_check", sql`${table.productValueKrw} >= 0`),
    check("proposal_versions_version_check", sql`${table.version} > 0`),
  ],
);

export const proposalAcceptances = pgTable(
  "proposal_acceptances",
  {
    id: publicId(),
    proposalVersionId: uuid("proposal_version_id")
      .notNull()
      .references(() => proposalVersions.id),
    partyType: text("party_type").notNull(),
    acceptedByUserId: uuid("accepted_by_user_id")
      .notNull()
      .references(() => users.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    ipEvidence: text("ip_evidence"),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("proposal_acceptances_version_party_uidx").on(table.proposalVersionId, table.partyType),
    index("proposal_acceptances_user_idx").on(table.acceptedByUserId),
    check("proposal_acceptances_party_check", sql`${table.partyType} in ('BUYER', 'CREATOR')`),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: publicId(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id),
    advertiserProfileId: uuid("advertiser_profile_id")
      .notNull()
      .references(() => advertiserProfiles.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    status: contractStatusEnum("status").default("DRAFT").notNull(),
    currentVersion: integer("current_version").default(0).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    supersededByContractId: uuid("superseded_by_contract_id").references(
      (): AnyPgColumn => contracts.id,
    ),
    ...timestamps,
  },
  (table) => [
    index("contracts_advertiser_status_idx").on(table.advertiserProfileId, table.status),
    index("contracts_creator_status_idx").on(table.creatorProfileId, table.status),
    index("contracts_proposal_idx").on(table.proposalId),
    index("contracts_superseded_by_idx").on(table.supersededByContractId),
    check("contracts_version_check", sql`${table.currentVersion} >= 0`),
  ],
);

export const contractVersions = pgTable(
  "contract_versions",
  {
    id: publicId(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    proposalVersionId: uuid("proposal_version_id")
      .notNull()
      .references(() => proposalVersions.id),
    version: integer("version").notNull(),
    status: text("status").default("DRAFT").notNull(),
    htmlSnapshot: text("html_snapshot").notNull(),
    pdfObjectKey: text("pdf_object_key"),
    canonicalJson: jsonb("canonical_json").$type<Record<string, unknown>>().notNull(),
    canonicalSha256: text("canonical_sha256").notNull(),
    termsVersion: text("terms_version").notNull(),
    feeRuleVersion: text("fee_rule_version").notNull(),
    refundPolicyVersion: text("refund_policy_version").notNull(),
    legalStatus: text("legal_status").default("DRAFT_NEEDS_COUNSEL").notNull(),
    buyerAcceptedAt: timestamp("buyer_accepted_at", { withTimezone: true }),
    creatorAcceptedAt: timestamp("creator_accepted_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("contract_versions_contract_version_uidx").on(table.contractId, table.version),
    uniqueIndex("contract_versions_hash_uidx").on(table.canonicalSha256),
    index("contract_versions_proposal_version_idx").on(table.proposalVersionId),
    check("contract_versions_version_check", sql`${table.version} > 0`),
    check("contract_versions_status_check", sql`${table.status} in ('DRAFT', 'AWAITING_ACCEPTANCE', 'EXECUTED', 'SUPERSEDED', 'VOIDED')`),
    check("contract_versions_legal_check", sql`${table.legalStatus} in ('DRAFT_NEEDS_COUNSEL', 'COUNSEL_APPROVED')`),
  ],
);

export const contractAcceptances = pgTable(
  "contract_acceptances",
  {
    id: publicId(),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id),
    partyType: text("party_type").notNull(),
    acceptedByUserId: uuid("accepted_by_user_id")
      .notNull()
      .references(() => users.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    termsDocumentVersion: text("terms_document_version").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    ipEvidence: text("ip_evidence"),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("contract_acceptances_version_party_uidx").on(table.contractVersionId, table.partyType),
    index("contract_acceptances_user_idx").on(table.acceptedByUserId),
    check("contract_acceptances_party_check", sql`${table.partyType} in ('BUYER', 'CREATOR')`),
  ],
);

export const feeRules = pgTable(
  "fee_rules",
  {
    id: publicId(),
    code: text("code").notNull(),
    version: integer("version").notNull(),
    sellerFeeBps: integer("seller_fee_bps").default(0).notNull(),
    buyerFeeBps: integer("buyer_fee_bps").default(0).notNull(),
    licenseRenewalFeeBps: integer("license_renewal_fee_bps").default(0).notNull(),
    minimumOrderKrw: krw("minimum_order_krw").default(sql`0`).notNull(),
    appliesTo: metadata("applies_to"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("fee_rules_code_version_uidx").on(table.code, table.version),
    index("fee_rules_active_idx").on(table.code, table.effectiveFrom, table.effectiveUntil),
    index("fee_rules_approved_by_idx").on(table.approvedByUserId),
    check("fee_rules_seller_bps_check", sql`${table.sellerFeeBps} between 0 and 10000`),
    check("fee_rules_buyer_bps_check", sql`${table.buyerFeeBps} between 0 and 10000`),
    check("fee_rules_license_bps_check", sql`${table.licenseRenewalFeeBps} between 0 and 10000`),
    check("fee_rules_minimum_check", sql`${table.minimumOrderKrw} >= 0`),
    check("fee_rules_window_check", sql`${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`),
  ],
);

export const feeSnapshots = pgTable(
  "fee_snapshots",
  {
    id: publicId(),
    feeRuleId: uuid("fee_rule_id")
      .notNull()
      .references(() => feeRules.id),
    feeRuleCode: text("fee_rule_code").notNull(),
    feeRuleVersion: integer("fee_rule_version").notNull(),
    sellerFeeBps: integer("seller_fee_bps").notNull(),
    buyerFeeBps: integer("buyer_fee_bps").notNull(),
    grossAmountKrw: krw("gross_amount_krw").notNull(),
    sellerFeeKrw: krw("seller_fee_krw").notNull(),
    buyerFeeKrw: krw("buyer_fee_krw").notNull(),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fee_snapshots_rule_idx").on(table.feeRuleId),
    check("fee_snapshots_bps_check", sql`${table.sellerFeeBps} between 0 and 10000 and ${table.buyerFeeBps} between 0 and 10000`),
    check("fee_snapshots_amounts_check", sql`${table.grossAmountKrw} >= 0 and ${table.sellerFeeKrw} >= 0 and ${table.buyerFeeKrw} >= 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: publicId(),
    orderNumber: text("order_number").notNull().unique(),
    parentOrderId: uuid("parent_order_id").references((): AnyPgColumn => orders.id),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    packageId: uuid("package_id").references(() => creatorPackages.id),
    proposalVersionId: uuid("proposal_version_id")
      .notNull()
      .references(() => proposalVersions.id),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id),
    feeSnapshotId: uuid("fee_snapshot_id")
      .notNull()
      .references(() => feeSnapshots.id),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => users.id),
    buyerOrganizationId: uuid("buyer_organization_id").references(() => organizations.id),
    advertiserProfileId: uuid("advertiser_profile_id")
      .notNull()
      .references(() => advertiserProfiles.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    workflowStatus: orderStatusEnum("workflow_status").default("DRAFT").notNull(),
    currency: text("currency").default("KRW").notNull(),
    grossAmountKrw: krw("gross_amount_krw").notNull(),
    buyerFeeKrw: krw("buyer_fee_krw").default(sql`0`).notNull(),
    buyerTotalKrw: krw("buyer_total_krw").notNull(),
    sellerFeeKrw: krw("seller_fee_krw").default(sql`0`).notNull(),
    sellerTaxWithholdingKrw: krw("seller_tax_withholding_krw").default(sql`0`).notNull(),
    sellerReceivableKrw: krw("seller_receivable_krw").notNull(),
    productValueKrw: krw("product_value_krw").default(sql`0`).notNull(),
    revisionLimit: integer("revision_limit").default(0).notNull(),
    revisionCount: integer("revision_count").default(0).notNull(),
    briefSnapshot: jsonb("brief_snapshot").$type<Record<string, unknown>>().notNull(),
    version: integer("version").default(1).notNull(),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    buyerConfirmedAt: timestamp("buyer_confirmed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("orders_buyer_status_idx").on(table.buyerUserId, table.workflowStatus, table.createdAt),
    index("orders_org_status_idx").on(table.buyerOrganizationId, table.workflowStatus, table.createdAt),
    index("orders_creator_status_idx").on(table.creatorProfileId, table.workflowStatus, table.createdAt),
    index("orders_campaign_idx").on(table.campaignId),
    index("orders_parent_idx").on(table.parentOrderId),
    index("orders_package_idx").on(table.packageId),
    index("orders_proposal_version_idx").on(table.proposalVersionId),
    index("orders_contract_version_idx").on(table.contractVersionId),
    index("orders_fee_snapshot_idx").on(table.feeSnapshotId),
    index("orders_advertiser_profile_idx").on(table.advertiserProfileId),
    uniqueIndex("orders_contract_version_uidx").on(table.contractVersionId),
    check("orders_currency_check", sql`${table.currency} = 'KRW'`),
    check(
      "orders_amounts_nonnegative_check",
      sql`${table.grossAmountKrw} >= 0 and ${table.buyerFeeKrw} >= 0 and ${table.buyerTotalKrw} >= 0 and ${table.sellerFeeKrw} >= 0 and ${table.sellerTaxWithholdingKrw} >= 0 and ${table.sellerReceivableKrw} >= 0 and ${table.productValueKrw} >= 0`,
    ),
    check(
      "orders_buyer_total_check",
      sql`${table.buyerTotalKrw} = ${table.grossAmountKrw} + ${table.buyerFeeKrw}`,
    ),
    check(
      "orders_seller_receivable_check",
      sql`${table.sellerReceivableKrw} = ${table.grossAmountKrw} - ${table.sellerFeeKrw} - ${table.sellerTaxWithholdingKrw}`,
    ),
    check(
      "orders_revision_check",
      sql`${table.revisionLimit} >= 0 and ${table.revisionCount} >= 0 and ${table.revisionCount} <= ${table.revisionLimit}`,
    ),
    check("orders_version_check", sql`${table.version} > 0`),
  ],
);

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    authority: text("authority").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    reasonCode: text("reason_code").notNull(),
    reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    eventMetadata: metadata("event_metadata"),
  },
  (table) => [
    index("order_status_events_order_time_idx").on(table.orderId, table.occurredAt),
    index("order_status_events_actor_idx").on(table.actorUserId),
    check(
      "order_status_events_authority_check",
      sql`${table.authority} in ('WORKFLOW', 'PAYMENT', 'PAYOUT', 'DISPUTE', 'HOLD')`,
    ),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    kind: text("kind").default("ORDER_ROOM").notNull(),
    status: text("status").default("OPEN").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("conversations_order_kind_uidx").on(table.orderId, table.kind),
    index("conversations_created_by_idx").on(table.createdByUserId),
    check("conversations_status_check", sql`${table.status} in ('OPEN', 'LOCKED', 'ARCHIVED')`),
  ],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_members_user_idx").on(table.userId, table.leftAt),
    check("conversation_members_role_check", sql`${table.role} in ('BUYER', 'CREATOR', 'SUPPORT', 'RISK', 'OBSERVER')`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: publicId(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body"),
    messageType: text("message_type").default("TEXT").notNull(),
    structuredPayload: metadata("structured_payload"),
    replyToMessageId: uuid("reply_to_message_id").references((): AnyPgColumn => messages.id),
    clientMessageId: text("client_message_id").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("messages_sender_client_uidx").on(table.senderUserId, table.clientMessageId),
    index("messages_conversation_time_idx").on(table.conversationId, table.createdAt, table.id),
    index("messages_reply_idx").on(table.replyToMessageId),
    check(
      "messages_type_check",
      sql`${table.messageType} in ('TEXT', 'SYSTEM', 'PROPOSAL', 'DELIVERABLE', 'REVISION_REQUEST', 'APPROVAL')`,
    ),
  ],
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    currentVersion: integer("current_version").default(0).notNull(),
    status: text("status").default("PENDING").notNull(),
    required: boolean("required").default(true).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("deliverables_order_status_idx").on(table.orderId, table.status, table.createdAt),
    check(
      "deliverables_type_check",
      sql`${table.type} in ('SCRIPT', 'STORYBOARD', 'THUMBNAIL', 'SHORTS_DRAFT', 'LONGFORM_DRAFT', 'FINAL_VIDEO', 'COMMUNITY_POST', 'PUBLICATION_URL', 'PERFORMANCE_REPORT')`,
    ),
    check(
      "deliverables_status_check",
      sql`${table.status} in ('PENDING', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELED')`,
    ),
    check("deliverables_version_check", sql`${table.currentVersion} >= 0`),
  ],
);

export const deliverableVersions = pgTable(
  "deliverable_versions",
  {
    id: publicId(),
    deliverableId: uuid("deliverable_id")
      .notNull()
      .references(() => deliverables.id),
    version: integer("version").notNull(),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id),
    storageObjectKey: text("storage_object_key"),
    externalUrl: text("external_url"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "bigint" }),
    sha256: text("sha256"),
    status: text("status").default("SUBMITTED").notNull(),
    submissionNote: text("submission_note"),
    feedback: text("feedback"),
    revisionRequest: text("revision_request"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("deliverable_versions_deliverable_version_uidx").on(table.deliverableId, table.version),
    index("deliverable_versions_submitter_idx").on(table.submittedByUserId),
    index("deliverable_versions_reviewer_idx").on(table.reviewedByUserId),
    check("deliverable_versions_version_check", sql`${table.version} > 0`),
    check("deliverable_versions_size_check", sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`),
    check(
      "deliverable_versions_location_check",
      sql`num_nonnulls(${table.storageObjectKey}, ${table.externalUrl}) <= 1`,
    ),
    check(
      "deliverable_versions_status_check",
      sql`${table.status} in ('SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED')`,
    ),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    messageId: uuid("message_id").references(() => messages.id),
    deliverableVersionId: uuid("deliverable_version_id").references(() => deliverableVersions.id),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    storageObjectKey: text("storage_object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    declaredMimeType: text("declared_mime_type").notNull(),
    detectedMimeType: text("detected_mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "bigint" }).notNull(),
    sha256: text("sha256").notNull(),
    malwareScanStatus: text("malware_scan_status").default("PENDING").notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("attachments_storage_key_uidx").on(table.storageObjectKey),
    index("attachments_order_idx").on(table.orderId, table.createdAt),
    index("attachments_message_idx").on(table.messageId),
    index("attachments_deliverable_version_idx").on(table.deliverableVersionId),
    index("attachments_uploader_idx").on(table.uploadedByUserId),
    check("attachments_size_check", sql`${table.sizeBytes} > 0`),
    check(
      "attachments_scan_check",
      sql`${table.malwareScanStatus} in ('PENDING', 'CLEAN', 'QUARANTINED', 'FAILED')`,
    ),
  ],
);

export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    provider: text("provider").notNull(),
    providerPaymentKey: text("provider_payment_key"),
    merchantReference: text("merchant_reference").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: paymentStatusEnum("status").default("CREATED").notNull(),
    amountKrw: krw("amount_krw").notNull(),
    currency: text("currency").default("KRW").notNull(),
    checkoutExpiresAt: timestamp("checkout_expires_at", { withTimezone: true }),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    providerVersion: integer("provider_version").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_intents_provider_key_uidx")
      .on(table.provider, table.providerPaymentKey)
      .where(sql`${table.providerPaymentKey} is not null`),
    uniqueIndex("payment_intents_one_active_per_order_uidx")
      .on(table.orderId)
      .where(sql`${table.status} in ('CREATED', 'READY', 'AUTHORIZED', 'FUNDED', 'PARTIALLY_REFUNDED')`),
    index("payment_intents_order_status_idx").on(table.orderId, table.status, table.createdAt),
    check("payment_intents_amount_check", sql`${table.amountKrw} > 0`),
    check("payment_intents_currency_check", sql`${table.currency} = 'KRW'`),
  ],
);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: publicId(),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id),
    type: text("type").notNull(),
    status: text("status").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    amountKrw: krw("amount_krw").notNull(),
    failureCode: text("failure_code"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    providerMetadata: metadata("provider_metadata"),
  },
  (table) => [
    uniqueIndex("payment_transactions_provider_id_uidx")
      .on(table.providerTransactionId)
      .where(sql`${table.providerTransactionId} is not null`),
    index("payment_transactions_intent_time_idx").on(table.paymentIntentId, table.occurredAt),
    check("payment_transactions_amount_check", sql`${table.amountKrw} > 0`),
    check(
      "payment_transactions_type_check",
      sql`${table.type} in ('AUTHORIZE', 'CAPTURE', 'CANCEL', 'REFUND', 'CHARGEBACK', 'REVERSAL')`,
    ),
    check("payment_transactions_status_check", sql`${table.status} in ('PENDING', 'SUCCEEDED', 'FAILED')`),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: publicId(),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    providerSequence: bigint("provider_sequence", { mode: "bigint" }),
    eventType: text("event_type").notNull(),
    normalizedStatus: paymentStatusEnum("normalized_status").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_events_provider_event_uidx").on(table.provider, table.providerEventId),
    index("payment_events_intent_time_idx").on(table.paymentIntentId, table.occurredAt),
    uniqueIndex("payment_events_intent_sequence_uidx")
      .on(table.paymentIntentId, table.providerSequence)
      .where(sql`${table.providerSequence} is not null`),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
    providerRefundId: text("provider_refund_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    amountKrw: krw("amount_krw").notNull(),
    status: text("status").default("REQUESTED").notNull(),
    reasonCode: text("reason_code").notNull(),
    reason: text("reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("refunds_provider_id_uidx")
      .on(table.providerRefundId)
      .where(sql`${table.providerRefundId} is not null`),
    index("refunds_payment_status_idx").on(table.paymentIntentId, table.status, table.createdAt),
    index("refunds_order_idx").on(table.orderId),
    index("refunds_requested_by_idx").on(table.requestedByUserId),
    check("refunds_amount_check", sql`${table.amountKrw} > 0`),
    check(
      "refunds_status_check",
      sql`${table.status} in ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED')`,
    ),
  ],
);

export const disputes = pgTable(
  "disputes",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    openedByUserId: uuid("opened_by_user_id")
      .notNull()
      .references(() => users.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    reasonCode: text("reason_code").notNull(),
    description: text("description").notNull(),
    status: disputeStatusEnum("status").default("OPEN").notNull(),
    evidenceDueAt: timestamp("evidence_due_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("disputes_one_open_per_order_uidx")
      .on(table.orderId)
      .where(sql`${table.status} in ('OPEN', 'EVIDENCE_COLLECTION', 'UNDER_REVIEW', 'APPEALED')`),
    index("disputes_assignee_status_idx").on(table.assignedToUserId, table.status, table.openedAt),
    index("disputes_opener_idx").on(table.openedByUserId),
  ],
);

export const payoutHolds = pgTable(
  "payout_holds",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    disputeId: uuid("dispute_id").references(() => disputes.id),
    holdType: text("hold_type").notNull(),
    status: holdStatusEnum("status").default("ACTIVE").notNull(),
    reason: text("reason").notNull(),
    placedByUserId: uuid("placed_by_user_id").references(() => users.id),
    releasedByUserId: uuid("released_by_user_id").references(() => users.id),
    placedAt: timestamp("placed_at", { withTimezone: true }).defaultNow().notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releaseReason: text("release_reason"),
  },
  (table) => [
    uniqueIndex("payout_holds_active_type_uidx")
      .on(table.orderId, table.holdType)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("payout_holds_order_status_idx").on(table.orderId, table.status),
    index("payout_holds_dispute_idx").on(table.disputeId),
    index("payout_holds_placed_by_idx").on(table.placedByUserId),
    index("payout_holds_released_by_idx").on(table.releasedByUserId),
    check(
      "payout_holds_type_check",
      sql`${table.holdType} in ('SELLER_VERIFICATION', 'DISPUTE', 'RISK', 'CHARGEBACK', 'RECONCILIATION', 'MANUAL')`,
    ),
    check(
      "payout_holds_release_check",
      sql`(${table.status} = 'ACTIVE' and ${table.releasedAt} is null) or (${table.status} = 'RELEASED' and ${table.releasedAt} is not null and ${table.releaseReason} is not null)`,
    ),
  ],
);

export const payouts = pgTable(
  "payouts",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    payoutAccountId: uuid("payout_account_id")
      .notNull()
      .references(() => payoutAccounts.id),
    provider: text("provider").notNull(),
    providerPayoutId: text("provider_payout_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: payoutStatusEnum("status").default("NOT_READY").notNull(),
    amountKrw: krw("amount_krw").notNull(),
    currency: text("currency").default("KRW").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    providerVersion: integer("provider_version").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payouts_provider_id_uidx")
      .on(table.provider, table.providerPayoutId)
      .where(sql`${table.providerPayoutId} is not null`),
    uniqueIndex("payouts_one_paid_per_order_uidx")
      .on(table.orderId)
      .where(sql`${table.status} = 'PAID'`),
    uniqueIndex("payouts_one_active_per_order_uidx")
      .on(table.orderId)
      .where(sql`${table.status} in ('READY', 'SCHEDULED', 'PROCESSING')`),
    index("payouts_creator_status_idx").on(table.creatorProfileId, table.status, table.createdAt),
    index("payouts_account_idx").on(table.payoutAccountId),
    check("payouts_amount_check", sql`${table.amountKrw} > 0`),
    check("payouts_currency_check", sql`${table.currency} = 'KRW'`),
  ],
);

export const payoutEvents = pgTable(
  "payout_events",
  {
    id: publicId(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payouts.id),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    providerSequence: bigint("provider_sequence", { mode: "bigint" }),
    eventType: text("event_type").notNull(),
    normalizedStatus: payoutStatusEnum("normalized_status").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payout_events_provider_event_uidx").on(table.provider, table.providerEventId),
    uniqueIndex("payout_events_payout_sequence_uidx")
      .on(table.payoutId, table.providerSequence)
      .where(sql`${table.providerSequence} is not null`),
    index("payout_events_payout_time_idx").on(table.payoutId, table.occurredAt),
  ],
);

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: publicId(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    accountType: text("account_type").notNull(),
    normalBalance: text("normal_balance").notNull(),
    currency: text("currency").default("KRW").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    creatorProfileId: uuid("creator_profile_id").references(() => creatorProfiles.id),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ledger_accounts_order_idx").on(table.orderId),
    index("ledger_accounts_org_idx").on(table.organizationId),
    index("ledger_accounts_creator_idx").on(table.creatorProfileId),
    check(
      "ledger_accounts_type_check",
      sql`${table.accountType} in ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')`,
    ),
    check("ledger_accounts_balance_check", sql`${table.normalBalance} in ('DEBIT', 'CREDIT')`),
    check("ledger_accounts_currency_check", sql`${table.currency} = 'KRW'`),
  ],
);

export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: publicId(),
    referenceType: text("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    status: ledgerTransactionStatusEnum("status").default("DRAFT").notNull(),
    description: text("description").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ledger_transactions_reference_idx").on(table.referenceType, table.referenceId),
    index("ledger_transactions_order_time_idx").on(table.orderId, table.effectiveAt),
    index("ledger_transactions_posted_time_idx").on(table.status, table.postedAt),
    index("ledger_transactions_created_by_idx").on(table.createdByUserId),
    check(
      "ledger_transactions_posted_at_check",
      sql`(${table.status} = 'DRAFT' and ${table.postedAt} is null) or (${table.status} = 'POSTED' and ${table.postedAt} is not null)`,
    ),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: publicId(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id),
    lineNumber: integer("line_number").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    debitKrw: krw("debit_krw").default(sql`0`).notNull(),
    creditKrw: krw("credit_krw").default(sql`0`).notNull(),
    currency: text("currency").default("KRW").notNull(),
    memo: text("memo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ledger_entries_transaction_line_uidx").on(table.transactionId, table.lineNumber),
    index("ledger_entries_account_time_idx").on(table.accountId, table.createdAt),
    check(
      "ledger_entries_one_sided_check",
      sql`(${table.debitKrw} > 0 and ${table.creditKrw} = 0) or (${table.creditKrw} > 0 and ${table.debitKrw} = 0)`,
    ),
    check("ledger_entries_currency_check", sql`${table.currency} = 'KRW'`),
    check("ledger_entries_line_check", sql`${table.lineNumber} > 0`),
  ],
);

export const reconciliationRuns = pgTable(
  "reconciliation_runs",
  {
    id: publicId(),
    provider: text("provider").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: text("status").default("RUNNING").notNull(),
    expectedAmountKrw: krw("expected_amount_krw").default(sql`0`).notNull(),
    actualAmountKrw: krw("actual_amount_krw").default(sql`0`).notNull(),
    discrepancyAmountKrw: krw("discrepancy_amount_krw").default(sql`0`).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolutionNote: text("resolution_note"),
  },
  (table) => [
    uniqueIndex("reconciliation_runs_provider_period_uidx").on(table.provider, table.periodStart, table.periodEnd),
    index("reconciliation_runs_status_idx").on(table.status, table.startedAt),
    index("reconciliation_runs_resolved_by_idx").on(table.resolvedByUserId),
    check("reconciliation_runs_window_check", sql`${table.periodEnd} > ${table.periodStart}`),
    check(
      "reconciliation_runs_status_check",
      sql`${table.status} in ('RUNNING', 'MATCHED', 'MISMATCH', 'RESOLVED', 'FAILED')`,
    ),
    check(
      "reconciliation_runs_discrepancy_check",
      sql`${table.discrepancyAmountKrw} = ${table.actualAmountKrw} - ${table.expectedAmountKrw}`,
    ),
  ],
);

export const reconciliationItems = pgTable(
  "reconciliation_items",
  {
    id: publicId(),
    reconciliationRunId: uuid("reconciliation_run_id")
      .notNull()
      .references(() => reconciliationRuns.id),
    orderId: uuid("order_id").references(() => orders.id),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id").notNull(),
    expectedAmountKrw: krw("expected_amount_krw").notNull(),
    actualAmountKrw: krw("actual_amount_krw").notNull(),
    status: text("status").notNull(),
    detail: metadata("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("reconciliation_items_reference_uidx").on(
      table.reconciliationRunId,
      table.referenceType,
      table.referenceId,
    ),
    index("reconciliation_items_order_status_idx").on(table.orderId, table.status),
    check("reconciliation_items_status_check", sql`${table.status} in ('MATCHED', 'MISSING_PROVIDER', 'MISSING_LEDGER', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'RESOLVED')`),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: publicId(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    signatureVerified: boolean("signature_verified").default(false).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").default("RECEIVED").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    redactedPayload: metadata("redacted_payload"),
  },
  (table) => [
    uniqueIndex("webhook_events_provider_event_uidx").on(table.provider, table.providerEventId),
    index("webhook_events_work_queue_idx")
      .on(table.status, table.nextAttemptAt, table.receivedAt)
      .where(sql`${table.status} in ('RECEIVED', 'RETRY')`),
    check("webhook_events_attempts_check", sql`${table.attemptCount} >= 0`),
    check(
      "webhook_events_status_check",
      sql`${table.status} in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'RETRY', 'DEAD_LETTER')`,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: publicId(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status").default("PENDING").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("outbox_events_queue_idx")
      .on(table.status, table.availableAt, table.createdAt)
      .where(sql`${table.status} in ('PENDING', 'RETRY')`),
    index("outbox_events_aggregate_idx").on(table.aggregateType, table.aggregateId),
    check("outbox_events_attempts_check", sql`${table.attemptCount} >= 0`),
    check(
      "outbox_events_status_check",
      sql`${table.status} in ('PENDING', 'PROCESSING', 'PUBLISHED', 'RETRY', 'DEAD_LETTER')`,
    ),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: publicId(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    requestSha256: text("request_sha256").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    status: text("status").default("IN_PROGRESS").notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idempotency_keys_scope_key_uidx").on(table.scope, table.key),
    index("idempotency_keys_expiry_idx").on(table.expiresAt),
    index("idempotency_keys_actor_idx").on(table.actorUserId),
    check(
      "idempotency_keys_status_check",
      sql`${table.status} in ('IN_PROGRESS', 'COMPLETED', 'FAILED')`,
    ),
  ],
);

export const disputeEvidence = pgTable(
  "dispute_evidence",
  {
    id: publicId(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id),
    evidenceType: text("evidence_type").notNull(),
    description: text("description").notNull(),
    attachmentId: uuid("attachment_id").references(() => attachments.id),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    snapshotSha256: text("snapshot_sha256").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("dispute_evidence_dispute_time_idx").on(table.disputeId, table.submittedAt),
    index("dispute_evidence_submitter_idx").on(table.submittedByUserId),
    index("dispute_evidence_attachment_idx").on(table.attachmentId),
  ],
);

export const disputeDecisions = pgTable(
  "dispute_decisions",
  {
    id: publicId(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id),
    version: integer("version").notNull(),
    decidedByUserId: uuid("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    outcome: text("outcome").notNull(),
    buyerRefundKrw: krw("buyer_refund_krw").default(sql`0`).notNull(),
    sellerReleaseKrw: krw("seller_release_krw").default(sql`0`).notNull(),
    rationale: text("rationale").notNull(),
    evidenceSummary: text("evidence_summary").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("dispute_decisions_dispute_version_uidx").on(table.disputeId, table.version),
    index("dispute_decisions_decider_idx").on(table.decidedByUserId),
    check("dispute_decisions_version_check", sql`${table.version} > 0`),
    check("dispute_decisions_amounts_check", sql`${table.buyerRefundKrw} >= 0 and ${table.sellerReleaseKrw} >= 0`),
    check(
      "dispute_decisions_outcome_check",
      sql`${table.outcome} in ('FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_SELLER', 'SPLIT', 'NO_ACTION')`,
    ),
  ],
);

export const licenses = pgTable(
  "licenses",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    sourceContractVersionId: uuid("source_contract_version_id")
      .notNull()
      .references(() => contractVersions.id),
    advertiserProfileId: uuid("advertiser_profile_id")
      .notNull()
      .references(() => advertiserProfiles.id),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id),
    organicPublish: boolean("organic_publish").default(true).notNull(),
    brandRepost: boolean("brand_repost").default(false).notNull(),
    paidMedia: boolean("paid_media").default(false).notNull(),
    whitelisting: boolean("whitelisting").default(false).notNull(),
    editingAllowed: boolean("editing_allowed").default(false).notNull(),
    subtitleAllowed: boolean("subtitle_allowed").default(false).notNull(),
    cropAllowed: boolean("crop_allowed").default(false).notNull(),
    territory: text("territory").array().default(sql`'{}'::text[]`).notNull(),
    platforms: text("platforms").array().default(sql`'{YOUTUBE}'::text[]`).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    perpetual: boolean("perpetual").default(false).notNull(),
    exclusivityCategory: text("exclusivity_category"),
    exclusivityDays: integer("exclusivity_days").default(0).notNull(),
    renewalPriceKrw: krw("renewal_price_krw"),
    renewalTerms: metadata("renewal_terms"),
    status: text("status").default("ACTIVE").notNull(),
    ...timestamps,
  },
  (table) => [
    index("licenses_order_idx").on(table.orderId),
    index("licenses_expiry_idx").on(table.status, table.endsAt),
    index("licenses_advertiser_idx").on(table.advertiserProfileId),
    index("licenses_creator_idx").on(table.creatorProfileId),
    index("licenses_source_contract_version_idx").on(table.sourceContractVersionId),
    check(
      "licenses_period_check",
      sql`(${table.perpetual} and ${table.endsAt} is null) or (not ${table.perpetual} and ${table.endsAt} is not null and ${table.endsAt} > ${table.startsAt})`,
    ),
    check("licenses_exclusivity_check", sql`${table.exclusivityDays} >= 0`),
    check("licenses_renewal_price_check", sql`${table.renewalPriceKrw} is null or ${table.renewalPriceKrw} >= 0`),
    check("licenses_status_check", sql`${table.status} in ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED', 'SUPERSEDED')`),
  ],
);

export const licenseRenewals = pgTable(
  "license_renewals",
  {
    id: publicId(),
    licenseId: uuid("license_id")
      .notNull()
      .references(() => licenses.id),
    proposalVersionId: uuid("proposal_version_id").references(() => proposalVersions.id),
    paymentIntentId: uuid("payment_intent_id").references(() => paymentIntents.id),
    renewedLicenseId: uuid("renewed_license_id").references((): AnyPgColumn => licenses.id),
    status: text("status").default("PROPOSED").notNull(),
    renewalAmountKrw: krw("renewal_amount_krw").notNull(),
    platformFeeKrw: krw("platform_fee_krw").notNull(),
    proposedStartAt: timestamp("proposed_start_at", { withTimezone: true }).notNull(),
    proposedEndAt: timestamp("proposed_end_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("license_renewals_license_status_idx").on(table.licenseId, table.status),
    index("license_renewals_payment_idx").on(table.paymentIntentId),
    index("license_renewals_proposal_version_idx").on(table.proposalVersionId),
    index("license_renewals_renewed_license_idx").on(table.renewedLicenseId),
    check("license_renewals_amounts_check", sql`${table.renewalAmountKrw} > 0 and ${table.platformFeeKrw} >= 0`),
    check(
      "license_renewals_status_check",
      sql`${table.status} in ('PROPOSED', 'ACCEPTED', 'PAYMENT_PENDING', 'PAID', 'ACTIVE', 'DECLINED', 'CANCELED', 'EXPIRED')`,
    ),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: publicId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    subjectUserId: uuid("subject_user_id")
      .notNull()
      .references(() => users.id),
    direction: text("direction").notNull(),
    ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),
    overallRating: integer("overall_rating").notNull(),
    body: text("body"),
    status: text("status").default("SEALED").notNull(),
    revealAt: timestamp("reveal_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderationReason: text("moderation_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reviews_order_author_uidx").on(table.orderId, table.authorUserId),
    index("reviews_subject_status_idx").on(table.subjectUserId, table.status, table.publishedAt),
    index("reviews_author_idx").on(table.authorUserId),
    check("reviews_parties_check", sql`${table.authorUserId} <> ${table.subjectUserId}`),
    check("reviews_rating_check", sql`${table.overallRating} between 1 and 5`),
    check("reviews_direction_check", sql`${table.direction} in ('BUYER_TO_CREATOR', 'CREATOR_TO_BUYER')`),
    check("reviews_status_check", sql`${table.status} in ('SEALED', 'PUBLISHED', 'REPORTED', 'RESTRICTED', 'REMOVED')`),
  ],
);

export const reviewReports = pgTable(
  "review_reports",
  {
    id: publicId(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id),
    reportedByUserId: uuid("reported_by_user_id")
      .notNull()
      .references(() => users.id),
    reasonCode: text("reason_code").notNull(),
    detail: text("detail"),
    status: text("status").default("OPEN").notNull(),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("review_reports_open_reporter_uidx")
      .on(table.reviewId, table.reportedByUserId)
      .where(sql`${table.status} = 'OPEN'`),
    index("review_reports_status_idx").on(table.status, table.createdAt),
    index("review_reports_reported_by_idx").on(table.reportedByUserId),
    index("review_reports_resolved_by_idx").on(table.resolvedByUserId),
    check("review_reports_status_check", sql`${table.status} in ('OPEN', 'UPHELD', 'REJECTED', 'WITHDRAWN')`),
  ],
);

export const reviewAppeals = pgTable(
  "review_appeals",
  {
    id: publicId(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id),
    appealedByUserId: uuid("appealed_by_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: text("status").default("OPEN").notNull(),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
    decisionReason: text("decision_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("review_appeals_open_user_uidx")
      .on(table.reviewId, table.appealedByUserId)
      .where(sql`${table.status} = 'OPEN'`),
    index("review_appeals_status_idx").on(table.status, table.createdAt),
    index("review_appeals_appealed_by_idx").on(table.appealedByUserId),
    index("review_appeals_decided_by_idx").on(table.decidedByUserId),
    check("review_appeals_status_check", sql`${table.status} in ('OPEN', 'UPHELD', 'REJECTED', 'WITHDRAWN')`),
  ],
);

export const riskFlags = pgTable(
  "risk_flags",
  {
    id: publicId(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    ruleCode: text("rule_code").notNull(),
    severity: text("severity").notNull(),
    status: text("status").default("OPEN").notNull(),
    evidence: metadata("evidence"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolutionReason: text("resolution_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("risk_flags_open_rule_uidx")
      .on(table.entityType, table.entityId, table.ruleCode)
      .where(sql`${table.status} = 'OPEN'`),
    index("risk_flags_order_status_idx").on(table.orderId, table.status),
    index("risk_flags_assignee_idx").on(table.assignedToUserId, table.status),
    index("risk_flags_resolved_by_idx").on(table.resolvedByUserId),
    check("risk_flags_severity_check", sql`${table.severity} in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`),
    check("risk_flags_status_check", sql`${table.status} in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE')`),
  ],
);

export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: publicId(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    reasonCode: text("reason_code").notNull(),
    status: text("status").default("OPEN").notNull(),
    openedByUserId: uuid("opened_by_user_id").references(() => users.id),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    decision: text("decision"),
    decisionReason: text("decision_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    index("moderation_cases_status_idx").on(table.status, table.createdAt),
    index("moderation_cases_entity_idx").on(table.entityType, table.entityId),
    index("moderation_cases_assignee_idx").on(table.assignedToUserId),
    index("moderation_cases_opened_by_idx").on(table.openedByUserId),
    check("moderation_cases_status_check", sql`${table.status} in ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED', 'APPEALED')`),
  ],
);

export const termsDocuments = pgTable(
  "terms_documents",
  {
    id: publicId(),
    documentType: text("document_type").notNull(),
    version: text("version").notNull(),
    locale: text("locale").default("ko-KR").notNull(),
    title: text("title").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    contentSha256: text("content_sha256").notNull(),
    legalStatus: text("legal_status").default("DRAFT_NEEDS_COUNSEL").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("terms_documents_type_version_locale_uidx").on(table.documentType, table.version, table.locale),
    uniqueIndex("terms_documents_hash_uidx").on(table.contentSha256),
    index("terms_documents_effective_idx").on(table.documentType, table.effectiveAt),
    check("terms_documents_legal_check", sql`${table.legalStatus} in ('DRAFT_NEEDS_COUNSEL', 'COUNSEL_APPROVED', 'RETIRED')`),
  ],
);

export const termsAcceptances = pgTable(
  "terms_acceptances",
  {
    id: publicId(),
    termsDocumentId: uuid("terms_document_id")
      .notNull()
      .references(() => termsDocuments.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    acceptanceContext: text("acceptance_context").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("terms_acceptances_document_user_context_uidx").on(
      table.termsDocumentId,
      table.userId,
      table.acceptanceContext,
    ),
    index("terms_acceptances_user_idx").on(table.userId, table.acceptedAt),
    index("terms_acceptances_org_idx").on(table.organizationId),
  ],
);

export const consents = pgTable(
  "consents",
  {
    id: publicId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    consentType: text("consent_type").notNull(),
    version: text("version").notNull(),
    granted: boolean("granted").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("consents_user_type_time_idx").on(table.userId, table.consentType, table.recordedAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: publicId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    channel: text("channel").notNull(),
    templateVersion: text("template_version").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    status: text("status").default("PENDING").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_user_dedupe_uidx").on(table.userId, table.deduplicationKey),
    index("notifications_user_status_idx").on(table.userId, table.status, table.createdAt),
    index("notifications_dispatch_idx")
      .on(table.status, table.scheduledAt)
      .where(sql`${table.status} in ('PENDING', 'RETRY')`),
    check("notifications_channel_check", sql`${table.channel} in ('IN_APP', 'EMAIL', 'SMS', 'PUSH')`),
    check("notifications_status_check", sql`${table.status} in ('PENDING', 'SENT', 'FAILED', 'RETRY', 'CANCELED')`),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationType: text("notification_type").notNull(),
    channel: text("channel").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    quietHours: metadata("quiet_hours"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.notificationType, table.channel] }),
    check("notification_preferences_channel_check", sql`${table.channel} in ('IN_APP', 'EMAIL', 'SMS', 'PUSH')`),
  ],
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: publicId(),
    key: text("key").notNull(),
    environment: text("environment").default("all").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    value: jsonb("value").$type<Record<string, unknown> | boolean | number | string | null>(),
    description: text("description").notNull(),
    requiresExternalApproval: boolean("requires_external_approval").default(false).notNull(),
    approvalReference: text("approval_reference"),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("feature_flags_key_environment_uidx").on(table.key, table.environment),
    index("feature_flags_enabled_idx").on(table.environment, table.enabled),
    index("feature_flags_updated_by_idx").on(table.updatedByUserId),
    check(
      "feature_flags_approval_check",
      sql`not (${table.enabled} and ${table.requiresExternalApproval}) or ${table.approvalReference} is not null`,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: publicId(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorRole: text("actor_role"),
    organizationId: uuid("organization_id").references(() => organizations.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    requestId: text("request_id").notNull(),
    idempotencyKey: text("idempotency_key"),
    beforeRedacted: jsonb("before_redacted").$type<Record<string, unknown>>(),
    afterRedacted: jsonb("after_redacted").$type<Record<string, unknown>>(),
    evidenceHash: text("evidence_hash").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_target_time_idx").on(table.targetType, table.targetId, table.occurredAt),
    index("audit_logs_actor_time_idx").on(table.actorUserId, table.occurredAt),
    index("audit_logs_org_time_idx").on(table.organizationId, table.occurredAt),
    uniqueIndex("audit_logs_idempotency_uidx")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: publicId(),
    eventName: text("event_name").notNull(),
    userId: uuid("user_id").references(() => users.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    anonymousId: text("anonymous_id"),
    sessionId: text("session_id"),
    properties: metadata("properties"),
    source: text("source").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("analytics_events_name_time_idx").on(table.eventName, table.occurredAt),
    index("analytics_events_user_time_idx").on(table.userId, table.occurredAt),
    index("analytics_events_org_time_idx").on(table.organizationId, table.occurredAt),
    check(
      "analytics_events_identity_check",
      sql`num_nonnulls(${table.userId}, ${table.anonymousId}) >= 1`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type CreatorPackage = typeof creatorPackages.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
