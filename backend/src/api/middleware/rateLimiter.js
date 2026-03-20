// Simple in-memory rate limiter (free, no Redis dependency needed)
const createRateLimiter = (windowMs, maxRequests) => {
  const requests = new Map();

  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests) {
      if (now - data.windowStart > windowMs) {
        requests.delete(key);
      }
    }
  }, 60000).unref();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowData = requests.get(key);

    if (!windowData || now - windowData.windowStart > windowMs) {
      requests.set(key, { windowStart: now, count: 1 });
      return next();
    }

    if (windowData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests, please try again later'
      });
    }

    windowData.count++;
    next();
  };
};

module.exports = {
  apiLimiter: createRateLimiter(60 * 1000, 100),     // 100 req/min
  loginLimiter: createRateLimiter(15 * 60 * 1000, 5)  // 5 login attempts per 15 min
};
