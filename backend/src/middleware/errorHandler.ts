import { Request, Response, NextFunction } from 'express';

export interface SCIMError extends Error {
  status?: number;
  scimType?: string;
}

export function errorHandler(err: SCIMError, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  const status = err.status || 500;
  const detail = err.message || 'Internal server error';
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
