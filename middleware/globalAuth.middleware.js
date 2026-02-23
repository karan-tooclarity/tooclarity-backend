const { verifyToken, generateToken } = require("../utils/jwt.util");
const CookieUtil = require("../utils/cookie.util");
const {
  getAccessToken,
  saveAccessToken,
  deleteAccessToken,
  getLock,
  releaseLock,
} = require("../utils/redis.util");
const Session = require("../models/Session");
const InstituteAdmin = require("../models/InstituteAdmin");

const globalAuthMiddleware = async (req, res, next) => {
  try {
    console.log("➡️ Incoming request:", req.method, req.path);

    const publicPaths = [
      "/login",
      "/register",
      "/otp",
      "/verify-email",
      "/payment/verify",
      "/forgot-password",
      "/reset-password",
    ];
    if (publicPaths.some((p) => req.path.startsWith(p))) return next();

    const sessionId = CookieUtil.getCookie(req, "session_id");
    if (!sessionId) {
      console.log("❌ No session ID in cookie");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    // 🔹 1. Try access token in Redis
    let accessToken = await getAccessToken(sessionId);
    if (accessToken) {
      try {
        const decoded = verifyToken(accessToken);
        req.userId = decoded.id;
        req.userRole = decoded.role;
        return next(); // ✅ Access token valid
      } catch (err) {
        if (err.name !== "TokenExpiredError") {
          console.log("❌ Invalid access token:", err.message);
          CookieUtil.clearCookie(res, "session_id");
          return res.status(401).json({ message: "Invalid session, please login again" });
        }
        console.log("⚠️ Access token expired → check refresh token");
      }
    }

    // 🔹 2. Prevent concurrent refreshes
    const lockKey = `lock:${sessionId}`;
    const gotLock = await getLock(lockKey, 10); // 10s lock
    if (!gotLock) {
      console.log("⏳ Another refresh in progress, waiting...");
      await new Promise((r) => setTimeout(r, 1000));
      accessToken = await getAccessToken(sessionId);
      if (accessToken) {
        try {
          const decoded = verifyToken(accessToken);
          req.userId = decoded.id;
          req.userRole = decoded.role;
          return next();
        } catch {
          CookieUtil.clearCookie(res, "session_id");
          return res.status(401).json({ message: "Session expired, please login again" });
        }
      }
      CookieUtil.clearCookie(res, "session_id");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    try {
      // 🔹 3. Get refresh token from MongoDB
      const sessionDoc = await Session.findOne({ sessionId });
      if (!sessionDoc || !sessionDoc.refreshToken) {
        console.log("❌ No refresh token in MongoDB");
        await deleteAccessToken(sessionId);
        CookieUtil.clearCookie(res, "session_id");
        return res.status(401).json({ message: "Session expired, please login again" });
      }

      let decodedRefresh;
      try {
        decodedRefresh = verifyToken(sessionDoc.refreshToken);
      } catch (err) {
        console.log("❌ Refresh token invalid/expired:", err.message);
        await Session.deleteOne({ sessionId });
        await deleteAccessToken(sessionId);
        CookieUtil.clearCookie(res, "session_id");
        return res.status(401).json({ message: "Session expired, please login again" });
      }

      const { id: userId, role } = decodedRefresh;

      // 🔹 4. Check user exists
      const user = await InstituteAdmin.findById(userId);
      if (!user) {
        console.log("❌ User not found");
        await Session.deleteOne({ sessionId });
        await deleteAccessToken(sessionId);
        CookieUtil.clearCookie(res, "session_id");
        return res.status(401).json({ message: "User not found, please login again" });
      }

      // 🔹 5. Rotate refresh token
      const newRefreshToken = generateToken(userId, "refresh", role);
      sessionDoc.refreshToken = newRefreshToken;
      sessionDoc.updatedAt = Date.now();
      await sessionDoc.save();
      console.log("🔄 Refresh token rotated");

      // 🔹 6. Issue new access token
      const newAccessToken = generateToken(userId, "access", role);
      await saveAccessToken(sessionId, newAccessToken, 900); // 15 min TTL
      console.log("🔁 New access token stored in Redis");

      // 🔹 7. Attach user info
      req.userId = userId;
      req.userRole = role;
      return next();
    } finally {
      await releaseLock(lockKey); // always release
    }
  } catch (err) {
    console.error("🔥 Auth Middleware Error:", err);
    CookieUtil.clearCookie(res, "session_id");
    return res.status(500).json({ message: "Internal authentication error" });
  }
};

module.exports = globalAuthMiddleware;
