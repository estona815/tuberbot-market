CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'PAUSED', 'CLOSED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('DRAFT', 'AWAITING_ACCEPTANCE', 'EXECUTED', 'SUPERSEDED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."creator_marketplace_status" AS ENUM('DISCOVERY_ONLY', 'UNCLAIMED', 'CLAIM_PENDING', 'CHANNEL_VERIFIED', 'SELLER_VERIFICATION_PENDING', 'PAYOUT_READY', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'EVIDENCE_COLLECTION', 'UNDER_REVIEW', 'RESOLVED', 'APPEALED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('ACTIVE', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_status" AS ENUM('DRAFT', 'POSTED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'NEGOTIATING', 'AWAITING_PARTY_ACCEPTANCE', 'AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'FUNDED', 'BRIEF_CONFIRMATION_PENDING', 'IN_PRODUCTION', 'DRAFT_SUBMITTED', 'REVISION_REQUESTED', 'FINAL_APPROVAL_PENDING', 'SCHEDULED_FOR_PUBLICATION', 'PUBLISHED', 'BUYER_CONFIRMATION_PENDING', 'PAYOUT_BLOCKED', 'PAYOUT_SCHEDULED', 'PAYOUT_PROCESSING', 'COMPLETED', 'CANCELLATION_REQUESTED', 'CANCELED', 'DISPUTED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK', 'PAYOUT_FAILED');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATION', 'AGENCY');--> statement-breakpoint
CREATE TYPE "public"."package_status" AS ENUM('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'PAUSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('CREATED', 'READY', 'AUTHORIZED', 'FUNDED', 'FAILED', 'CANCELED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('NOT_READY', 'BLOCKED_VERIFICATION', 'BLOCKED_DISPUTE', 'READY', 'SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('DRAFT', 'SENT', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CREATOR', 'ADVERTISER', 'AGENCY', 'ADMIN', 'SUPPORT', 'FINANCE', 'RISK', 'MODERATOR');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('NOT_STARTED', 'PENDING', 'REQUIRES_ACTION', 'VERIFIED', 'REJECTED', 'EXPIRED', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "advertiser_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"public_name" text NOT NULL,
	"business_type" "organization_type" NOT NULL,
	"verification_status" "verification_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advertiser_profiles_owner_check" CHECK (num_nonnulls("advertiser_profiles"."user_id", "advertiser_profiles"."organization_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"anonymous_id" text,
	"session_id" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_events_identity_check" CHECK (num_nonnulls("analytics_events"."user_id", "analytics_events"."anonymous_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"message_id" uuid,
	"deliverable_version_id" uuid,
	"uploaded_by_user_id" uuid NOT NULL,
	"storage_object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"declared_mime_type" text NOT NULL,
	"detected_mime_type" text,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"malware_scan_status" text DEFAULT 'PENDING' NOT NULL,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_size_check" CHECK ("attachments"."size_bytes" > 0),
	CONSTRAINT "attachments_scan_check" CHECK ("attachments"."malware_scan_status" in ('PENDING', 'CLEAN', 'QUARANTINED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"organization_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"request_id" text NOT NULL,
	"idempotency_key" text,
	"before_redacted" jsonb,
	"after_redacted" jsonb,
	"evidence_hash" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"package_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"reserved_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_slots_window_check" CHECK ("availability_slots"."ends_at" > "availability_slots"."starts_at"),
	CONSTRAINT "availability_slots_capacity_check" CHECK ("availability_slots"."capacity" > 0 and "availability_slots"."reserved_count" >= 0 and "availability_slots"."reserved_count" <= "availability_slots"."capacity"),
	CONSTRAINT "availability_slots_status_check" CHECK ("availability_slots"."status" in ('AVAILABLE', 'BLOCKED', 'FULL', 'CANCELED'))
);
--> statement-breakpoint
CREATE TABLE "campaign_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"cover_message" text,
	"proposed_amount_krw" bigint NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_applications_amount_check" CHECK ("campaign_applications"."proposed_amount_krw" >= 0),
	CONSTRAINT "campaign_applications_status_check" CHECK ("campaign_applications"."status" in ('SUBMITTED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'))
);
--> statement-breakpoint
CREATE TABLE "campaign_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"expires_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_invitations_status_check" CHECK ("campaign_invitations"."status" in ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELED'))
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_slug" text NOT NULL,
	"advertiser_profile_id" uuid NOT NULL,
	"organization_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"product_name" text NOT NULL,
	"description" text NOT NULL,
	"objective" text NOT NULL,
	"category" text NOT NULL,
	"budget_min_krw" bigint NOT NULL,
	"budget_max_krw" bigint NOT NULL,
	"desired_formats" text[] DEFAULT '{}'::text[] NOT NULL,
	"creator_criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"desired_publication_start" date,
	"desired_publication_end" date,
	"application_deadline" timestamp with time zone,
	"creator_slots" integer DEFAULT 1 NOT NULL,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_public_slug_unique" UNIQUE("public_slug"),
	CONSTRAINT "campaigns_budget_check" CHECK ("campaigns"."budget_min_krw" >= 0 and "campaigns"."budget_max_krw" >= "campaigns"."budget_min_krw"),
	CONSTRAINT "campaigns_slots_check" CHECK ("campaigns"."creator_slots" > 0),
	CONSTRAINT "campaigns_publication_window_check" CHECK ("campaigns"."desired_publication_end" is null or "campaigns"."desired_publication_start" is null or "campaigns"."desired_publication_end" >= "campaigns"."desired_publication_start")
);
--> statement-breakpoint
CREATE TABLE "channel_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"provider_reference" text,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"evidence_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consent_type" text NOT NULL,
	"version" text NOT NULL,
	"granted" boolean NOT NULL,
	"evidence_hash" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contract_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_version_id" uuid NOT NULL,
	"party_type" text NOT NULL,
	"accepted_by_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"terms_document_version" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"ip_evidence" text,
	"user_agent" text,
	CONSTRAINT "contract_acceptances_party_check" CHECK ("contract_acceptances"."party_type" in ('BUYER', 'CREATOR'))
);
--> statement-breakpoint
CREATE TABLE "contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"proposal_version_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"html_snapshot" text NOT NULL,
	"pdf_object_key" text,
	"canonical_json" jsonb NOT NULL,
	"canonical_sha256" text NOT NULL,
	"terms_version" text NOT NULL,
	"fee_rule_version" text NOT NULL,
	"refund_policy_version" text NOT NULL,
	"legal_status" text DEFAULT 'DRAFT_NEEDS_COUNSEL' NOT NULL,
	"buyer_accepted_at" timestamp with time zone,
	"creator_accepted_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_versions_version_check" CHECK ("contract_versions"."version" > 0),
	CONSTRAINT "contract_versions_status_check" CHECK ("contract_versions"."status" in ('DRAFT', 'AWAITING_ACCEPTANCE', 'EXECUTED', 'SUPERSEDED', 'VOIDED')),
	CONSTRAINT "contract_versions_legal_check" CHECK ("contract_versions"."legal_status" in ('DRAFT_NEEDS_COUNSEL', 'COUNSEL_APPROVED'))
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"advertiser_profile_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"status" "contract_status" DEFAULT 'DRAFT' NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"executed_at" timestamp with time zone,
	"superseded_by_contract_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_version_check" CHECK ("contracts"."current_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id"),
	CONSTRAINT "conversation_members_role_check" CHECK ("conversation_members"."role" in ('BUYER', 'CREATOR', 'SUPPORT', 'RISK', 'OBSERVER'))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text DEFAULT 'ORDER_ROOM' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_status_check" CHECK ("conversations"."status" in ('OPEN', 'LOCKED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "creator_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"public_slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"format" text NOT NULL,
	"base_price_krw" bigint NOT NULL,
	"included_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"excluded_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"production_days" integer NOT NULL,
	"included_revisions" integer DEFAULT 0 NOT NULL,
	"publication_retention_days" integer,
	"insertion_window" text,
	"product_shipping_required" boolean DEFAULT false NOT NULL,
	"default_license_terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"booking_lead_days" integer DEFAULT 0 NOT NULL,
	"max_concurrent_orders" integer DEFAULT 1 NOT NULL,
	"cancellation_policy_version" text NOT NULL,
	"prohibited_categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"auto_accept_enabled" boolean DEFAULT false NOT NULL,
	"status" "package_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_packages_public_slug_unique" UNIQUE("public_slug"),
	CONSTRAINT "creator_packages_price_check" CHECK ("creator_packages"."base_price_krw" >= 0),
	CONSTRAINT "creator_packages_production_days_check" CHECK ("creator_packages"."production_days" > 0),
	CONSTRAINT "creator_packages_revisions_check" CHECK ("creator_packages"."included_revisions" >= 0),
	CONSTRAINT "creator_packages_capacity_check" CHECK ("creator_packages"."max_concurrent_orders" > 0)
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"youtube_channel_id" uuid NOT NULL,
	"public_slug" text NOT NULL,
	"marketplace_status" "creator_marketplace_status" DEFAULT 'UNCLAIMED' NOT NULL,
	"seller_type" "organization_type" DEFAULT 'INDIVIDUAL' NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"region_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "data_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"authorization_basis" text NOT NULL,
	"confidence" numeric(4, 3),
	"observed_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_provenance_confidence_check" CHECK ("data_provenance"."confidence" is null or ("data_provenance"."confidence" >= 0 and "data_provenance"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "deliverable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"storage_object_key" text,
	"external_url" text,
	"mime_type" text,
	"size_bytes" bigint,
	"sha256" text,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"submission_note" text,
	"feedback" text,
	"revision_request" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliverable_versions_version_check" CHECK ("deliverable_versions"."version" > 0),
	CONSTRAINT "deliverable_versions_size_check" CHECK ("deliverable_versions"."size_bytes" is null or "deliverable_versions"."size_bytes" >= 0),
	CONSTRAINT "deliverable_versions_location_check" CHECK (num_nonnulls("deliverable_versions"."storage_object_key", "deliverable_versions"."external_url") <= 1),
	CONSTRAINT "deliverable_versions_status_check" CHECK ("deliverable_versions"."status" in ('SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"due_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliverables_type_check" CHECK ("deliverables"."type" in ('SCRIPT', 'STORYBOARD', 'THUMBNAIL', 'SHORTS_DRAFT', 'LONGFORM_DRAFT', 'FINAL_VIDEO', 'COMMUNITY_POST', 'PUBLICATION_URL', 'PERFORMANCE_REPORT')),
	CONSTRAINT "deliverables_status_check" CHECK ("deliverables"."status" in ('PENDING', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELED')),
	CONSTRAINT "deliverables_version_check" CHECK ("deliverables"."current_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dispute_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"buyer_refund_krw" bigint DEFAULT 0 NOT NULL,
	"seller_release_krw" bigint DEFAULT 0 NOT NULL,
	"rationale" text NOT NULL,
	"evidence_summary" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_decisions_version_check" CHECK ("dispute_decisions"."version" > 0),
	CONSTRAINT "dispute_decisions_amounts_check" CHECK ("dispute_decisions"."buyer_refund_krw" >= 0 and "dispute_decisions"."seller_release_krw" >= 0),
	CONSTRAINT "dispute_decisions_outcome_check" CHECK ("dispute_decisions"."outcome" in ('FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_SELLER', 'SPLIT', 'NO_ACTION'))
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"evidence_type" text NOT NULL,
	"description" text NOT NULL,
	"attachment_id" uuid,
	"snapshot" jsonb,
	"snapshot_sha256" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"reason_code" text NOT NULL,
	"description" text NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"evidence_due_at" timestamp with time zone,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"environment" text DEFAULT 'all' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"value" jsonb,
	"description" text NOT NULL,
	"requires_external_approval" boolean DEFAULT false NOT NULL,
	"approval_reference" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_approval_check" CHECK (not ("feature_flags"."enabled" and "feature_flags"."requires_external_approval") or "feature_flags"."approval_reference" is not null)
);
--> statement-breakpoint
CREATE TABLE "fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"version" integer NOT NULL,
	"seller_fee_bps" integer DEFAULT 0 NOT NULL,
	"buyer_fee_bps" integer DEFAULT 0 NOT NULL,
	"license_renewal_fee_bps" integer DEFAULT 0 NOT NULL,
	"minimum_order_krw" bigint DEFAULT 0 NOT NULL,
	"applies_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_rules_seller_bps_check" CHECK ("fee_rules"."seller_fee_bps" between 0 and 10000),
	CONSTRAINT "fee_rules_buyer_bps_check" CHECK ("fee_rules"."buyer_fee_bps" between 0 and 10000),
	CONSTRAINT "fee_rules_license_bps_check" CHECK ("fee_rules"."license_renewal_fee_bps" between 0 and 10000),
	CONSTRAINT "fee_rules_minimum_check" CHECK ("fee_rules"."minimum_order_krw" >= 0),
	CONSTRAINT "fee_rules_window_check" CHECK ("fee_rules"."effective_until" is null or "fee_rules"."effective_until" > "fee_rules"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "fee_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_rule_id" uuid NOT NULL,
	"fee_rule_code" text NOT NULL,
	"fee_rule_version" integer NOT NULL,
	"seller_fee_bps" integer NOT NULL,
	"buyer_fee_bps" integer NOT NULL,
	"gross_amount_krw" bigint NOT NULL,
	"seller_fee_krw" bigint NOT NULL,
	"buyer_fee_krw" bigint NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_snapshots_bps_check" CHECK ("fee_snapshots"."seller_fee_bps" between 0 and 10000 and "fee_snapshots"."buyer_fee_bps" between 0 and 10000),
	CONSTRAINT "fee_snapshots_amounts_check" CHECK ("fee_snapshots"."gross_amount_krw" >= 0 and "fee_snapshots"."seller_fee_krw" >= 0 and "fee_snapshots"."buyer_fee_krw" >= 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"actor_user_id" uuid,
	"request_sha256" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"locked_until" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "idempotency_keys_status_check" CHECK ("idempotency_keys"."status" in ('IN_PROGRESS', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"normal_balance" text NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"order_id" uuid,
	"organization_id" uuid,
	"creator_profile_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_code_unique" UNIQUE("code"),
	CONSTRAINT "ledger_accounts_type_check" CHECK ("ledger_accounts"."account_type" in ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
	CONSTRAINT "ledger_accounts_balance_check" CHECK ("ledger_accounts"."normal_balance" in ('DEBIT', 'CREDIT')),
	CONSTRAINT "ledger_accounts_currency_check" CHECK ("ledger_accounts"."currency" = 'KRW')
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_krw" bigint DEFAULT 0 NOT NULL,
	"credit_krw" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_one_sided_check" CHECK (("ledger_entries"."debit_krw" > 0 and "ledger_entries"."credit_krw" = 0) or ("ledger_entries"."credit_krw" > 0 and "ledger_entries"."debit_krw" = 0)),
	CONSTRAINT "ledger_entries_currency_check" CHECK ("ledger_entries"."currency" = 'KRW'),
	CONSTRAINT "ledger_entries_line_check" CHECK ("ledger_entries"."line_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"order_id" uuid,
	"status" "ledger_transaction_status" DEFAULT 'DRAFT' NOT NULL,
	"description" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"posted_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "ledger_transactions_posted_at_check" CHECK (("ledger_transactions"."status" = 'DRAFT' and "ledger_transactions"."posted_at" is null) or ("ledger_transactions"."status" = 'POSTED' and "ledger_transactions"."posted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "legacy_creator_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"alias_type" text NOT NULL,
	"alias_value" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_creator_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_record_id" text NOT NULL,
	"creator_profile_id" uuid,
	"payload_sha256" text NOT NULL,
	"archived_payload" jsonb NOT NULL,
	"estimated_ad_rate_krw" bigint,
	"estimated_cpv_krw" bigint,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"license_id" uuid NOT NULL,
	"proposal_version_id" uuid,
	"payment_intent_id" uuid,
	"renewed_license_id" uuid,
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"renewal_amount_krw" bigint NOT NULL,
	"platform_fee_krw" bigint NOT NULL,
	"proposed_start_at" timestamp with time zone NOT NULL,
	"proposed_end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "license_renewals_amounts_check" CHECK ("license_renewals"."renewal_amount_krw" > 0 and "license_renewals"."platform_fee_krw" >= 0),
	CONSTRAINT "license_renewals_status_check" CHECK ("license_renewals"."status" in ('PROPOSED', 'ACCEPTED', 'PAYMENT_PENDING', 'PAID', 'ACTIVE', 'DECLINED', 'CANCELED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"source_contract_version_id" uuid NOT NULL,
	"advertiser_profile_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"organic_publish" boolean DEFAULT true NOT NULL,
	"brand_repost" boolean DEFAULT false NOT NULL,
	"paid_media" boolean DEFAULT false NOT NULL,
	"whitelisting" boolean DEFAULT false NOT NULL,
	"editing_allowed" boolean DEFAULT false NOT NULL,
	"subtitle_allowed" boolean DEFAULT false NOT NULL,
	"crop_allowed" boolean DEFAULT false NOT NULL,
	"territory" text[] DEFAULT '{}'::text[] NOT NULL,
	"platforms" text[] DEFAULT '{YOUTUBE}'::text[] NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"perpetual" boolean DEFAULT false NOT NULL,
	"exclusivity_category" text,
	"exclusivity_days" integer DEFAULT 0 NOT NULL,
	"renewal_price_krw" bigint,
	"renewal_terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "licenses_period_check" CHECK (("licenses"."perpetual" and "licenses"."ends_at" is null) or (not "licenses"."perpetual" and "licenses"."ends_at" is not null and "licenses"."ends_at" > "licenses"."starts_at")),
	CONSTRAINT "licenses_exclusivity_check" CHECK ("licenses"."exclusivity_days" >= 0),
	CONSTRAINT "licenses_renewal_price_check" CHECK ("licenses"."renewal_price_krw" is null or "licenses"."renewal_price_krw" >= 0),
	CONSTRAINT "licenses_status_check" CHECK ("licenses"."status" in ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED', 'SUPERSEDED'))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text,
	"message_type" text DEFAULT 'TEXT' NOT NULL,
	"structured_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reply_to_message_id" uuid,
	"client_message_id" text NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_type_check" CHECK ("messages"."message_type" in ('TEXT', 'SYSTEM', 'PROPOSAL', 'DELIVERABLE', 'REVISION_REQUEST', 'APPROVAL'))
);
--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"opened_by_user_id" uuid,
	"assigned_to_user_id" uuid,
	"decision" text,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "moderation_cases_status_check" CHECK ("moderation_cases"."status" in ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED', 'APPEALED'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_notification_type_channel_pk" PRIMARY KEY("user_id","notification_type","channel"),
	CONSTRAINT "notification_preferences_channel_check" CHECK ("notification_preferences"."channel" in ('IN_APP', 'EMAIL', 'SMS', 'PUSH'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"template_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"deduplication_key" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_channel_check" CHECK ("notifications"."channel" in ('IN_APP', 'EMAIL', 'SMS', 'PUSH')),
	CONSTRAINT "notifications_status_check" CHECK ("notifications"."status" in ('PENDING', 'SENT', 'FAILED', 'RETRY', 'CANCELED'))
);
--> statement-breakpoint
CREATE TABLE "order_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"authority" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_user_id" uuid,
	"reason_code" text NOT NULL,
	"reason" text,
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "order_status_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "order_status_events_authority_check" CHECK ("order_status_events"."authority" in ('WORKFLOW', 'PAYMENT', 'PAYOUT', 'DISPUTE', 'HOLD'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"parent_order_id" uuid,
	"campaign_id" uuid,
	"package_id" uuid,
	"proposal_version_id" uuid NOT NULL,
	"contract_version_id" uuid NOT NULL,
	"fee_snapshot_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"buyer_organization_id" uuid,
	"advertiser_profile_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"workflow_status" "order_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"gross_amount_krw" bigint NOT NULL,
	"buyer_fee_krw" bigint DEFAULT 0 NOT NULL,
	"buyer_total_krw" bigint NOT NULL,
	"seller_fee_krw" bigint DEFAULT 0 NOT NULL,
	"seller_tax_withholding_krw" bigint DEFAULT 0 NOT NULL,
	"seller_receivable_krw" bigint NOT NULL,
	"product_value_krw" bigint DEFAULT 0 NOT NULL,
	"revision_limit" integer DEFAULT 0 NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"brief_snapshot" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"funded_at" timestamp with time zone,
	"buyer_confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_currency_check" CHECK ("orders"."currency" = 'KRW'),
	CONSTRAINT "orders_amounts_nonnegative_check" CHECK ("orders"."gross_amount_krw" >= 0 and "orders"."buyer_fee_krw" >= 0 and "orders"."buyer_total_krw" >= 0 and "orders"."seller_fee_krw" >= 0 and "orders"."seller_tax_withholding_krw" >= 0 and "orders"."seller_receivable_krw" >= 0 and "orders"."product_value_krw" >= 0),
	CONSTRAINT "orders_buyer_total_check" CHECK ("orders"."buyer_total_krw" = "orders"."gross_amount_krw" + "orders"."buyer_fee_krw"),
	CONSTRAINT "orders_seller_receivable_check" CHECK ("orders"."seller_receivable_krw" = "orders"."gross_amount_krw" - "orders"."seller_fee_krw" - "orders"."seller_tax_withholding_krw"),
	CONSTRAINT "orders_revision_check" CHECK ("orders"."revision_limit" >= 0 and "orders"."revision_count" >= 0 and "orders"."revision_count" <= "orders"."revision_limit"),
	CONSTRAINT "orders_version_check" CHECK ("orders"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"invited_by_user_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id"),
	CONSTRAINT "organization_members_role_check" CHECK ("organization_members"."role" in ('OWNER', 'ADMIN', 'MEMBER', 'BILLING', 'VIEWER')),
	CONSTRAINT "organization_members_status_check" CHECK ("organization_members"."status" in ('INVITED', 'ACTIVE', 'REVOKED'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_slug" text NOT NULL,
	"type" "organization_type" NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"business_verification_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_public_slug_unique" UNIQUE("public_slug"),
	CONSTRAINT "organizations_status_check" CHECK ("organizations"."status" in ('ACTIVE', 'SUSPENDED', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "outbox_events_attempts_check" CHECK ("outbox_events"."attempt_count" >= 0),
	CONSTRAINT "outbox_events_status_check" CHECK ("outbox_events"."status" in ('PENDING', 'PROCESSING', 'PUBLISHED', 'RETRY', 'DEAD_LETTER'))
);
--> statement-breakpoint
CREATE TABLE "package_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"type" text NOT NULL,
	"storage_object_key" text,
	"external_url" text,
	"mime_type" text,
	"size_bytes" bigint,
	"sha256" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "package_assets_location_check" CHECK (num_nonnulls("package_assets"."storage_object_key", "package_assets"."external_url") = 1),
	CONSTRAINT "package_assets_size_check" CHECK ("package_assets"."size_bytes" is null or "package_assets"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "package_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_delta_krw" bigint DEFAULT 0 NOT NULL,
	"additional_production_days" integer DEFAULT 0 NOT NULL,
	"terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "package_options_price_delta_check" CHECK ("package_options"."price_delta_krw" >= 0),
	CONSTRAINT "package_options_days_check" CHECK ("package_options"."additional_production_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_sequence" bigint,
	"event_type" text NOT NULL,
	"normalized_status" "payment_status" NOT NULL,
	"payload_sha256" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_key" text,
	"merchant_reference" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "payment_status" DEFAULT 'CREATED' NOT NULL,
	"amount_krw" bigint NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"checkout_expires_at" timestamp with time zone,
	"authorized_at" timestamp with time zone,
	"funded_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"provider_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payment_intents_amount_check" CHECK ("payment_intents"."amount_krw" > 0),
	CONSTRAINT "payment_intents_currency_check" CHECK ("payment_intents"."currency" = 'KRW')
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"provider_transaction_id" text,
	"idempotency_key" text NOT NULL,
	"amount_krw" bigint NOT NULL,
	"failure_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "payment_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payment_transactions_amount_check" CHECK ("payment_transactions"."amount_krw" > 0),
	CONSTRAINT "payment_transactions_type_check" CHECK ("payment_transactions"."type" in ('AUTHORIZE', 'CAPTURE', 'CANCEL', 'REFUND', 'CHARGEBACK', 'REVERSAL')),
	CONSTRAINT "payment_transactions_status_check" CHECK ("payment_transactions"."status" in ('PENDING', 'SUCCEEDED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"seller_verification_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_token" text NOT NULL,
	"account_holder_reference" text,
	"bank_code" text,
	"account_last4" text,
	"status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_sequence" bigint,
	"event_type" text NOT NULL,
	"normalized_status" "payout_status" NOT NULL,
	"payload_sha256" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"dispute_id" uuid,
	"hold_type" text NOT NULL,
	"status" "hold_status" DEFAULT 'ACTIVE' NOT NULL,
	"reason" text NOT NULL,
	"placed_by_user_id" uuid,
	"released_by_user_id" uuid,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"release_reason" text,
	CONSTRAINT "payout_holds_type_check" CHECK ("payout_holds"."hold_type" in ('SELLER_VERIFICATION', 'DISPUTE', 'RISK', 'CHARGEBACK', 'RECONCILIATION', 'MANUAL')),
	CONSTRAINT "payout_holds_release_check" CHECK (("payout_holds"."status" = 'ACTIVE' and "payout_holds"."released_at" is null) or ("payout_holds"."status" = 'RELEASED' and "payout_holds"."released_at" is not null and "payout_holds"."release_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"payout_account_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_payout_id" text,
	"idempotency_key" text NOT NULL,
	"status" "payout_status" DEFAULT 'NOT_READY' NOT NULL,
	"amount_krw" bigint NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"requested_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_code" text,
	"provider_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payouts_amount_check" CHECK ("payouts"."amount_krw" > 0),
	CONSTRAINT "payouts_currency_check" CHECK ("payouts"."currency" = 'KRW')
);
--> statement-breakpoint
CREATE TABLE "proposal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_version_id" uuid NOT NULL,
	"party_type" text NOT NULL,
	"accepted_by_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_hash" text NOT NULL,
	"ip_evidence" text,
	"user_agent" text,
	CONSTRAINT "proposal_acceptances_party_check" CHECK ("proposal_acceptances"."party_type" in ('BUYER', 'CREATOR'))
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"supersedes_version_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"cash_compensation_krw" bigint NOT NULL,
	"product_value_krw" bigint DEFAULT 0 NOT NULL,
	"terms" jsonb NOT NULL,
	"canonical_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_versions_cash_check" CHECK ("proposal_versions"."cash_compensation_krw" >= 0),
	CONSTRAINT "proposal_versions_product_check" CHECK ("proposal_versions"."product_value_krw" >= 0),
	CONSTRAINT "proposal_versions_version_check" CHECK ("proposal_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"package_id" uuid,
	"application_id" uuid,
	"advertiser_profile_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"status" "proposal_status" DEFAULT 'DRAFT' NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_source_check" CHECK (num_nonnulls("proposals"."campaign_id", "proposals"."package_id") >= 1),
	CONSTRAINT "proposals_version_check" CHECK ("proposals"."current_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_run_id" uuid NOT NULL,
	"order_id" uuid,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"expected_amount_krw" bigint NOT NULL,
	"actual_amount_krw" bigint NOT NULL,
	"status" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_items_status_check" CHECK ("reconciliation_items"."status" in ('MATCHED', 'MISSING_PROVIDER', 'MISSING_LEDGER', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'RESOLVED'))
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"expected_amount_krw" bigint DEFAULT 0 NOT NULL,
	"actual_amount_krw" bigint DEFAULT 0 NOT NULL,
	"discrepancy_amount_krw" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolution_note" text,
	CONSTRAINT "reconciliation_runs_window_check" CHECK ("reconciliation_runs"."period_end" > "reconciliation_runs"."period_start"),
	CONSTRAINT "reconciliation_runs_status_check" CHECK ("reconciliation_runs"."status" in ('RUNNING', 'MATCHED', 'MISMATCH', 'RESOLVED', 'FAILED')),
	CONSTRAINT "reconciliation_runs_discrepancy_check" CHECK ("reconciliation_runs"."discrepancy_amount_krw" = "reconciliation_runs"."actual_amount_krw" - "reconciliation_runs"."expected_amount_krw")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"provider_refund_id" text,
	"idempotency_key" text NOT NULL,
	"amount_krw" bigint NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"reason_code" text NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "refunds_amount_check" CHECK ("refunds"."amount_krw" > 0),
	CONSTRAINT "refunds_status_check" CHECK ("refunds"."status" in ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED'))
);
--> statement-breakpoint
CREATE TABLE "review_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"appealed_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"decided_by_user_id" uuid,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "review_appeals_status_check" CHECK ("review_appeals"."status" in ('OPEN', 'UPHELD', 'REJECTED', 'WITHDRAWN'))
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"detail" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "review_reports_status_check" CHECK ("review_reports"."status" in ('OPEN', 'UPHELD', 'REJECTED', 'WITHDRAWN'))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"ratings" jsonb NOT NULL,
	"overall_rating" integer NOT NULL,
	"body" text,
	"status" text DEFAULT 'SEALED' NOT NULL,
	"reveal_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"moderated_at" timestamp with time zone,
	"moderation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_parties_check" CHECK ("reviews"."author_user_id" <> "reviews"."subject_user_id"),
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."overall_rating" between 1 and 5),
	CONSTRAINT "reviews_direction_check" CHECK ("reviews"."direction" in ('BUYER_TO_CREATOR', 'CREATOR_TO_BUYER')),
	CONSTRAINT "reviews_status_check" CHECK ("reviews"."status" in ('SEALED', 'PUBLISHED', 'REPORTED', 'RESTRICTED', 'REMOVED'))
);
--> statement-breakpoint
CREATE TABLE "risk_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"order_id" uuid,
	"rule_code" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_to_user_id" uuid,
	"resolved_by_user_id" uuid,
	"resolution_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "risk_flags_severity_check" CHECK ("risk_flags"."severity" in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
	CONSTRAINT "risk_flags_status_check" CHECK ("risk_flags"."status" in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE'))
);
--> statement-breakpoint
CREATE TABLE "seller_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_seller_id" text,
	"status" "verification_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"seller_type" "organization_type" NOT NULL,
	"identity_reference" text,
	"business_reference" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terms_document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"acceptance_context" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "terms_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" text NOT NULL,
	"version" text NOT NULL,
	"locale" text DEFAULT 'ko-KR' NOT NULL,
	"title" text NOT NULL,
	"body_markdown" text NOT NULL,
	"content_sha256" text NOT NULL,
	"legal_status" text DEFAULT 'DRAFT_NEEDS_COUNSEL' NOT NULL,
	"effective_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terms_documents_legal_check" CHECK ("terms_documents"."legal_status" in ('DRAFT_NEEDS_COUNSEL', 'COUNSEL_APPROVED', 'RETIRED'))
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"granted_by_user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"reason" text,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"locale" text DEFAULT 'ko-KR' NOT NULL,
	"time_zone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"admin_mfa_enabled" boolean DEFAULT false NOT NULL,
	"last_signed_in_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('ACTIVE', 'LOCKED', 'SUSPENDED', 'DELETED'))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_sha256" text NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error_code" text,
	"redacted_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "webhook_events_attempts_check" CHECK ("webhook_events"."attempt_count" >= 0),
	CONSTRAINT "webhook_events_status_check" CHECK ("webhook_events"."status" in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'RETRY', 'DEAD_LETTER'))
);
--> statement-breakpoint
CREATE TABLE "youtube_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_channel_id" text NOT NULL,
	"legacy_channel_id" text,
	"handle" text,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"country_code" text,
	"primary_language" text,
	"subscriber_count" bigint,
	"public_view_count" bigint,
	"public_video_count" bigint,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"source_authorization" text NOT NULL,
	"source_confidence" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_channels_external_channel_id_unique" UNIQUE("external_channel_id"),
	CONSTRAINT "youtube_channels_subscribers_check" CHECK ("youtube_channels"."subscriber_count" is null or "youtube_channels"."subscriber_count" >= 0),
	CONSTRAINT "youtube_channels_views_check" CHECK ("youtube_channels"."public_view_count" is null or "youtube_channels"."public_view_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "advertiser_profiles" ADD CONSTRAINT "advertiser_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advertiser_profiles" ADD CONSTRAINT "advertiser_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deliverable_version_id_deliverable_versions_id_fk" FOREIGN KEY ("deliverable_version_id") REFERENCES "public"."deliverable_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_package_id_creator_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."creator_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_invitations" ADD CONSTRAINT "campaign_invitations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_invitations" ADD CONSTRAINT "campaign_invitations_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_invitations" ADD CONSTRAINT "campaign_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_profile_id_advertiser_profiles_id_fk" FOREIGN KEY ("advertiser_profile_id") REFERENCES "public"."advertiser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_verifications" ADD CONSTRAINT "channel_verifications_youtube_channel_id_youtube_channels_id_fk" FOREIGN KEY ("youtube_channel_id") REFERENCES "public"."youtube_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_verifications" ADD CONSTRAINT "channel_verifications_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_verifications" ADD CONSTRAINT "channel_verifications_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_proposal_version_id_proposal_versions_id_fk" FOREIGN KEY ("proposal_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_advertiser_profile_id_advertiser_profiles_id_fk" FOREIGN KEY ("advertiser_profile_id") REFERENCES "public"."advertiser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_superseded_by_contract_id_contracts_id_fk" FOREIGN KEY ("superseded_by_contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_packages" ADD CONSTRAINT "creator_packages_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_youtube_channel_id_youtube_channels_id_fk" FOREIGN KEY ("youtube_channel_id") REFERENCES "public"."youtube_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decisions_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_snapshots" ADD CONSTRAINT "fee_snapshots_fee_rule_id_fee_rules_id_fk" FOREIGN KEY ("fee_rule_id") REFERENCES "public"."fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_creator_aliases" ADD CONSTRAINT "legacy_creator_aliases_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_creator_imports" ADD CONSTRAINT "legacy_creator_imports_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_proposal_version_id_proposal_versions_id_fk" FOREIGN KEY ("proposal_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_renewed_license_id_licenses_id_fk" FOREIGN KEY ("renewed_license_id") REFERENCES "public"."licenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_source_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("source_contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_advertiser_profile_id_advertiser_profiles_id_fk" FOREIGN KEY ("advertiser_profile_id") REFERENCES "public"."advertiser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_parent_order_id_orders_id_fk" FOREIGN KEY ("parent_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_package_id_creator_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."creator_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_proposal_version_id_proposal_versions_id_fk" FOREIGN KEY ("proposal_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fee_snapshot_id_fee_snapshots_id_fk" FOREIGN KEY ("fee_snapshot_id") REFERENCES "public"."fee_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_organization_id_organizations_id_fk" FOREIGN KEY ("buyer_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_advertiser_profile_id_advertiser_profiles_id_fk" FOREIGN KEY ("advertiser_profile_id") REFERENCES "public"."advertiser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_assets" ADD CONSTRAINT "package_assets_package_id_creator_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."creator_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_options" ADD CONSTRAINT "package_options_package_id_creator_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."creator_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_seller_verification_id_seller_verifications_id_fk" FOREIGN KEY ("seller_verification_id") REFERENCES "public"."seller_verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_holds" ADD CONSTRAINT "payout_holds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_holds" ADD CONSTRAINT "payout_holds_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_holds" ADD CONSTRAINT "payout_holds_placed_by_user_id_users_id_fk" FOREIGN KEY ("placed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_holds" ADD CONSTRAINT "payout_holds_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_account_id_payout_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."payout_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_acceptances" ADD CONSTRAINT "proposal_acceptances_proposal_version_id_proposal_versions_id_fk" FOREIGN KEY ("proposal_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_acceptances" ADD CONSTRAINT "proposal_acceptances_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_supersedes_version_id_proposal_versions_id_fk" FOREIGN KEY ("supersedes_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_package_id_creator_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."creator_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_application_id_campaign_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."campaign_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_advertiser_profile_id_advertiser_profiles_id_fk" FOREIGN KEY ("advertiser_profile_id") REFERENCES "public"."advertiser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_reconciliation_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("reconciliation_run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_appeals" ADD CONSTRAINT "review_appeals_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_appeals" ADD CONSTRAINT "review_appeals_appealed_by_user_id_users_id_fk" FOREIGN KEY ("appealed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_appeals" ADD CONSTRAINT "review_appeals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_verifications" ADD CONSTRAINT "seller_verifications_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_terms_document_id_terms_documents_id_fk" FOREIGN KEY ("terms_document_id") REFERENCES "public"."terms_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advertiser_profiles_user_uidx" ON "advertiser_profiles" USING btree ("user_id") WHERE "advertiser_profiles"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "advertiser_profiles_org_uidx" ON "advertiser_profiles" USING btree ("organization_id") WHERE "advertiser_profiles"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "analytics_events_name_time_idx" ON "analytics_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_user_time_idx" ON "analytics_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_org_time_idx" ON "analytics_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_key_uidx" ON "attachments" USING btree ("storage_object_key");--> statement-breakpoint
CREATE INDEX "attachments_order_idx" ON "attachments" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "attachments_message_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachments_deliverable_version_idx" ON "attachments" USING btree ("deliverable_version_id");--> statement-breakpoint
CREATE INDEX "attachments_uploader_idx" ON "attachments" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_time_idx" ON "audit_logs" USING btree ("target_type","target_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_time_idx" ON "audit_logs" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_org_time_idx" ON "audit_logs" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_logs_idempotency_uidx" ON "audit_logs" USING btree ("idempotency_key") WHERE "audit_logs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "availability_slots_creator_window_idx" ON "availability_slots" USING btree ("creator_profile_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "availability_slots_package_window_idx" ON "availability_slots" USING btree ("package_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_applications_campaign_creator_uidx" ON "campaign_applications" USING btree ("campaign_id","creator_profile_id");--> statement-breakpoint
CREATE INDEX "campaign_applications_creator_status_idx" ON "campaign_applications" USING btree ("creator_profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_invitations_campaign_creator_uidx" ON "campaign_invitations" USING btree ("campaign_id","creator_profile_id");--> statement-breakpoint
CREATE INDEX "campaign_invitations_creator_status_idx" ON "campaign_invitations" USING btree ("creator_profile_id","status");--> statement-breakpoint
CREATE INDEX "campaign_invitations_inviter_idx" ON "campaign_invitations" USING btree ("invited_by_user_id");--> statement-breakpoint
CREATE INDEX "campaigns_owner_status_idx" ON "campaigns" USING btree ("advertiser_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_market_search_idx" ON "campaigns" USING btree ("status","category","application_deadline");--> statement-breakpoint
CREATE INDEX "campaigns_org_idx" ON "campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "campaigns_created_by_idx" ON "campaigns" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_verifications_active_claim_uidx" ON "channel_verifications" USING btree ("youtube_channel_id") WHERE "channel_verifications"."status" in ('PENDING', 'REQUIRES_ACTION', 'VERIFIED');--> statement-breakpoint
CREATE INDEX "channel_verifications_creator_idx" ON "channel_verifications" USING btree ("creator_profile_id","status");--> statement-breakpoint
CREATE INDEX "channel_verifications_requester_idx" ON "channel_verifications" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "consents_user_type_time_idx" ON "consents" USING btree ("user_id","consent_type","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_acceptances_version_party_uidx" ON "contract_acceptances" USING btree ("contract_version_id","party_type");--> statement-breakpoint
CREATE INDEX "contract_acceptances_user_idx" ON "contract_acceptances" USING btree ("accepted_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_versions_contract_version_uidx" ON "contract_versions" USING btree ("contract_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_versions_hash_uidx" ON "contract_versions" USING btree ("canonical_sha256");--> statement-breakpoint
CREATE INDEX "contract_versions_proposal_version_idx" ON "contract_versions" USING btree ("proposal_version_id");--> statement-breakpoint
CREATE INDEX "contracts_advertiser_status_idx" ON "contracts" USING btree ("advertiser_profile_id","status");--> statement-breakpoint
CREATE INDEX "contracts_creator_status_idx" ON "contracts" USING btree ("creator_profile_id","status");--> statement-breakpoint
CREATE INDEX "contracts_proposal_idx" ON "contracts" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "conversation_members_user_idx" ON "conversation_members" USING btree ("user_id","left_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_order_kind_uidx" ON "conversations" USING btree ("order_id","kind");--> statement-breakpoint
CREATE INDEX "conversations_created_by_idx" ON "conversations" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "creator_packages_creator_status_idx" ON "creator_packages" USING btree ("creator_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "creator_packages_market_search_idx" ON "creator_packages" USING btree ("status","category","format","base_price_krw");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_profiles_channel_uidx" ON "creator_profiles" USING btree ("youtube_channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_profiles_user_uidx" ON "creator_profiles" USING btree ("user_id") WHERE "creator_profiles"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "creator_profiles_marketplace_status_idx" ON "creator_profiles" USING btree ("marketplace_status","updated_at");--> statement-breakpoint
CREATE INDEX "data_provenance_entity_idx" ON "data_provenance" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliverable_versions_deliverable_version_uidx" ON "deliverable_versions" USING btree ("deliverable_id","version");--> statement-breakpoint
CREATE INDEX "deliverable_versions_submitter_idx" ON "deliverable_versions" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "deliverable_versions_reviewer_idx" ON "deliverable_versions" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "deliverables_order_status_idx" ON "deliverables" USING btree ("order_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_decisions_dispute_version_uidx" ON "dispute_decisions" USING btree ("dispute_id","version");--> statement-breakpoint
CREATE INDEX "dispute_decisions_decider_idx" ON "dispute_decisions" USING btree ("decided_by_user_id");--> statement-breakpoint
CREATE INDEX "dispute_evidence_dispute_time_idx" ON "dispute_evidence" USING btree ("dispute_id","submitted_at");--> statement-breakpoint
CREATE INDEX "dispute_evidence_submitter_idx" ON "dispute_evidence" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_one_open_per_order_uidx" ON "disputes" USING btree ("order_id") WHERE "disputes"."status" in ('OPEN', 'EVIDENCE_COLLECTION', 'UNDER_REVIEW', 'APPEALED');--> statement-breakpoint
CREATE INDEX "disputes_assignee_status_idx" ON "disputes" USING btree ("assigned_to_user_id","status","opened_at");--> statement-breakpoint
CREATE INDEX "disputes_opener_idx" ON "disputes" USING btree ("opened_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_key_environment_uidx" ON "feature_flags" USING btree ("key","environment");--> statement-breakpoint
CREATE INDEX "feature_flags_enabled_idx" ON "feature_flags" USING btree ("environment","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_rules_code_version_uidx" ON "fee_rules" USING btree ("code","version");--> statement-breakpoint
CREATE INDEX "fee_rules_active_idx" ON "fee_rules" USING btree ("code","effective_from","effective_until");--> statement-breakpoint
CREATE INDEX "fee_snapshots_rule_idx" ON "fee_snapshots" USING btree ("fee_rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_scope_key_uidx" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expiry_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_actor_idx" ON "idempotency_keys" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_order_idx" ON "ledger_accounts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_org_idx" ON "ledger_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_creator_idx" ON "ledger_accounts" USING btree ("creator_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_transaction_line_uidx" ON "ledger_entries" USING btree ("transaction_id","line_number");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_time_idx" ON "ledger_entries" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_transactions_reference_idx" ON "ledger_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_order_time_idx" ON "ledger_transactions" USING btree ("order_id","effective_at");--> statement-breakpoint
CREATE INDEX "ledger_transactions_posted_time_idx" ON "ledger_transactions" USING btree ("status","posted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_creator_aliases_type_value_uidx" ON "legacy_creator_aliases" USING btree ("alias_type","alias_value");--> statement-breakpoint
CREATE INDEX "legacy_creator_aliases_creator_idx" ON "legacy_creator_aliases" USING btree ("creator_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_creator_imports_source_record_uidx" ON "legacy_creator_imports" USING btree ("source","source_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_creator_imports_payload_hash_uidx" ON "legacy_creator_imports" USING btree ("payload_sha256");--> statement-breakpoint
CREATE INDEX "legacy_creator_imports_creator_idx" ON "legacy_creator_imports" USING btree ("creator_profile_id");--> statement-breakpoint
CREATE INDEX "license_renewals_license_status_idx" ON "license_renewals" USING btree ("license_id","status");--> statement-breakpoint
CREATE INDEX "license_renewals_payment_idx" ON "license_renewals" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "licenses_order_idx" ON "licenses" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "licenses_expiry_idx" ON "licenses" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "licenses_advertiser_idx" ON "licenses" USING btree ("advertiser_profile_id");--> statement-breakpoint
CREATE INDEX "licenses_creator_idx" ON "licenses" USING btree ("creator_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_sender_client_uidx" ON "messages" USING btree ("sender_user_id","client_message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_time_idx" ON "messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "messages_reply_idx" ON "messages" USING btree ("reply_to_message_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_status_idx" ON "moderation_cases" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "moderation_cases_entity_idx" ON "moderation_cases" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_assignee_idx" ON "moderation_cases" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_uidx" ON "notifications" USING btree ("user_id","deduplication_key");--> statement-breakpoint
CREATE INDEX "notifications_user_status_idx" ON "notifications" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_dispatch_idx" ON "notifications" USING btree ("status","scheduled_at") WHERE "notifications"."status" in ('PENDING', 'RETRY');--> statement-breakpoint
CREATE INDEX "order_status_events_order_time_idx" ON "order_status_events" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "order_status_events_actor_idx" ON "order_status_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "orders_buyer_status_idx" ON "orders" USING btree ("buyer_user_id","workflow_status","created_at");--> statement-breakpoint
CREATE INDEX "orders_org_status_idx" ON "orders" USING btree ("buyer_organization_id","workflow_status","created_at");--> statement-breakpoint
CREATE INDEX "orders_creator_status_idx" ON "orders" USING btree ("creator_profile_id","workflow_status","created_at");--> statement-breakpoint
CREATE INDEX "orders_campaign_idx" ON "orders" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "orders_parent_idx" ON "orders" USING btree ("parent_order_id");--> statement-breakpoint
CREATE INDEX "orders_contract_version_idx" ON "orders" USING btree ("contract_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_contract_version_uidx" ON "orders" USING btree ("contract_version_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "organizations_created_by_idx" ON "organizations" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "outbox_events_queue_idx" ON "outbox_events" USING btree ("status","available_at","created_at") WHERE "outbox_events"."status" in ('PENDING', 'RETRY');--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "package_assets_package_idx" ON "package_assets" USING btree ("package_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "package_options_name_uidx" ON "package_options" USING btree ("package_id","name");--> statement-breakpoint
CREATE INDEX "package_options_package_idx" ON "package_options" USING btree ("package_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_uidx" ON "payment_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_events_intent_time_idx" ON "payment_events" USING btree ("payment_intent_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_intent_sequence_uidx" ON "payment_events" USING btree ("payment_intent_id","provider_sequence") WHERE "payment_events"."provider_sequence" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_provider_key_uidx" ON "payment_intents" USING btree ("provider","provider_payment_key") WHERE "payment_intents"."provider_payment_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_one_active_per_order_uidx" ON "payment_intents" USING btree ("order_id") WHERE "payment_intents"."status" in ('CREATED', 'READY', 'AUTHORIZED', 'FUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE INDEX "payment_intents_order_status_idx" ON "payment_intents" USING btree ("order_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_provider_id_uidx" ON "payment_transactions" USING btree ("provider_transaction_id") WHERE "payment_transactions"."provider_transaction_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_transactions_intent_time_idx" ON "payment_transactions" USING btree ("payment_intent_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_accounts_provider_token_uidx" ON "payout_accounts" USING btree ("provider","provider_account_token");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_accounts_creator_default_uidx" ON "payout_accounts" USING btree ("creator_profile_id") WHERE "payout_accounts"."is_default" and "payout_accounts"."status" = 'VERIFIED';--> statement-breakpoint
CREATE INDEX "payout_accounts_verification_idx" ON "payout_accounts" USING btree ("seller_verification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_events_provider_event_uidx" ON "payout_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_events_payout_sequence_uidx" ON "payout_events" USING btree ("payout_id","provider_sequence") WHERE "payout_events"."provider_sequence" is not null;--> statement-breakpoint
CREATE INDEX "payout_events_payout_time_idx" ON "payout_events" USING btree ("payout_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_holds_active_type_uidx" ON "payout_holds" USING btree ("order_id","hold_type") WHERE "payout_holds"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "payout_holds_order_status_idx" ON "payout_holds" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "payout_holds_dispute_idx" ON "payout_holds" USING btree ("dispute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_provider_id_uidx" ON "payouts" USING btree ("provider","provider_payout_id") WHERE "payouts"."provider_payout_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_one_paid_per_order_uidx" ON "payouts" USING btree ("order_id") WHERE "payouts"."status" = 'PAID';--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_one_active_per_order_uidx" ON "payouts" USING btree ("order_id") WHERE "payouts"."status" in ('READY', 'SCHEDULED', 'PROCESSING');--> statement-breakpoint
CREATE INDEX "payouts_creator_status_idx" ON "payouts" USING btree ("creator_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payouts_account_idx" ON "payouts" USING btree ("payout_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_acceptances_version_party_uidx" ON "proposal_acceptances" USING btree ("proposal_version_id","party_type");--> statement-breakpoint
CREATE INDEX "proposal_acceptances_user_idx" ON "proposal_acceptances" USING btree ("accepted_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_versions_proposal_version_uidx" ON "proposal_versions" USING btree ("proposal_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_versions_canonical_hash_uidx" ON "proposal_versions" USING btree ("proposal_id","canonical_sha256");--> statement-breakpoint
CREATE INDEX "proposal_versions_creator_idx" ON "proposal_versions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "proposals_advertiser_status_idx" ON "proposals" USING btree ("advertiser_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "proposals_creator_status_idx" ON "proposals" USING btree ("creator_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "proposals_campaign_idx" ON "proposals" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "proposals_package_idx" ON "proposals" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_items_reference_uidx" ON "reconciliation_items" USING btree ("reconciliation_run_id","reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "reconciliation_items_order_status_idx" ON "reconciliation_items" USING btree ("order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_runs_provider_period_uidx" ON "reconciliation_runs" USING btree ("provider","period_start","period_end");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_status_idx" ON "reconciliation_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_provider_id_uidx" ON "refunds" USING btree ("provider_refund_id") WHERE "refunds"."provider_refund_id" is not null;--> statement-breakpoint
CREATE INDEX "refunds_payment_status_idx" ON "refunds" USING btree ("payment_intent_id","status","created_at");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_appeals_open_user_uidx" ON "review_appeals" USING btree ("review_id","appealed_by_user_id") WHERE "review_appeals"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "review_appeals_status_idx" ON "review_appeals" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_reports_open_reporter_uidx" ON "review_reports" USING btree ("review_id","reported_by_user_id") WHERE "review_reports"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "review_reports_status_idx" ON "review_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_author_uidx" ON "reviews" USING btree ("order_id","author_user_id");--> statement-breakpoint
CREATE INDEX "reviews_subject_status_idx" ON "reviews" USING btree ("subject_user_id","status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_flags_open_rule_uidx" ON "risk_flags" USING btree ("entity_type","entity_id","rule_code") WHERE "risk_flags"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "risk_flags_order_status_idx" ON "risk_flags" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "risk_flags_assignee_idx" ON "risk_flags" USING btree ("assigned_to_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_verifications_provider_seller_uidx" ON "seller_verifications" USING btree ("provider","provider_seller_id") WHERE "seller_verifications"."provider_seller_id" is not null;--> statement-breakpoint
CREATE INDEX "seller_verifications_creator_status_idx" ON "seller_verifications" USING btree ("creator_profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_acceptances_document_user_context_uidx" ON "terms_acceptances" USING btree ("terms_document_id","user_id","acceptance_context");--> statement-breakpoint
CREATE INDEX "terms_acceptances_user_idx" ON "terms_acceptances" USING btree ("user_id","accepted_at");--> statement-breakpoint
CREATE INDEX "terms_acceptances_org_idx" ON "terms_acceptances" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_documents_type_version_locale_uidx" ON "terms_documents" USING btree ("document_type","version","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_documents_hash_uidx" ON "terms_documents" USING btree ("content_sha256");--> statement-breakpoint
CREATE INDEX "terms_documents_effective_idx" ON "terms_documents" USING btree ("document_type","effective_at");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_uidx" ON "users" USING btree (lower("email")) WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uidx" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_work_queue_idx" ON "webhook_events" USING btree ("status","next_attempt_at","received_at") WHERE "webhook_events"."status" in ('RECEIVED', 'RETRY');--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_channels_legacy_id_uidx" ON "youtube_channels" USING btree ("legacy_channel_id") WHERE "youtube_channels"."legacy_channel_id" is not null;--> statement-breakpoint
CREATE INDEX "youtube_channels_handle_idx" ON "youtube_channels" USING btree ("handle");