import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp(); const response = ctx.getResponse<Response>(); const request = ctx.getRequest<RequestWithId>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseBody = typeof exceptionResponse === 'string' ? { message: exceptionResponse } : exceptionResponse as { error?: string; message?: string | string[] } | undefined;
    const message = responseBody?.message ?? 'Unexpected server error';
    const error = responseBody?.error ?? (status >= 500 ? 'Internal Server Error' : 'Request Error');
    const requestId = request.requestId ?? 'unassigned';
    this.logger.error(JSON.stringify({ event: 'http_error', requestId, method: request.method, path: request.path, statusCode: status, error }), exception instanceof Error ? exception.stack : undefined);
    response.status(status).json({ statusCode: status, error, message, path: request.path, requestId, timestamp: new Date().toISOString() });
  }
}
