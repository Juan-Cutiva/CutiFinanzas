export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message, 'VALIDATION');
    this.name = 'ValidationError';
  }
}

export class CurrencyMismatchError extends AppError {
  constructor(a: string, b: string) {
    super(`No se pueden combinar monedas distintas: ${a} y ${b}`, 'CURRENCY_MISMATCH');
    this.name = 'CurrencyMismatchError';
  }
}
