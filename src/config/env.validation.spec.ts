import { validateEnv } from './env.validation';

// H7 (env startup validation) regression coverage.
describe('validateEnv (H7)', () => {
  const validConfig = {
    MONGODB_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'a-sufficiently-long-secret',
  };

  it('returns the config unchanged when all required variables are present', () => {
    expect(validateEnv({ ...validConfig, EXTRA: 'x' })).toEqual({
      ...validConfig,
      EXTRA: 'x',
    });
  });

  it('throws a clear error when JWT_SECRET is missing', () => {
    const { JWT_SECRET: _JWT_SECRET, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it('throws a clear error when MONGODB_URI is missing', () => {
    const { MONGODB_URI: _MONGODB_URI, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/MONGODB_URI/);
  });

  it('treats a present-but-empty/whitespace value as missing', () => {
    expect(() =>
      validateEnv({ ...validConfig, JWT_SECRET: '   ' }),
    ).toThrow(/JWT_SECRET/);
  });

  it('never includes the value of any variable in the thrown error message', () => {
    const secretValue = 'super-secret-value-should-not-leak';

    expect.assertions(1);

    try {
      validateEnv({ MONGODB_URI: secretValue, JWT_SECRET: '' });
    } catch (error) {
      expect((error as Error).message).not.toContain(secretValue);
    }
  });

  it('does not require optional development-only variables (e.g. WHATSAPP_*)', () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });
});
