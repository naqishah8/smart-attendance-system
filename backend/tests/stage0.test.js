const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('STAGE 0: Project Setup & Architecture', () => {

  test('backend directory structure exists', () => {
    const dirs = [
      'backend/src/api/routes',
      'backend/src/api/controllers',
      'backend/src/api/middleware',
      'backend/src/services/ai',
      'backend/src/services/attendance',
      'backend/src/services/finance',
      'backend/src/services/notification',
      'backend/src/models',
      'backend/src/config',
      'backend/src/utils',
      'backend/tests'
    ];
    dirs.forEach(dir => {
      expect(fs.existsSync(path.join(ROOT, dir))).toBe(true);
    });
  });

  test('mobile-app directory structure exists', () => {
    const dirs = [
      'mobile-app/src/screens',
      'mobile-app/src/components',
      'mobile-app/src/services',
      'mobile-app/src/utils'
    ];
    dirs.forEach(dir => {
      expect(fs.existsSync(path.join(ROOT, dir))).toBe(true);
    });
  });

  test('admin-web directory structure exists', () => {
    const dirs = [
      'admin-web/src/pages',
      'admin-web/src/components',
      'admin-web/src/services'
    ];
    dirs.forEach(dir => {
      expect(fs.existsSync(path.join(ROOT, dir))).toBe(true);
    });
  });

  test('ai-models directory structure exists', () => {
    const dirs = [
      'ai-models/face_recognition',
      'ai-models/liveness',
      'ai-models/object_detection',
      'ai-models/emotion_analysis'
    ];
    dirs.forEach(dir => {
      expect(fs.existsSync(path.join(ROOT, dir))).toBe(true);
    });
  });

  test('root files exist', () => {
    expect(fs.existsSync(path.join(ROOT, 'docker-compose.yml'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'README.md'))).toBe(true);
  });

  test('all package.json files are valid JSON', () => {
    const pkgs = [
      'backend/package.json',
      'mobile-app/package.json',
      'admin-web/package.json'
    ];
    pkgs.forEach(p => {
      const content = fs.readFileSync(path.join(ROOT, p), 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  test('backend package.json has required dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/package.json'), 'utf8'));
    expect(pkg.dependencies.express).toBeDefined();
    expect(pkg.dependencies.mongoose).toBeDefined();
    expect(pkg.dependencies['socket.io']).toBeDefined();
    expect(pkg.dependencies.jsonwebtoken).toBeDefined();
    expect(pkg.dependencies.bcrypt).toBeDefined();
  });

  test('server.js exports app, server, io', () => {
    // Just check the file exists and has the right exports pattern
    const serverContent = fs.readFileSync(path.join(ROOT, 'backend/src/server.js'), 'utf8');
    expect(serverContent).toContain('module.exports');
    expect(serverContent).toContain('express');
    expect(serverContent).toContain('socket.io');
  });
});
