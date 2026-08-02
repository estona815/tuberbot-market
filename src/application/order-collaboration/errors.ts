export class OrderCollaborationNotFoundError extends Error {
  constructor() {
    super("Order collaboration resource was not found");
    this.name = "OrderCollaborationNotFoundError";
  }
}

export class OrderCollaborationAccessError extends Error {
  constructor() {
    super("Order collaboration resource was not found");
    this.name = "OrderCollaborationAccessError";
  }
}

export class OrderVersionConflictError extends Error {
  constructor() {
    super("Order version conflict");
    this.name = "OrderVersionConflictError";
  }
}

export class DeliverableVersionConflictError extends Error {
  constructor() {
    super("Deliverable version conflict");
    this.name = "DeliverableVersionConflictError";
  }
}

export class InvalidOrderCollaborationStateError extends Error {
  constructor(message = "Order state does not permit this action") {
    super(message);
    this.name = "InvalidOrderCollaborationStateError";
  }
}

export class OrderRevisionLimitError extends Error {
  constructor() {
    super("The contracted revision limit has been reached");
    this.name = "OrderRevisionLimitError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key conflicts with a different request");
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyInProgressError extends Error {
  constructor() {
    super("An idempotent request is already in progress");
    this.name = "IdempotencyInProgressError";
  }
}

export class DuplicateClientMessageError extends Error {
  constructor() {
    super("clientMessageId has already been used");
    this.name = "DuplicateClientMessageError";
  }
}
