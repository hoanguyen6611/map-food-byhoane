import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorResponse } from '@foodmap/shared-types';

// Normalizes every thrown error (HttpException or otherwise) into the
// consistent {statusCode, message, error} shape consumed by mobile/admin-web.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ApiErrorResponse = isHttpException
      ? this.normalize(exception)
      : {
          statusCode,
          message: 'Internal server error',
          error: 'InternalServerError',
        };

    if (!isHttpException) {
      this.logger.error('Unhandled exception', exception as Error);
    }

    response.status(statusCode).json(body);
  }

  private normalize(exception: HttpException): ApiErrorResponse {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode: status, message: payload, error: exception.name };
    }

    const { message, error } = payload as {
      message?: string | string[];
      error?: string;
    };
    return {
      statusCode: status,
      message: message ?? exception.message,
      error: error ?? exception.name,
    };
  }
}
