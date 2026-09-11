import { HttpStatus } from '@nestjs/common';
import type { Connection } from 'mongoose';
import type { Response } from 'express';

import { HealthController } from './health.controller';

// H8 (health check) regression coverage.
describe('HealthController (H8)', () => {
  const makeRes = () => {
    const res = { status: jest.fn() } as unknown as Response;
    (res.status as jest.Mock).mockReturnValue(res);
    return res;
  };

  it('returns 200-shaped ok/up when the mongoose connection is ready', () => {
    const connection = { readyState: 1 } as unknown as Connection;
    const controller = new HealthController(connection);
    const res = makeRes();

    const body = controller.check(res);

    expect(res.status).not.toHaveBeenCalled();
    expect(body).toMatchObject({ status: 'ok', db: 'up' });
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 503 degraded/down when the connection is not ready, without leaking connection details', () => {
    const connection = { readyState: 0 } as unknown as Connection;
    const controller = new HealthController(connection);
    const res = makeRes();

    const body = controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body).toMatchObject({ status: 'degraded', db: 'down' });
    expect(JSON.stringify(body)).not.toMatch(/mongodb:\/\/|password|secret/i);
  });
});
