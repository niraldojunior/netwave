export class AppError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'BAD_REQUEST',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ValidationError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}
