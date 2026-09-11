import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestContextMiddleware.name);

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const suppliedId = request.header('x-request-id');
    const requestId = suppliedId && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedId) ? suppliedId : randomUUID();
    const startedAt = Date.now();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
      this.logger.log(JSON.stringify({ event: 'http_request', requestId, method: request.method, path: request.path, statusCode: response.statusCode, durationMs: Date.now() - startedAt }));
    });
    next();
  }
}
