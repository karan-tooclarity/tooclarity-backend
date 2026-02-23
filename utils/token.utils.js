const JwtUtil = require("./jwt.util");
const CookieUtil = require("./cookie.util");
const RedisUtil = require("./redis.util");
const Session = require("../models/Session");
const { v4: uuidv4 } = require("uuid");

/**
 * Generates access & refresh tokens, saves refresh token in Redis,
 * sets cookies, and returns the response.
 *
 * @param {Object} user - Mongoose user document
 * @param {Object} res - Express response object
 * @param {string} message - Message to send in response
 */
const sendTokens = async (user, res, message, options ={}) => {
  const userId = user._id;
  const role = user.role || "STUDENT"; // default role

  const sessionId = uuidv4();

  const accessToken = JwtUtil.generateToken(userId, "access", role);
  const refreshToken = JwtUtil.generateToken(userId, "refresh", role);

  const decodedRefresh = JwtUtil.decodeToken(refreshToken);
  const refreshTtlSeconds = decodedRefresh.exp - Math.floor(Date.now() / 1000);

  await Promise.all([
    RedisUtil.saveAccessToken(sessionId, accessToken, 900),
    Session.create({
      sessionId,
      userId,
      refreshToken,
      expiresAt: new Date(decodedRefresh.exp * 1000),
    }),
  ]);

  CookieUtil.setCookie(res, "session_id", sessionId,{
    maxAge: refreshTtlSeconds * 1000,
  });

  if (options.returnTokens) {
    return {
      sessionId,
      role: user.role,
      isProfileCompleted: user.isProfileCompleted,
      isPaymentDone: user.isPaymentDone,
    };
  }

  return res.status(200).json({
    status: "success",
    message,
  });
};

module.exports = { sendTokens };
