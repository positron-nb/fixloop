export type DomainErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/**
 * Errors the API returns to clients. The message is safe to show to users;
 * internal details are only logged.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'DomainError';
  }
}

export const isDomainError = (e: unknown): e is DomainError =>
  e instanceof DomainError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'DomainError');

/** Encodes a domain error into the GraphQL error message so the client can map it ("CODE: message"). */
export const encodeError = (e: DomainError) => `${e.code}: ${e.message}`;

export function decodeError(message: string | undefined): { code: DomainErrorCode; message: string } {
  const m = /^([A-Z_]+): (.*)$/s.exec(message ?? '');
  const codes: DomainErrorCode[] = ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'INVALID_STATE', 'CONFLICT', 'RATE_LIMITED', 'INTERNAL'];
  if (m && codes.includes(m[1] as DomainErrorCode)) return { code: m[1] as DomainErrorCode, message: m[2] };
  return { code: 'INTERNAL', message: message || 'Something went wrong' };
}
