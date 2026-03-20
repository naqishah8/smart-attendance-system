const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('STAGE 10: Deployment & DevOps', () => {

  describe('Docker Compose', () => {
    const file = path.join(ROOT, 'docker-compose.yml');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has all required services', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('mongodb:');
      expect(content).toContain('postgres:');
      expect(content).toContain('redis:');
      expect(content).toContain('backend:');
      expect(content).toContain('ai-server:');
      expect(content).toContain('admin-web:');
      expect(content).toContain('nginx:');
    });

    test('has volume definitions', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('mongodb_data:');
      expect(content).toContain('postgres_data:');
      expect(content).toContain('redis_data:');
    });

    test('backend depends on databases', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('depends_on:');
      expect(content).toContain('- mongodb');
      expect(content).toContain('- redis');
    });

    test('has environment variables for backend', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('MONGODB_URI');
      expect(content).toContain('JWT_SECRET');
      expect(content).toContain('NODE_ENV: production');
    });

    test('has restart policies', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('restart: always');
    });
  });

  describe('Dockerfiles', () => {
    test('backend Dockerfile exists and is valid', () => {
      const file = path.join(ROOT, 'backend/Dockerfile');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('FROM node:18-alpine');
      expect(content).toContain('npm ci');
      expect(content).toContain('EXPOSE 3000');
      expect(content).toContain('CMD');
    });

    test('admin-web Dockerfile exists with multi-stage build', () => {
      const file = path.join(ROOT, 'admin-web/Dockerfile');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('FROM node:18-alpine AS build');
      expect(content).toContain('FROM nginx:alpine');
      expect(content).toContain('npm run build');
      expect(content).toContain('EXPOSE 80');
    });

    test('ai-models Dockerfile exists', () => {
      const file = path.join(ROOT, 'ai-models/Dockerfile');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('FROM python:3.10');
      expect(content).toContain('pip install');
      expect(content).toContain('EXPOSE 5000');
    });

    test('backend .dockerignore exists', () => {
      const file = path.join(ROOT, 'backend/.dockerignore');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('node_modules');
      expect(content).toContain('tests');
    });
  });

  describe('Nginx Configuration', () => {
    const file = path.join(ROOT, 'nginx.conf');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has upstream definitions', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('upstream backend_servers');
      expect(content).toContain('upstream admin_servers');
    });

    test('has rate limiting', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('limit_req_zone');
      expect(content).toContain('zone=api');
      expect(content).toContain('zone=login');
    });

    test('has WebSocket support', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('location /socket.io/');
      expect(content).toContain('Upgrade');
    });

    test('proxies API and admin routes', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('location /api/');
      expect(content).toContain('proxy_pass http://backend_servers');
      expect(content).toContain('proxy_pass http://admin_servers');
    });
  });

  describe('CI/CD Pipeline', () => {
    const file = path.join(ROOT, '.github/workflows/deploy.yml');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has test, build, deploy jobs', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('test:');
      expect(content).toContain('build:');
      expect(content).toContain('deploy:');
    });

    test('test job runs tests', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('npm ci');
      expect(content).toContain('npm test');
    });

    test('build job pushes Docker images', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('docker/build-push-action');
      expect(content).toContain('attendance-backend');
      expect(content).toContain('attendance-admin');
    });

    test('deploy job uses SSH', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('appleboy/ssh-action');
      expect(content).toContain('docker-compose pull');
      expect(content).toContain('docker-compose up -d');
    });

    test('build depends on test, deploy depends on build', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('needs: test');
      expect(content).toContain('needs: build');
    });
  });

  describe('MongoDB Init Script', () => {
    const file = path.join(ROOT, 'mongo-init.js');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('creates all collections', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain("'users'");
      expect(content).toContain("'attendances'");
      expect(content).toContain("'shifts'");
      expect(content).toContain("'fines'");
      expect(content).toContain("'salaries'");
      expect(content).toContain("'loans'");
      expect(content).toContain("'cameras'");
    });

    test('creates indexes', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('createIndex');
      expect(content).toContain('employeeId');
      expect(content).toContain('unique: true');
    });
  });

  describe('AI Model Server', () => {
    test('server.py exists with Flask endpoints', () => {
      const file = path.join(ROOT, 'ai-models/server.py');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Flask');
      expect(content).toContain('/health');
      expect(content).toContain('/detect-face');
      expect(content).toContain('/detect-ppe');
      expect(content).toContain('/detect-emotion');
      expect(content).toContain('/liveness-check');
    });

    test('requirements.txt exists with dependencies', () => {
      const file = path.join(ROOT, 'ai-models/requirements.txt');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('flask');
      expect(content).toContain('tensorflow');
      expect(content).toContain('opencv-python');
      expect(content).toContain('face-recognition');
    });
  });

  describe('Database Config', () => {
    test('database.js config exists', () => {
      const file = path.join(ROOT, 'backend/src/config/database.js');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('mongoose.connect');
      expect(content).toContain('MONGODB_URI');
      expect(content).toContain('module.exports');
    });
  });

  describe('Git Configuration', () => {
    test('.gitignore exists', () => {
      const file = path.join(ROOT, '.gitignore');
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('node_modules');
      expect(content).toContain('.env');
      expect(content).toContain('ssl/');
    });
  });
});
