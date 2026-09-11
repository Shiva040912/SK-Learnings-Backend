// Required at startup: the app cannot function without these. Anything
// optional (e.g. WHATSAPP_*) is already handled gracefully at the call
// site (see WhatsappService) and must NOT be listed here.
const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missing.length > 0) {
    // Names only — never log/throw the values of secrets.
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them before starting the application.',
    );
  }

  return config;
}
