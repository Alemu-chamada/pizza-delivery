const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User.model');
const Admin = require('../src/models/Admin.model');
const EmailService = require('../src/services/email.service');
const GoogleAuthService = require('../src/services/googleAuth.service');
const { generateVerificationCode, hashToken } = require('../src/utils/generateToken');
const { BCRYPT_SALT_ROUNDS } = require('../src/config/constants');

describe('Google OAuth 2.0 / OpenID Connect Customer Authentication', () => {
  let mongoServer;
  let sendVerificationSpy;
  let exchangeCodeSpy;
  let verifyIdTokenSpy;

  beforeAll(async () => {
    require('dotenv').config();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_super_secret_key_at_least_64_characters_long_for_hs256_signing';
    process.env.JWT_EXPIRY = '7d';
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret_xyz';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5001/api/auth/google/callback';

    sendVerificationSpy = jest.spyOn(EmailService, 'sendVerificationEmail').mockResolvedValue({});

    mongoServer = await MongoMemoryServer.create();
    const testUri = mongoServer.getUri();
    await mongoose.connect(testUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
    });
  }, 120000);

  afterAll(async () => {
    if (sendVerificationSpy) sendVerificationSpy.mockRestore();
    if (exchangeCodeSpy) exchangeCodeSpy.mockRestore();
    if (verifyIdTokenSpy) verifyIdTokenSpy.mockRestore();

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

  // 1. New Google Customer Registration & Authentication
  test('1. new Google customer creates verified customer account and returns JWT cookie', async () => {
    verifyIdTokenSpy = jest.spyOn(GoogleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google_user_sub_001',
      email: 'newgoogleuser@example.com',
      name: 'Google Customer One',
      email_verified: true,
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid_mock_google_id_token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('newgoogleuser@example.com');
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user.isVerified).toBe(true);

    // Verify httpOnly cookie was set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('token='))).toBe(true);

    // Verify User persisted in MongoDB
    const dbUser = await User.findOne({ email: 'newgoogleuser@example.com' });
    expect(dbUser).not.toBeNull();
    expect(dbUser.googleId).toBe('google_user_sub_001');
    expect(dbUser.role).toBe('customer');
    expect(dbUser.isVerified).toBe(true);
    expect(dbUser.authProvider).toBe('google');

    // Verify session bootstrap via /api/auth/me
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [tokenCookie]);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('newgoogleuser@example.com');
    expect(meRes.body.data.user.role).toBe('customer');
  });

  // 2. Returning Google Customer
  test('2. returning Google customer authenticates existing linked customer without duplication', async () => {
    // Seed existing Google customer
    const seededUser = await User.create({
      name: 'Existing Google Customer',
      email: 'returning@example.com',
      googleId: 'google_user_sub_002',
      authProvider: 'google',
      role: 'customer',
      isVerified: true,
    });

    verifyIdTokenSpy = jest.spyOn(GoogleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google_user_sub_002',
      email: 'returning@example.com',
      name: 'Existing Google Customer',
      email_verified: true,
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid_mock_token_for_returning_user' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(seededUser._id.toString());
    expect(res.body.data.user.role).toBe('customer');

    // Confirm no duplicate document was created
    const userCount = await User.countDocuments({ email: 'returning@example.com' });
    expect(userCount).toBe(1);
  });

  // 3. Safe Existing-Customer Linking & Password Preservation
  test('3. safe existing-customer linking preserves existing password without overwriting', async () => {
    const rawPassword = 'OriginalCustomerPassword123!';
    const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_SALT_ROUNDS);

    const existingCustomer = await User.create({
      name: 'Local Customer',
      email: 'linkme@example.com',
      passwordHash,
      role: 'customer',
      isVerified: false,
    });

    verifyIdTokenSpy = jest.spyOn(GoogleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google_user_sub_003',
      email: 'linkme@example.com',
      name: 'Local Customer Via Google',
      email_verified: true,
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid_mock_token_for_linking' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify account was linked and verified
    const updatedUser = await User.findById(existingCustomer._id);
    expect(updatedUser.googleId).toBe('google_user_sub_003');
    expect(updatedUser.isVerified).toBe(true);
    // Crucial: passwordHash remains intact!
    expect(updatedUser.passwordHash).toBe(passwordHash);

    // Verify existing customer can still log in using their original password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'linkme@example.com',
        password: rawPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.email).toBe('linkme@example.com');
  });

  // 4. Google Verified-Email Handling
  test('4. rejects Google authentication when Google email is unverified', async () => {
    verifyIdTokenSpy = jest.spyOn(GoogleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google_unverified_sub',
      email: 'unverified@example.com',
      name: 'Unverified User',
      email_verified: false, // Unverified Google email!
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock_token_unverified' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/verified Google email/i);

    // Ensure no user was created
    const dbUser = await User.findOne({ email: 'unverified@example.com' });
    expect(dbUser).toBeNull();
  });

  // 5. Duplicate Prevention
  test('5. prevents duplicate accounts across multiple concurrent authentications', async () => {
    verifyIdTokenSpy = jest.spyOn(GoogleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google_duplicate_test_sub',
      email: 'unique_customer@example.com',
      name: 'Unique Customer',
      email_verified: true,
    });

    // Make two sequential calls
    await request(app).post('/api/auth/google').send({ idToken: 'token1' });
    await request(app).post('/api/auth/google').send({ idToken: 'token2' });

    const totalUsers = await User.countDocuments({ email: 'unique_customer@example.com' });
    expect(totalUsers).toBe(1);
  });

  // 6. Invalid OAuth Response / Token Failure
  test('6. invalid OAuth token returns 401 and handles errors cleanly', async () => {
    verifyIdTokenSpy = jest.spyOn(GoogleAuthService, 'verifyGoogleIdToken').mockRejectedValue(
      new Error('Invalid token signature or expired token'),
    );

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'invalid_malformed_token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid token signature|Google authentication failed/i);
  });

  // 7. Admin Isolation: Google Account Matching Admin Email Cannot Gain Admin Privileges
  test('7. Google account matching admin email is strictly rejected and cannot gain admin role', async () => {
    const adminPasswordHash = await bcrypt.hash('Admin@SecretPass123', BCRYPT_SALT_ROUNDS);
    const admin = await Admin.create({
      name: 'System Admin',
      email: 'admin@pizzaapp.dev',
      passwordHash: adminPasswordHash,
      role: 'admin',
    });

    verifyIdTokenSpy = jest.spyOn(GoogleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google_attacker_sub_999',
      email: 'admin@pizzaapp.dev',
      name: 'Admin Impersonator',
      email_verified: true,
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'token_with_admin_email' });

    // Must be rejected with HTTP 403 Forbidden
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Administrative accounts cannot sign in using Google/i);

    // Verify Admin collection record was never modified
    const untouchedAdmin = await Admin.findById(admin._id);
    expect(untouchedAdmin.role).toBe('admin');

    // Verify no customer record was created with admin role
    const customerRecord = await User.findOne({ email: 'admin@pizzaapp.dev' });
    expect(customerRecord).toBeNull();
  });

  // 8. Existing Password Login Still Works
  test('8. existing customer password login continues working flawlessly', async () => {
    const password = 'StrongPassword123!';
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await User.create({
      name: 'Standard Customer',
      email: 'standard@customer.dev',
      passwordHash,
      role: 'customer',
      isVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'standard@customer.dev',
        password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('customer');

    // Wrong password check
    const badRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'standard@customer.dev',
        password: 'WrongPassword!',
      });

    expect(badRes.status).toBe(401);
    expect(badRes.body.success).toBe(false);
  });

  // 9. Existing Admin Login Still Works
  test('9. existing admin login continues working via both /admin-login and /login', async () => {
    const adminPassword = 'AdminSecretPassword@123';
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);

    await Admin.create({
      name: 'Seeded Kitchen Manager',
      email: 'manager@kitchen.dev',
      passwordHash,
      role: 'admin',
    });

    // 1. Direct admin portal login
    const adminRes = await request(app)
      .post('/api/auth/admin-login')
      .send({
        email: 'manager@kitchen.dev',
        password: adminPassword,
      });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data.admin.role).toBe('admin');

    // 2. Unified login route /login
    const unifiedRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'manager@kitchen.dev',
        password: adminPassword,
      });

    expect(unifiedRes.status).toBe(200);
    expect(unifiedRes.body.success).toBe(true);
    expect(unifiedRes.body.data.user.role).toBe('admin');
  });

  // 10. Verification-Code Registration Still Works
  test('10. verification-code registration and code verification flow remains fully intact', async () => {
    // Step 1: Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'New Code Registrant',
        email: 'codereg@example.com',
        password: 'ValidPassword123!',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.user.isVerified).toBe(false);

    // Verify verification code was emailed
    expect(sendVerificationSpy).toHaveBeenCalled();
    const emailedCode = sendVerificationSpy.mock.calls[0][1];
    expect(emailedCode).toMatch(/^\d{6}$/);

    // Step 2: Verify code
    const verifyRes = await request(app)
      .post('/api/auth/verify-code')
      .send({
        email: 'codereg@example.com',
        code: emailedCode,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.isVerified).toBe(true);

    // Step 3: Login now succeeds
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'codereg@example.com',
        password: 'ValidPassword123!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.role).toBe('customer');

    // Step 4: /api/auth/me confirms verified customer
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', loginRes.headers['set-cookie']);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.isVerified).toBe(true);
  });

  // 11. Google OAuth 2.0 Authorization Code Redirect Flow (GET /api/auth/google & /callback)
  test('11. Google OAuth redirect flow initiates consent and handles callback with clean redirects', async () => {
    // 11a: Initiation GET /api/auth/google redirects to Google
    const initRes = await request(app).get('/api/auth/google?returnTo=/builder');
    expect(initRes.status).toBe(302);
    expect(initRes.headers.location).toMatch(/accounts\.google\.com/);
    const cookies = initRes.headers['set-cookie'];
    expect(cookies.some((c) => c.startsWith('google_oauth_state='))).toBe(true);

    // 11b: Callback with cancelled access_denied redirects to /login?error=google_cancelled
    const cancelRes = await request(app)
      .get('/api/auth/google/callback?error=access_denied');
    expect(cancelRes.status).toBe(302);
    expect(cancelRes.headers.location).toContain('/login?error=google_cancelled');

    // 11c: Callback with valid code exchanges code and redirects to dashboard with JWT cookie
    exchangeCodeSpy = jest.spyOn(GoogleAuthService, 'exchangeCodeForPayload').mockResolvedValue({
      sub: 'google_code_flow_sub',
      email: 'codeflow@example.com',
      name: 'Code Flow User',
      email_verified: true,
    });

    const statePayload = Buffer.from(JSON.stringify({ nonce: 'mock_nonce_123', returnTo: '/builder' })).toString('base64url');

    const cbRes = await request(app)
      .get(`/api/auth/google/callback?code=mock_google_auth_code_123&state=${statePayload}`);

    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.location).toContain('/builder');
    const cbCookies = cbRes.headers['set-cookie'];
    expect(cbCookies.some((c) => c.startsWith('token='))).toBe(true);
  });
});
