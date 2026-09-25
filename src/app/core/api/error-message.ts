import { HttpErrorResponse } from '@angular/common/http';
import { FlowableError } from './api.types';

/** Best human-readable message for a failed REST call (the server's ErrorInfo message when it sent one). */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as FlowableError | string | null;
    if (body && typeof body === 'object' && body.message) return body.message;
    if (typeof body === 'string' && body.length < 300) return body;
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
