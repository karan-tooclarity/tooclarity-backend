const { sign, verify, decode } = require("jsonwebtoken");
const CookieUtil = require("./cookie.util");
const { saveRefreshToken } = require("./redis.util");
/**
 * Generate JWT Token (access or refresh)
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @param {"access"|"refresh"} type - Token type
 * @param {string|number} [expiresIn] - Optional override expiry (e.g. "15m", "7d")
 * @returns {string} JWT token
 */
const generateToken = (userId, type = "access", role) => {
  if (!userId) {
    throw new Error("UserId and username are required for token generation");
  }

  if (type === "access") {
    expiresIn = process.env.ACCESS_EXPIRES_IN || "15m";
  } else if (type === "refresh") {
    expiresIn = process.env.REFRESH_EXPIRES_IN || "90d";
  } else {
    throw new Error("Invalid token type. Must be 'access' or 'refresh'.");
  }

  return sign({ id: userId, type, role }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

/**
 * Verify JWT token
 * @param {string} token
 * @param {object} options
 * @returns {object} Decoded payload
 */
const verifyToken = (token, options = {}) => {
  return verify(token, process.env.JWT_SECRET, { ...options });
};

/**
 * Decode JWT token without verification
 * @param {string} token
 * @returns {object|null}
 */
const decodeToken = (token) => {
  try {
    return decode(token);
  } catch {
    return null;
  }
};

/**
 * Extract user role from token
 * @param {string} token
 * @returns {string|null}
 */
const extractUserRole = (token) => {
  try {
    const decoded = verifyToken(token);
    return decoded?.role || null;
  } catch {
    return null;
  }
};

/**
 * Extract access_token from cookies
 * @param {object} req - Express request
 * @returns {string|null}
 */
const extractTokenFromCookies = (req) => {
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  return null;
};

/**
 * Extract username from a cookie (like Spring version)
 * @param {object} req - Express request
 * @returns {string|null}
 */
const extractUsernameFromCookie = (req) => {
  if (req.cookies && req.cookies.username) {
    return req.cookies.username;
  }
  return null;
};

/**
 * Extract userId from a token (valid only)
 * @param {string} token
 * @returns {string|null}
 */
const extractUserId = (token) => {
  try {
    const decoded = verifyToken(token);
    return decoded?.id || null;
  } catch {
    return null;
  }
};

/**
 * Extract username even if token expired
 * @param {string} token
 * @returns {string|null}
 */
const extractUsernameEvenIfExpired = (token) => {
  try {
    const decoded = decodeToken(token);
    return decoded?.username || null;
  } catch {
    return null;
  }
};

/**
 * Check if a token will expire soon
 * @param {string} token
 * @param {number} minutes - Threshold in minutes
 * @returns {boolean}
 */
const willExpireSoon = (token, minutes) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true; // treat as expired

  const now = Math.floor(Date.now() / 1000);
  const threshold = minutes * 60;
  return decoded.exp - now <= threshold;
};

const refreshAccessTokenIfNeeded = (req, res, token) => {
  // const token = CookieUtil.getCookie(req, "access_token");
  if (!token) return null;

  try {
    const decoded = decode(token); // no verification yet
    if (!decoded?.exp || !decoded?.id) return null;

    const now = Math.floor(Date.now() / 1000);
    const timeLeft = decoded.exp - now;

    console.log("⏳ Access token time left (sec):", timeLeft);

    // if less than 5 minutes left, refresh it
    if (timeLeft < 5 * 60) {
      const newAccessToken = generateToken(
        decoded.id,
        decoded.username,
        "access",
        decoded.role
      );
      CookieUtil.setCookie(res, "access_token", newAccessToken);
      console.log("🔄 Access token refreshed automatically");
      return newAccessToken;
    }

    return token; // still valid, no refresh
  } catch (err) {
    console.error("❌ Error checking token expiry:", err.message);
    return null;
  }
};

const refreshRefreshTokenIfNeeded = async (
  userId,
  username,
  currentRefreshToken
) => {
  try {
    const decoded = decode(currentRefreshToken);
    if (!decoded?.exp) return null;

    const now = Math.floor(Date.now() / 1000);
    const timeLeft = decoded.exp - now;

    console.log("⏳ Refresh token time left (sec):", timeLeft);

    // if less than 1 day left, refresh it
    if (timeLeft < 24 * 60 * 60) {
      const newRefreshToken = generateToken(
        userId,
        username,
        "refresh",
        decoded.role
      );
      const decodeNewRefreshToken = decodeToken(newRefreshToken);
      const ttlSeconds =
        decodeNewRefreshToken.exp - Math.floor(Date.now() / 1000);
      await saveRefreshToken(userId, newRefreshToken, ttlSeconds);
      console.log("🔄 Refresh token rotated in Redis automatically");
      return newRefreshToken;
    }

    return currentRefreshToken;
  } catch (err) {
    console.error("❌ Error checking refresh token expiry:", err.message);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  extractTokenFromCookies,
  extractUsernameFromCookie,
  extractUserRole,
  extractUserId,
  extractUsernameEvenIfExpired,
  willExpireSoon,
  refreshAccessTokenIfNeeded,
  refreshRefreshTokenIfNeeded,
};
