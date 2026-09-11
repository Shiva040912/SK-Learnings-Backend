import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

import { AllExceptionsFilter } from './all-exceptions.filter';

// H8 (error monitoring) regression coverage.
describe('AllExceptionsFilter (H8)', () => {
  let filter: AllExceptionsFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ method: 'GET', originalUrl: '/api/students' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('preserves status and body for a known HttpException, unchanged from default Nest behaviour', () => {
    const exception = new BadRequestException('Invalid input');
    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Invalid input' }),
    );
  });

  it('maps an unexpected (non-HttpException) error to a generic 500 without leaking its message', () => {
    const exception = new Error(
      'DB connection string invalid: mongodb://user:pass@host',
    );
    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });

    const [responseBody] = jsonMock.mock.calls[0] as [unknown];
    expect(JSON.stringify(responseBody)).not.toContain(
      'mongodb://user:pass@host',
    );
  });

  it('logs a 5xx with request method/path/status context for server-side visibility', () => {
    const logSpy = jest
      .spyOn(filter['logger'], 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('boom'), host);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/students -> 500: boom'),
      expect.any(String),
    );
  });

  it('does not log a routine 4xx HttpException as a server error', () => {
    const logSpy = jest
      .spyOn(filter['logger'], 'error')
      .mockImplementation(() => undefined);

    filter.catch(new BadRequestException('bad'), host);

    expect(logSpy).not.toHaveBeenCalled();
  });
});
