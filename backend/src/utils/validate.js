const mongoose = require('mongoose');

const validate = {
  isObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  },

  objectId(id, fieldName = 'id') {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error(`Invalid ${fieldName}`);
      err.statusCode = 400;
      throw err;
    }
    return id;
  },

  pagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  },

  dateRange(startDate, endDate) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start && isNaN(start.getTime())) {
      const err = new Error('Invalid start date');
      err.statusCode = 400;
      throw err;
    }
    if (end && isNaN(end.getTime())) {
      const err = new Error('Invalid end date');
      err.statusCode = 400;
      throw err;
    }
    return { start, end };
  },

  required(obj, fields) {
    const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
    if (missing.length > 0) {
      const err = new Error(`Missing required fields: ${missing.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
  },

  email(email) {
    const re = /^\S+@\S+\.\S+$/;
    if (!email || !re.test(email)) {
      const err = new Error('Invalid email format');
      err.statusCode = 400;
      throw err;
    }
    return email.trim().toLowerCase();
  },

  password(password) {
    if (!password || password.length < 8) {
      const err = new Error('Password must be at least 8 characters');
      err.statusCode = 400;
      throw err;
    }
    return password;
  },

  positiveNumber(value, fieldName) {
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      const err = new Error(`${fieldName} must be a positive number`);
      err.statusCode = 400;
      throw err;
    }
    return num;
  },

  month(value) {
    const m = parseInt(value);
    if (isNaN(m) || m < 1 || m > 12) {
      const err = new Error('Month must be 1-12');
      err.statusCode = 400;
      throw err;
    }
    return m;
  },

  year(value) {
    const y = parseInt(value);
    if (isNaN(y) || y < 2000 || y > 2100) {
      const err = new Error('Invalid year');
      err.statusCode = 400;
      throw err;
    }
    return y;
  },

  base64Image(data, maxSizeMB = 5) {
    if (!data || typeof data !== 'string') {
      const err = new Error('Image data required');
      err.statusCode = 400;
      throw err;
    }
    const sizeInBytes = (data.length * 3) / 4;
    if (sizeInBytes > maxSizeMB * 1024 * 1024) {
      const err = new Error(`Image exceeds ${maxSizeMB}MB limit`);
      err.statusCode = 400;
      throw err;
    }
    return data;
  }
};

module.exports = validate;
