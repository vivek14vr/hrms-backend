import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp(); const response = ctx.getResponse<Response>(); const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    this.logger.error(`${request.method} ${request.url} ${status}`, exception instanceof Error ? exception.stack : undefined);
    const message = typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as { message?: string | string[] } | undefined)?.message ?? 'Unexpected server error';
    response.status(status).json({ statusCode: status, message, path: request.url, timestamp: new Date().toISOString() });
  }
}
