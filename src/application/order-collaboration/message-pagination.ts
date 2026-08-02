import type {
  OrderMessagePageMetadata,
  OrderMessagePageRequest,
  OrderWorkspaceMessage,
} from "./types";

export const ORDER_MESSAGE_PAGE_MAX_LIMIT = 100;
export const ORDER_MESSAGE_PAGE_DEFAULT_LIMIT = 100;

export interface OrderMessageCursor {
  readonly createdAt: string;
  readonly id: string;
}

const cursorPattern = /^v1~([^~]+)~([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu;

export function encodeOrderMessageCursor(
  value: Pick<OrderWorkspaceMessage, "createdAt" | "id">,
): string {
  const createdAt = new Date(value.createdAt);
  if (
    !Number.isFinite(createdAt.getTime()) ||
    createdAt.toISOString() !== value.createdAt ||
    !cursorPattern.test(`v1~${value.createdAt}~${value.id}`)
  ) {
    throw new TypeError("Message cursor source is invalid");
  }
  return `v1~${value.createdAt}~${value.id}`;
}

export function decodeOrderMessageCursor(value: string): OrderMessageCursor {
  const match = cursorPattern.exec(value);
  const createdAt = match?.[1];
  const id = match?.[2];
  if (
    createdAt === undefined ||
    id === undefined ||
    !Number.isFinite(Date.parse(createdAt)) ||
    new Date(createdAt).toISOString() !== createdAt
  ) {
    throw new TypeError("Message cursor is invalid");
  }
  return Object.freeze({ createdAt, id: id.toLowerCase() });
}

export function isOrderMessageCursor(value: string): boolean {
  try {
    decodeOrderMessageCursor(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizeOrderMessagePageRequest(
  request: OrderMessagePageRequest = {},
): Readonly<{ before: OrderMessageCursor | null; limit: number }> {
  const limit = request.limit ?? ORDER_MESSAGE_PAGE_DEFAULT_LIMIT;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > ORDER_MESSAGE_PAGE_MAX_LIMIT
  ) {
    throw new RangeError(
      `Message page limit must be between 1 and ${ORDER_MESSAGE_PAGE_MAX_LIMIT}`,
    );
  }
  return Object.freeze({
    before:
      request.before === undefined
        ? null
        : decodeOrderMessageCursor(request.before),
    limit,
  });
}

export function createOrderMessagePageMetadata(
  limit: number,
  messages: readonly OrderWorkspaceMessage[],
  hasMore: boolean,
): OrderMessagePageMetadata {
  const oldest = messages[0];
  return Object.freeze({
    limit,
    returned: messages.length,
    hasMore,
    nextCursor:
      hasMore && oldest !== undefined
        ? encodeOrderMessageCursor(oldest)
        : null,
  });
}
