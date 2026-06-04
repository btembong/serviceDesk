const { Redis } = require('@upstash/redis');

let redis = null;

if (process.env.UPSTASH_REDIS_REST_URL && !process.env.UPSTASH_REDIS_REST_URL.includes('xxx')) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log('[Redis] Connected to Upstash Redis');
} else {
  console.warn('[Redis] Upstash credentials not configured — token blacklist disabled');
}

/**
 * Blacklist an access token until it naturally expires.
 * @param {string} token  Raw JWT string
 * @param {number} exp    Unix timestamp (seconds) from token payload
 */
const blacklistToken = async (token, exp) => {
  if (!redis) return;
  try {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await redis.set(`bl:${token}`, '1', { ex: ttl });
  } catch (err) {
    console.error('[Redis] blacklistToken error:', err.message);
  }
};

/**
 * Returns true if the token has been blacklisted (user logged out).
 * @param {string} token  Raw JWT string
 */
const isTokenBlacklisted = async (token) => {
  if (!redis) return false;
  try {
    const val = await redis.get(`bl:${token}`);
    return val === '1';
  } catch (err) {
    console.error('[Redis] isTokenBlacklisted error:', err.message);
    return false;
  }
};

module.exports = { blacklistToken, isTokenBlacklisted };
