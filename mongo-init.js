db = db.getSiblingDB('attendance');

db.createCollection('users');
db.createCollection('attendances');
db.createCollection('shifts');
db.createCollection('usershifts');
db.createCollection('fines');
db.createCollection('finerules');
db.createCollection('salaries');
db.createCollection('bonusrules');
db.createCollection('loans');
db.createCollection('cameras');
db.createCollection('shiftswaps');

// Create indexes
db.users.createIndex({ employeeId: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.attendances.createIndex({ userId: 1, date: -1 });
db.attendances.createIndex({ status: 1, date: -1 });
db.fines.createIndex({ userId: 1, createdAt: -1 });
db.salaries.createIndex({ userId: 1, month: 1, year: 1 });
db.loans.createIndex({ userId: 1, status: 1 });

print('Database initialized with collections and indexes');
