import { z } from "zod";

import { ORDER_STATUSES } from "../../domain/order-workflow";
import {
  isOrderMessageCursor,
  ORDER_MESSAGE_PAGE_MAX_LIMIT,
} from "./message-pagination";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const clientMessageIdSchema = boundedText(100).regex(/^[A-Za-z0-9._:-]+$/u);

export const orderLocatorSchema = boundedText(128);

export const orderMessagePageRequestSchema = z
  .object({
    before: z.string().max(128).refine(isOrderMessageCursor).optional(),
    limit: z.number().int().min(1).max(ORDER_MESSAGE_PAGE_MAX_LIMIT).optional(),
  })
  .strict();

export const sendOrderMessageSchema = z
  .object({
    body: boundedText(5_000),
    clientMessageId: clientMessageIdSchema,
    expectedVersion: z.number().int().positive(),
    replyToMessageId: z.string().uuid().optional(),
  })
  .strict();

export const requestOrderRevisionSchema = z
  .object({
    action: z.literal("REQUEST_REVISION"),
    expectedVersion: z.number().int().positive(),
    deliverableId: z.string().uuid(),
    deliverableVersion: z.number().int().positive(),
    reason: boundedText(1_000),
    clientMessageId: clientMessageIdSchema,
  })
  .strict();

export const approveOrderDeliverableSchema = z
  .object({
    action: z.literal("APPROVE_DELIVERABLE"),
    expectedVersion: z.number().int().positive(),
    deliverableId: z.string().uuid(),
    deliverableVersion: z.number().int().positive(),
    feedback: z.string().trim().max(1_000).optional(),
    clientMessageId: clientMessageIdSchema,
  })
  .strict();

export const reviewOrderDeliverableSchema = z.discriminatedUnion("action", [
  requestOrderRevisionSchema,
  approveOrderDeliverableSchema,
]);

const messageTypeSchema = z.enum([
  "TEXT",
  "SYSTEM",
  "PROPOSAL",
  "DELIVERABLE",
  "REVISION_REQUEST",
  "APPROVAL",
]);
const deliverableTypeSchema = z.enum([
  "SCRIPT",
  "STORYBOARD",
  "THUMBNAIL",
  "SHORTS_DRAFT",
  "LONGFORM_DRAFT",
  "FINAL_VIDEO",
  "COMMUNITY_POST",
  "PUBLICATION_URL",
  "PERFORMANCE_REPORT",
]);
const deliverableStatusSchema = z.enum([
  "PENDING",
  "SUBMITTED",
  "REVISION_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CANCELED",
]);
const deliverableVersionStatusSchema = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "REJECTED",
]);

export const orderWorkspaceSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    orderNumber: z.string().min(1),
    status: z.enum(ORDER_STATUSES),
    version: z.number().int().positive(),
    revisionCount: z.number().int().nonnegative(),
    revisionLimit: z.number().int().nonnegative(),
  }),
  messages: z
    .array(
      z.object({
        id: z.string().uuid(),
        senderUserId: z.string().uuid(),
        type: messageTypeSchema,
        body: z.string().nullable(),
        replyToMessageId: z.string().uuid().nullable(),
        clientMessageId: z.string().min(1),
        createdAt: z.string().datetime({ offset: true }),
      }),
    )
    .max(ORDER_MESSAGE_PAGE_MAX_LIMIT),
  messagePage: z.object({
    limit: z.number().int().min(1).max(ORDER_MESSAGE_PAGE_MAX_LIMIT),
    returned: z.number().int().min(0).max(ORDER_MESSAGE_PAGE_MAX_LIMIT),
    hasMore: z.boolean(),
    nextCursor: z.string().max(128).refine(isOrderMessageCursor).nullable(),
  }),
  deliverables: z.array(
    z.object({
      id: z.string().uuid(),
      type: deliverableTypeSchema,
      title: z.string().min(1),
      status: deliverableStatusSchema,
      currentVersion: z.number().int().nonnegative(),
      approvedAt: z.string().datetime({ offset: true }).nullable(),
      version: z
        .object({
          id: z.string().uuid(),
          version: z.number().int().positive(),
          status: deliverableVersionStatusSchema,
          submissionNote: z.string().nullable(),
          feedback: z.string().nullable(),
          revisionRequest: z.string().nullable(),
          submittedAt: z.string().datetime({ offset: true }),
          reviewedAt: z.string().datetime({ offset: true }).nullable(),
        })
        .nullable(),
    }),
  ),
});
