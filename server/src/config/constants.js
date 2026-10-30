const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

module.exports = {
  LOW_STOCK_DEFAULT: Number(process.env.LOW_STOCK_THRESHOLD) || 20,
  JWT_EXPIRY: '7d',
  COOKIE_MAX_AGE,
  BCRYPT_SALT_ROUNDS: 12,
  VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  VERIFICATION_CODE_EXPIRY_MINUTES: 15,
  VERIFICATION_RESEND_COOLDOWN_SECONDS: 60,
  RESET_TOKEN_EXPIRY_HOURS: 1,
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  },
};
