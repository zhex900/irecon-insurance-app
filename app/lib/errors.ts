export type DomainErrorCode =
  | "validation"
  | "authorization"
  | "not_found"
  | "conflict"
  | "external_service";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: DomainErrorCode,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "validation", 400);
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = "You are not allowed to perform this action.") {
    super(message, "authorization", 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "The requested item was not found.") {
    super(message, "not_found", 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "conflict", 409);
  }
}

export class ExternalServiceError extends DomainError {
  constructor(message = "An external service is temporarily unavailable.") {
    super(message, "external_service", 502);
  }
}
