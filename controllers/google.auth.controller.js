const axios = require("axios");
const { register, login } = require("./auth.controller");

exports.googleAuthCallback = async (req, res, next) => {
  try {
    const code = req.query.code;
    const rawState = req.query.state;

    if (!code) {
      return res
        .status(400)
        .json({ status: "fail", message: "Missing authorization code" });
    }

    // Parse state safely
    let stateData = {};
    try {
      stateData = JSON.parse(rawState);
    } catch (err) {
      console.warn("Invalid state param:", rawState);
      return res
        .status(400)
        .json({ status: "fail", message: "Invalid state parameter" });
    }

    const { state, type, device } = stateData; // state = student | institution | admin; type = login | register
    const CLIENT_ORIGIN =
      device === "web"
        ? process.env.CLIENT_ORIGIN_WEB
        : process.env.CLIENT_ORIGIN_MOBILE;

    // Helper to redirect via frontend page
    const redirectViaFrontend = (to, params = {}) => {
      const query = new URLSearchParams({ to, ...params }).toString();
      return res.redirect(`${CLIENT_ORIGIN}/redirect?${query}`);
    };

    // 1️⃣ Exchange code for Google tokens
    const { data } = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { id_token } = data;
    if (!id_token) {
      return res
        .status(401)
        .json({ status: "fail", message: "Google authentication failed" });
    }

    // 2️⃣ Decode token
    const payload = JSON.parse(
      Buffer.from(id_token.split(".")[1], "base64").toString()
    );
    const { email, name, sub } = payload;

    // 3️⃣ Attach normalized body
    req.body = {
      name,
      email,
      contactNumber: "",
      address: "",
      googleId: sub,
      type: state, // student | institution | admin
    };

    // 4️⃣ Handle login or register
    if (type === "login") {
      try {
        // ✅ Perform login (returns user via sendTokens)
        const user = await login(req, res, next, {
          returnTokens: true,
        });

        const { isProfileCompleted, isPaymentDone} = user;

        if (state === "student") {
          if (!isProfileCompleted) {
            return redirectViaFrontend("/student/onboarding", {
              status: "success",
              type: "login",
            });
          } else {
            return redirectViaFrontend("/dashboard", {
              status: "success",
              type: "login",
            });
          }
        }

        if (state === "institution") {
          if (!isProfileCompleted) {
            return redirectViaFrontend("/signup", {
              status: "success",
              type: "login",
            });
          }else {
            return redirectViaFrontend("/dashboard", {
              status: "success",
              type: "login",
            });
          }
        }

        // default fallback
        return redirectViaFrontend("/", {
          status: "success",
          type: "login",
        });
      } catch (err) {
        console.warn("Login failed:", err.message);

        // Handle errors and redirect accordingly
        const reason =
          err.code === "ROLE_MISMATCH"
            ? "wrong_user_type"
            : err.code === "USER_NOT_FOUND"
            ? "not_registered"
            : "login_failed";

        const target =
          state === "student" ? "/student/login" : "/institute";

        return redirectViaFrontend(target, {
          status: "fail",
          reason,
          type: "login",
        });
      }
    } else if (type === "register") {
      try {
        const user = await register(req, res, next, { returnTokens: true });

        // after successful register redirect
        if (state === "student") {
          return redirectViaFrontend("/student/onboarding", {
            status: "success",
            type: "register",
          });
        } else if (state === "institution") {
          return redirectViaFrontend("/signup", {
            status: "success",
            type: "register",
          });
        }
      } catch (err) {
        console.warn("Registration failed:", err.message);

        const target =
          state === "student" ? "/student/signup" : "/institute";
        return redirectViaFrontend(target, {
          status: "fail",
          reason: "already_registered",
          type: "register",
        });
      }
    }

    return res
      .status(400)
      .json({ status: "fail", message: "Invalid type parameter" });
  } catch (error) {
    console.error("Google OAuth error:", error.message);
    next(error);
  }
};
