const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');

// We need supertest — check if available, skip gracefully if not
let request;
try {
  request = require('supertest');
} catch {
  // supertest not installed — tests will be skipped
}

// Import the app (not server — we don't want to call .listen())
const { app } = require('../../src/server');

let mongoServer;
let authToken;
let testUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Seed a test user with password for login
  testUser = await User.create({
    employeeId: 'ADMIN001',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    password: 'password123',
    department: 'IT',
    role: 'admin'
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const describeOrSkip = request ? describe : describe.skip;

describeOrSkip('API Integration Tests', () => {

  describe('POST /api/auth/login', () => {

    it('should return token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe('admin@example.com');
      expect(response.body.user.role).toBe('admin');

      authToken = response.body.token;
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(response.status).toBe(401);
    });

    it('should return 400 when email or password missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/attendance/today/:userId', () => {

    it('should return attendance with valid token', async () => {
      const response = await request(app)
        .get(`/api/attendance/today/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // No attendance yet — should return null
      expect(response.body.attendance).toBeNull();
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get(`/api/attendance/today/${testUser._id}`);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid userId format', async () => {
      const response = await request(app)
        .get('/api/attendance/today/not-a-valid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/employees', () => {

    it('should return employee list with valid token', async () => {
      const response = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.employees).toBeDefined();
      expect(Array.isArray(response.body.employees)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/employees?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/employees');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/health', () => {

    it('should return health status (no auth required)', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 handling', () => {

    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
