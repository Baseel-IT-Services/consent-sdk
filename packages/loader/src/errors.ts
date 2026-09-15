import { ErrorCode } from '@baseel/types';

export class BaseelError extends Error {
  public code: ErrorCode;
  public details?: any;

  constructor(code: ErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'BaseelError';
    this.code = code;
    this.details = details;
    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends BaseelError {
  constructor(message: string, code: ErrorCode = ErrorCode.CONFIG_MISSING_APP_ID, details?: any) {
    super(code, message, details);
    this.name = 'ConfigurationError';
  }
}

export class InitializationError extends BaseelError {
  constructor(message: string, code: ErrorCode = ErrorCode.SDK_ALREADY_INITIALIZED, details?: any) {
    super(code, message, details);
    this.name = 'InitializationError';
  }
}

export class ConsentError extends BaseelError {
  constructor(message: string, code: ErrorCode = ErrorCode.CONSENT_INVALID_STATE, details?: any) {
    super(code, message, details);
    this.name = 'ConsentError';
  }
}

export class ApiError extends BaseelError {
  public status?: number;

  constructor(code: ErrorCode, message: string, details?: any) {
    super(code, message, details);
    this.name = 'ApiError';
    if (details && typeof details.status === 'number') {
      this.status = details.status;
    }
  }
}

