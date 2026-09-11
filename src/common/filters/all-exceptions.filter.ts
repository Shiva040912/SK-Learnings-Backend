import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Mirrors Nest's own default exception handling for HttpExceptions (same
// response shape/status, so nothing client-facing changes) and adds one
// thing Nest doesn't give us out of the box: structured, contextual
// server-side logging for anything that reaches a 5xx, plus a guarantee
// that an unexpected (non-HttpException) error never leaks its message or
// stack trace to the client.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let body: unknown;

    if (isHttpException) {
      const exceptionResponse = exception.getResponse();
      body =
        typeof exceptionResponse === 'string'
          ? { statusCode: status, message: exceptionResponse }
          : exceptionResponse;
    } else {
      body = { statusCode: status, message: 'Internal server error' };
    }

    if (status >= 500) {
      const errorMessage =
        exception instanceof Error ? exception.message : 'Unknown error';
      const stack = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}: ${errorMessage}`,
        stack,
      );
    }

    response.status(status).json(body);
  }
}
