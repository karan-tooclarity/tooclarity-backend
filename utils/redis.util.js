const redis = require("../config/redisConfig");

class RedisUtil {
  /**
   * Save refresh token in Redis
   * @param {string} userId
   * @param {string} token
   * @param {number} ttlSeconds - expiration in seconds
   */
  static async saveAccessToken(sessionId, token, ttlSeconds) {
    const key = `access:${sessionId}`;
    await redis.set(key, token, "EX", ttlSeconds);
    console.log(
      `Saved refresh token for sessionId ${sessionId} with TTL ${ttlSeconds} seconds`
    );
  }

  /**
   * Get refresh token from Redis
   * @param {string} userId
   * @returns {string|null}
   */
  static async getAccessToken(sessionId) {
    const key = `access:${sessionId}`;
    return await redis.get(key);
  }

  /**
   * Delete refresh token (logout / revoke)
   * @param {string} userId
   */
  static async deleteAccessToken(sessionId) {
    const key = `access:${sessionId}`;
    await redis.del(key);
  }

  /**
   * Validate refresh token
   * @param {string} userId
   * @param {string} token
   * @returns {boolean}
   */
  static async validateRefreshToken(userId, token) {
    const stored = this.getRefreshToken(userId);
    return stored === token;
  }

  // ---------- OTP Methods ----------

  /**
   * Save OTP in Redis with expiry (15 minutes default)
   * @param {string} email
   * @param {string} otp
   * @param {number} ttlSeconds
   */
  static async saveOtp(key, otp, ttlSeconds = 900) {
    const finalKey = `otp:${key}`;
    await redis.set(finalKey, otp, "EX", ttlSeconds);
  }

  /**
   * Get OTP from Redis
   * @param {string} email
   * @returns {string|null}
   */
  static async getOtp(key) {
    const finalKey = `otp:${key}`;
    return await redis.get(finalKey);
  }

  /**
   * Delete OTP from Redis after verification
   * @param {string} email
   */
  static async deleteOtp(email) {
    const key = `otp:${email}`;
    await redis.del(key);
  }

  /**
   * Validate OTP
   * @param {string} email
   * @param {string} otp
   * @returns {boolean}
   */
  static async validateOtp(key, otp) {
    const stored = await this.getOtp(key);
    if (stored && stored === otp) {
      await this.deleteOtp(key);
      return true;
    }
    return false;
  }

  static async addSubscription(orderId, status, ttlSeconds = 300) {
    const key = `subscription:${orderId}`;
    await redis.set(key, status, "EX", ttlSeconds);
  }

  static async getSubscription(orderId) {
    const key = `subscription:${orderId}`;
    return await redis.get(key);
  }

  static async deleteSubscription(orderId) {
    const key = `subscription:${orderId}`;
    try {
      await redis.del(key);
    } catch {
      console.log("key not found");
    }
  }

  static async getLock(key, ttlSeconds = 5) {
    if (!key) throw new Error("RedisLockUtil.getLock: key is required");

    const ttl = parseInt(ttlSeconds, 10);
    if (isNaN(ttl) || ttl <= 0) throw new Error("Invalid TTL for Redis lock");

    try {
      const result = await redis.set(key, "1", "NX", "EX", ttl);
      return result === "OK";
    } catch (err) {
      console.error("⚠️ RedisLockUtil.getLock Error:", err);
      return false;
    }
  }

  /**
   * Release a Redis lock manually.
   * Simply deletes the lock key.
   *
   * @param {string} key - The Redis key used as the lock
   * @returns {Promise<void>}
   */
  static async releaseLock(key) {
    if (!key) throw new Error("RedisLockUtil.releaseLock: key is required");

    try {
      await redis.del(key);
    } catch (err) {
      console.error("⚠️ RedisLockUtil.releaseLock Error:", err);
    }
  }

  static async getCachedCourses(courseId) {
    const key = `course:${courseId}`;
    return await redis.get(key);
  }

  static async cacheCourse(courseId, courseData, ttlSeconds = 600) {
    const key = `course:${courseId}`;
    await redis.set(key, JSON.stringify(courseData), "EX", ttlSeconds);
  }

  static async getCachedSubscription(institutionId) {
    const key = `subscription:${institutionId}`;
    return await redis.get(key);
  }

  static async cacheSubscription(
    institutionId,
    subscriptionData,
    ttlSeconds = 300
  ) {
    const key = `subscription:${institutionId}`;
    await redis.set(key, JSON.stringify(subscriptionData), "EX", ttlSeconds);
  }

  static async trackUniqueCourseViewOrImpression(primaryKey, courseId, institutionId, userId) {
    try {
      const key = `${primaryKey}:${courseId}:${institutionId}`;

      await Promise.all([
      redis.sadd(key, userId),
      redis.expire(key, 24 * 60 * 60),
    ]);

    } catch (err) {
      console.error("❌ Error in trackUniqueCourseView:", err);
    }
  }

  static async cachePaymentContext(orderId, context, ttlSeconds = 900) {
    if (!orderId) throw new Error("cachePaymentContext: orderId is required");
    const key = `payment:${orderId}`;
    await redis.set(key, JSON.stringify(context), "EX", ttlSeconds);
  }

  static async getPaymentContext(orderId) {
    if (!orderId) return null;
    const key = `payment:${orderId}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static async deletePaymentContext(orderId) {
    if (!orderId) return;
    const key = `payment:${orderId}`;
    await redis.del(key);
  }
}

module.exports = RedisUtil;
