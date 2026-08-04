const REQUIRED_PRODUCTION_ENV = [
  "NODE_ENV",
  "BACKEND_URL",
  "FRONTEND_URL",
  "CASHFREE_APP_ID",
  "CASHFREE_SECRET_KEY",
];

function validateHttpsUrl(name, value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid production URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }
  if (/localhost|127\.0\.0\.1|sandbox|test/i.test(parsed.hostname)) {
    throw new Error(`${name} must point to a production host`);
  }
}

function validateProductionEnv() {
  const missing = REQUIRED_PRODUCTION_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (process.env.NODE_ENV !== "production") {
    throw new Error('NODE_ENV must be set to "production"');
  }

  if (process.env.CASHFREE_ENV !== "production") {
    throw new Error('CASHFREE_ENV must be set to "production"');
  }

  validateHttpsUrl("BACKEND_URL", process.env.BACKEND_URL);
  validateHttpsUrl("FRONTEND_URL", process.env.FRONTEND_URL);
}

module.exports = validateProductionEnv;
