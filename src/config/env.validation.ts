const MIN_SECRET_LENGTH = 32;
const REQUIRED_SECRET_NAMES = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  for (const name of REQUIRED_SECRET_NAMES) {
    const value = typeof config[name] === 'string' ? config[name].trim() : '';
    if (!value || value.length < MIN_SECRET_LENGTH || /^replace-with-/i.test(value) || /development-secret/i.test(value)) {
      throw new Error(`${name} must be set and contain at least ${MIN_SECRET_LENGTH} characters`);
    }
  }

  return config;
}
