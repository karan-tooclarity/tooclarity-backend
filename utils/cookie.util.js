const { decodeToken } = require("./jwt.util");

class CookieUtil {
  static defaultOptions = {
    secure: true,
    // secure: true,
    sameSite: "none",
    path: "/", // default root path
    maxAge: 15 * 60 * 1000,
  };

  /**
   * Set a cookie
   * @param {Object} res - Express response object
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {Object} options - Extra cookie options (e.g. maxAge, expires, path)
   */

  static setCookie(res, name, value, options = {}) {
    const finalOptions = { ...this.defaultOptions, ...options };

    // If user passes `maxAge`, make sure `expires` syncs too
    if (finalOptions.maxAge && !finalOptions.expires) {
      finalOptions.expires = new Date(Date.now() + finalOptions.maxAge);
    }

    res.cookie(name, value, finalOptions);
  }

  /**
   * Clear a cookie
   * @param {Object} res - Express response object
   * @param {string} name - Cookie name
   * @param {Object} options - Extra options (path must match original cookie path)
   */
  static clearAllCookies(res, options = {}) {
    const cookies = res.req?.cookies || {}; // ✅ safely get cookies from attached request
    Object.keys(cookies).forEach((cookieName) => {
      res.clearCookie(cookieName, {
        ...this.defaultOptions,
        ...options,
      });
    });
  }

  static clearCookie(res, name, options = {}) {
    res.clearCookie(name, {
      ...this.defaultOptions,
      ...options,
    });
  }

  /**
   * Get a cookie by name
   * @param {Object} req - Express request object
   * @param {string} name - Cookie name
   * @returns {string|undefined} - Cookie value
   */
  static getCookie(req, name) {
    return req.cookies?.[name];
  }

  /**
   * Set multiple cookies at once
   * @param {Object} res - Express response object
   * @param {Object} cookies - { name: value, ... }
   * @param {Object} options - Options applied to all cookies
   */
  static setCookies(res, name, value, options = {}) {
    res.cookie(name, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      ...options,
    });
  }

  /**
   * Clear multiple cookies at once
   * @param {Object} res - Express response object
   * @param {Array<string>} names - Array of cookie names
   * @param {Object} options - Options applied to all cookies
   */
  static clearCookies(res, names = [], options = {}) {
    names.forEach((name) => {
      this.clearCookie(res, name, options);
    });
  }

  /**
   * Update cookie with new token, automatically syncing expiry with JWT exp claim
   * @param {object} res - Express response
   * @param {string} name - Cookie name
   * @param {string} token - JWT token
   * @param {object} options - Extra options if needed
   */
  static updateCookie(res, name, token, options = {}) {
    // Clear old cookie first
    this.clearCookie(res, name);

    // Decode token to get expiry
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      throw new Error("Invalid token, cannot update cookie");
    }

    // Convert exp (seconds) to milliseconds
    const expiryDate = new Date(decoded.exp * 1000);
    const maxAge = decoded.exp * 1000 - Date.now();

    this.setCookie(res, name, token, {
      expires: expiryDate,
      maxAge,
      ...options,
    });
  }
}

module.exports = CookieUtil;
