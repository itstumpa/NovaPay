export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Specific Error Types ───────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class InsufficientFundsError extends AppError {
  constructor() {
    super('Insufficient funds', 422, 'INSUFFICIENT_FUNDS');
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'IDEMPOTENCY_CONFLICT');
  }
}

export class IdempotencyExpiredError extends AppError {
  constructor() {
    super(
      'Idempotency key has expired (24h TTL). This request cannot be retried with the same key.',
      422,
      'IDEMPOTENCY_KEY_EXPIRED'
    );
  }
}

export class FxQuoteExpiredError extends AppError {
  constructor() {
    super(
      'FX quote has expired (60s TTL). Please request a new quote and re-initiate the transfer.',
      422,
      'FX_QUOTE_EXPIRED'
    );
  }
}

export class FxQuoteUsedError extends AppError {
  constructor() {
    super(
      'FX quote has already been used. Each quote is single-use only.',
      422,
      'FX_QUOTE_ALREADY_USED'
    );
  }
}

export class FxProviderUnavailableError extends AppError {
  constructor() {
    super(
      'FX provider is currently unavailable. Transfer cannot proceed without a live rate.',
      503,
      'FX_PROVIDER_UNAVAILABLE'
    );
  }
}

export class WalletFrozenError extends AppError {
  constructor() {
    super('Wallet is frozen and cannot process transactions', 422, 'WALLET_FROZEN');
  }
}
