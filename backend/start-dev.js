/**
 * Development startup script using in-memory MongoDB.
 * No external MongoDB installation required.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

async function startDev() {
  console.log('Starting in-memory MongoDB...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`In-memory MongoDB running at: ${uri}`);

  // Set environment variables before loading the app
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'dev-secret-key-for-testing';
  process.env.PORT = process.env.PORT || '3000';

  // Now load and start the server
  require('./src/server');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startDev().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
