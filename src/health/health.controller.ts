import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Response } from 'express';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check(@Res({ passthrough: true }) res: Response) {
    // readyState is an in-memory flag on the existing connection, not a
    // network round trip — cheap enough to hit on every check.
    const dbConnected = this.connection.readyState === 1;

    if (!dbConnected) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: dbConnected ? 'ok' : 'degraded',
      db: dbConnected ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
