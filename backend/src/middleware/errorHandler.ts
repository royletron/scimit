import { Request, Response, NextFunction } from 'express';
import { logError } from '../utils/logger.js';

export interface SCIMError extends Error {
  status?: number;
  scimType?: string;
}

let stackHintShown = false;

export function errorHandler(err: SCIMError & { statusCode?: number }, req: Request, res: Response, next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const detail = err.message || 'Internal server error';

  // 4xx are expected (bad input, not found, conflicts): the request line already shows the status,
  // and the reason goes back to the client. Only unexpected failures are logged, without a stack
  // unless SCIMIT_DEBUG is set.
  if (status >= 500) {
    const debug = Boolean(process.env.SCIMIT_DEBUG);
    logError(`${req.method} ${req.originalUrl} failed: ${detail}`, debug ? err.stack : undefined);
    if (!debug && !stackHintShown) {
      logError('Run with SCIMIT_DEBUG=1 to see stack traces.');
      stackHintShown = true;
    }
  }
  const scimType = err.scimType;

  const errorResponse: any = {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: status.toString(),
    detail
  };

  if (scimType) {
    errorResponse.scimType = scimType;
  }

  res.status(status).json(errorResponse);
}

export function createSCIMError(message: string, status: number, scimType?: string): SCIMError {
  const error: SCIMError = new Error(message);
  error.status = status;
  error.scimType = scimType;
  return error;
}
