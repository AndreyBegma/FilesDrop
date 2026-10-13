import type { ApiError } from '@filesdrop/shared';
import { HttpException } from '@nestjs/common';

const PHRASES: Record<number, string> = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  507: 'Insufficient Storage',
};

/** An HttpException whose body is the shared `ApiError` shape. */
export const apiError = (
  statusCode: number,
  reason?: string,
): HttpException => {
  const body: ApiError = {
    statusCode,
    error: PHRASES[statusCode] ?? 'Error',
    ...(reason ? { reason } : {}),
  };
  return new HttpException(body, statusCode);
};
