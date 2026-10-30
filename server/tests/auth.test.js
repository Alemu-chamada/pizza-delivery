const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User.model');
const Admin = require('../src/models/Admin.model');
const EmailService = require('../src/services/email.service');
const requireAuth = require('../src/middleware/auth.middleware');
const { requireAdmin } = require('../src/middleware/role.middleware');
const { generateRandomToken, hashToken } = require('../src/utils/generateToken');

// Mount test route to verify admin authorization foundation independently of Phase 6
app.get('/api/test-admin-only', requireAuth, requireAdmin, (req, res) => {
  res.status(200).json({ success: true, message: 'Admin access granted' });
});

describe('Phase 2 — Authentication System Tests', () => {
  let mongoServer;
  let sendVerificationSpy;
  let sendResetSpy;

  beforeAll(async () => {
    require('dotenv').config();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_super_secret_key_at_least_64_characters_long_for_hs256_signing';
    process.env.JWT_EXPIRY = '7d';

    // Mock email service before any operations
    sendVerificationSpy = jest.spyOn(EmailService, 'sendVerificationEmail').mockResolvedValue({});
    sendResetSpy = jest.spyOn(EmailService, 'sendPasswordResetEmail').mockResolvedValue({});

    // In-memory MongoDB per project_plan.md §16.1 for hermetic test execution
    mongoServer = await MongoMemoryServer.create();
    const testUri = mongoServer.getUri();
    await mongoose.connect(testUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
    });
  }, 120000);

  afterAll(async () => {
    if (sendVerificationSpy) sendVerificationSpy.mockRestore();
    if (sendResetSpy) sendResetSpy.mockRestore();
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Admin.deleteMany({});
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Admin.deleteMany({});
    jest.clearAllMocks();
  });

  describe('1. Customer Registration', () => {
    it('successfully registers a customer with isVerified: false and sends verification email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'securePassword123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('jane@example.com');
      expect(res.body.data.user.role).toBe('customer');
      expect(res.body.data.user.isVerified).toBe(false);

      // Check DB
      const userInDb = await User.findOne({ email: 'jane@example.com' });
      expect(userInDb).not.toBeNull();
      expect(userInDb.isVerified).toBe(false);
      expect(userInDb.verificationToken).toBeTruthy();
      expect(userInDb.verificationTokenExpiry).toBeTruthy();

      // Check password was hashed with bcrypt
      expect(userInDb.passwordHash).not.toBe('securePassword123');
      const isMatch = await bcrypt.compare('securePassword123', userInDb.passwordHash);
      expect(isMatch).toBe(true);

      // Check email service was called
      expect(sendVerificationSpy).toHaveBeenCalledTimes(1);
      expect(sendVerificationSpy).toHaveBeenCalledWith('jane@example.com', expect.any(String));
    });

    it('rejects registration with invalid or missing input (HTTP 422)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'not-an-email',
          password: '123', // less than 6 chars
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('rejects duplicate email registration (HTTP 409)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Second User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('ignores client-supplied role to prevent self-registering as admin', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Attacker',
          email: 'attacker@example.com',
          password: 'password123',
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('customer');

      const userInDb = await User.findOne({ email: 'attacker@example.com' });
      expect(userInDb.role).toBe('customer');
    });
  });

  describe('2. Email Verification', () => {
    it('activates account when valid token is supplied', async () => {
      const rawToken = generateRandomToken();
      const hashedToken = hashToken(rawToken);

      await User.create({
        name: 'Unverified User',
        email: 'verify@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
        verificationToken: hashedToken,
        verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .get(`/api/auth/verify-email?token=${rawToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const userInDb = await User.findOne({ email: 'verify@example.com' });
      expect(userInDb.isVerified).toBe(true);
      expect(userInDb.verificationToken).toBeNull();
      expect(userInDb.verificationTokenExpiry).toBeNull();
    });

    it('rejects verification with invalid token (HTTP 400)', async () => {
      const res = await request(app)
        .get('/api/auth/verify-email?token=invalid_raw_token');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects verification with expired token (HTTP 400)', async () => {
      const rawToken = generateRandomToken();
      const hashedToken = hashToken(rawToken);

      await User.create({
        name: 'Expired Token User',
        email: 'expired@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
        verificationToken: hashedToken,
        verificationTokenExpiry: new Date(Date.now() - 1000), // expired
      });

      const res = await request(app)
        .get(`/api/auth/verify-email?token=${rawToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects reuse of already consumed verification token', async () => {
      const rawToken = generateRandomToken();
      const hashedToken = hashToken(rawToken);

      await User.create({
        name: 'Reused Token User',
        email: 'reused@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
        verificationToken: hashedToken,
        verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // First use - succeeds
      const firstRes = await request(app).get(`/api/auth/verify-email?token=${rawToken}`);
      expect(firstRes.status).toBe(200);

      // Second use - fails
      const secondRes = await request(app).get(`/api/auth/verify-email?token=${rawToken}`);
      expect(secondRes.status).toBe(400);
    });

    it('activates account with 6-digit numeric verification code', async () => {
      const code = '482915';
      const hashed = hashToken(code);

      await User.create({
        name: 'Code Verify User',
        email: 'codeuser@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
        verificationToken: hashed,
        verificationTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: 'codeuser@example.com', code: '482915' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findOne({ email: 'codeuser@example.com' });
      expect(user.isVerified).toBe(true);
      expect(user.verificationToken).toBeNull();
      expect(user.verificationTokenExpiry).toBeNull();
    });

    it('rejects invalid 6-digit verification code (HTTP 400)', async () => {
      const code = '482915';
      const hashed = hashToken(code);

      await User.create({
        name: 'Invalid Code User',
        email: 'wrongcode@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
        verificationToken: hashed,
        verificationTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: 'wrongcode@example.com', code: '999999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects expired 6-digit verification code (HTTP 400)', async () => {
      const code = '123456';
      const hashed = hashToken(code);

      await User.create({
        name: 'Expired Code User',
        email: 'expiredcode@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
        verificationToken: hashed,
        verificationTokenExpiry: new Date(Date.now() - 1000),
      });

      const res = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: 'expiredcode@example.com', code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects code reuse after successful verification', async () => {
      const code = '654321';
      const hashed = hashToken(code);

      await User.create({
        name: 'Single Use User',
        email: 'singleuse@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
        verificationToken: hashed,
        verificationTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
      });

      const first = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: 'singleuse@example.com', code: '654321' });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post('/api/auth/verify-code')
        .send({ email: 'singleuse@example.com', code: '654321' });
      expect(second.status).toBe(400);
    });

    it('resends code and enforces 60s cooldown (HTTP 429)', async () => {
      await User.create({
        name: 'Resend User',
        email: 'resend@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: false,
      });

      // First resend request succeeds
      const firstResend = await request(app)
        .post('/api/auth/resend-code')
        .send({ email: 'resend@example.com' });
      expect(firstResend.status).toBe(200);
      expect(firstResend.body.success).toBe(true);

      const userAfter = await User.findOne({ email: 'resend@example.com' });
      expect(userAfter.verificationToken).toBeTruthy();

      // Second immediate resend is rejected by 60-second cooldown with HTTP 429
      const secondResend = await request(app)
        .post('/api/auth/resend-code')
        .send({ email: 'resend@example.com' });
      expect(secondResend.status).toBe(429);
      expect(secondResend.body.success).toBe(false);
      expect(secondResend.body.remainingSeconds).toBeGreaterThan(0);
    });
  });

  describe('3. Login and Cookie Handling', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Verified Customer',
        email: 'verified@example.com',
        passwordHash: await bcrypt.hash('correctPassword123', 10),
        isVerified: true,
      });

      await User.create({
        name: 'Unverified Customer',
        email: 'unverified@example.com',
        passwordHash: await bcrypt.hash('correctPassword123', 10),
        isVerified: false,
      });

      await Admin.create({
        name: 'Admin Operator',
        email: 'admin@pizzaapp.dev',
        passwordHash: await bcrypt.hash('adminPassword123', 10),
        role: 'admin',
      });
    });

    it('rejects login for unverified customer accounts (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'correctPassword123',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('rejects login with wrong password (HTTP 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verified@example.com',
          password: 'wrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects login for nonexistent account (HTTP 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'somePassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('sets httpOnly cookie and omits JWT from JSON response body upon customer login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verified@example.com',
          password: 'correctPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('verified@example.com');

      // CRITICAL SECURITY ASSERTION: JWT must NOT exist in the JSON response body
      expect(res.body.token).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();

      // Check cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
      expect(cookies[0]).toMatch(/SameSite=Strict/i);
    });

    it('allows seeded admin to log in via /api/auth/admin-login', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({
          email: 'admin@pizzaapp.dev',
          password: 'adminPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.role).toBe('admin');

      // Token not in body
      expect(res.body.token).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();

      // Cookie set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);
    });

    it('authenticates admin account via normal /api/auth/login and returns role admin with cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@pizzaapp.dev',
          password: 'adminPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.user.email).toBe('admin@pizzaapp.dev');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });

    it('rejects admin login with wrong password via normal /api/auth/login (HTTP 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@pizzaapp.dev',
          password: 'wrongAdminPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Cookie-based Authentication and Role Guards', () => {
    let customerCookie;
    let adminCookie;

    beforeEach(async () => {
      await User.create({
        name: 'Auth Customer',
        email: 'auth_customer@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        isVerified: true,
      });

      await Admin.create({
        name: 'Auth Admin',
        email: 'auth_admin@pizzaapp.dev',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
      });

      const customerLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'auth_customer@example.com', password: 'password123' });
      customerCookie = customerLogin.headers['set-cookie'];

      const adminLogin = await request(app)
        .post('/api/auth/admin-login')
        .send({ email: 'auth_admin@pizzaapp.dev', password: 'admin123' });
      adminCookie = adminLogin.headers['set-cookie'];
    });

    it('rejects protected route when no cookie is provided (HTTP 401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('allows access to /api/auth/me when valid cookie is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('auth_customer@example.com');
    });

    it('rejects tampered or invalid cookie token (HTTP 401)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['token=invalid_tampered_jwt_token; Path=/']);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects customer cookie on admin-only route (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/test-admin-only')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('accepts admin cookie on admin-only route (HTTP 200)', async () => {
      const res = await request(app)
        .get('/api/test-admin-only')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Admin access granted');
    });

    it('clears cookie on customer logout', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/token=;/);
    });

    it('clears cookie on admin logout', async () => {
      const res = await request(app)
        .post('/api/auth/admin-logout')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/token=;/);
    });
  });

  describe('5. Forgot Password and Password Reset', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Reset User',
        email: 'reset_user@example.com',
        passwordHash: await bcrypt.hash('initialPassword123', 10),
        isVerified: true,
      });
    });

    it('always returns HTTP 200 on forgot-password (anti-enumeration)', async () => {
      // Existing user
      const resExisting = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset_user@example.com' });
      expect(resExisting.status).toBe(200);
      expect(sendResetSpy).toHaveBeenCalledTimes(1);

      // Nonexistent user
      const resNonExisting = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'doesnotexist@example.com' });
      expect(resNonExisting.status).toBe(200);
      // Spy should not have been called a second time
      expect(sendResetSpy).toHaveBeenCalledTimes(1);
    });

    it('resets password with valid token, updates DB hash, and allows login with new password', async () => {
      const rawToken = generateRandomToken();
      const hashedToken = hashToken(rawToken);

      const user = await User.findOne({ email: 'reset_user@example.com' });
      user.resetToken = hashedToken;
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: 'brandNewPassword456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify token invalidated in DB
      const updatedUser = await User.findOne({ email: 'reset_user@example.com' });
      expect(updatedUser.resetToken).toBeNull();
      expect(updatedUser.resetTokenExpiry).toBeNull();

      // Old password should fail
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'reset_user@example.com', password: 'initialPassword123' });
      expect(oldLogin.status).toBe(401);

      // New password should succeed
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'reset_user@example.com', password: 'brandNewPassword456' });
      expect(newLogin.status).toBe(200);
    });

    it('rejects password reset with invalid token (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid_raw_token',
          password: 'newPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects password reset with expired token (HTTP 400)', async () => {
      const rawToken = generateRandomToken();
      const hashedToken = hashToken(rawToken);

      const user = await User.findOne({ email: 'reset_user@example.com' });
      user.resetToken = hashedToken;
      user.resetTokenExpiry = new Date(Date.now() - 5000); // expired
      await user.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: 'newPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
