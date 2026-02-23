const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// const rateLimit = require('express-rate-limit');
const pinoHttp = require("pino-http");
const logger = require("./config/logger");
const cookieParser = require("cookie-parser");

const { publicRouter: authPublicRoutes, protectedRouter: authProtectedRoutes } = require("./routes/auth.routes");
const institutionRoutes = require("./routes/institution.routes");
const branchRoutes = require("./routes/branch.routes");
const courseRoutes = require("./routes/course.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const enquiriesRoutes = require("./routes/enquiries.routes");
const profileRoutes = require("./routes/profile.routes");
const notificationRoutes = require("./routes/notification.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const {
  publicRouter: paymentPublicRoutes,
  protectedRouter: paymentProtectedRoutes,
} = require("./routes/payment.routes");
const {
  couponAdminRoute: adminRoute,
  couponInstitutionAdminRoute: InstitutionAdminRoute,
} = require("./routes/coupon.routes");
const authorizeRoles = require("./middleware/role.middleware");
const dashboardRoutes = require("./routes/dashboard.routes");

const googleRoutes = require('./routes/google.routes');
const s3Routes = require("./routes/s3.routes")
const publicRoutes = require("./routes/public.routes");
const wishlistRoutes = require("./routes/student/wishlist.routes");

// import global auth middleware
const globalAuthMiddleware = require("./middleware/globalAuth.middleware");

const studentRoutes = require("./routes/student/student.routes");

const app = express();

app.use(helmet());
const pinoMiddleware = pinoHttp({
  logger: logger,
  autoLogging: {
    ignore: (req) => req.url.includes('/api/health'),
  },
});
app.use(pinoMiddleware);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN_WEB,
  process.env.MOBILE_CLIENT_ORIGIN,
]

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) { return callback(null, true) };
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    }
    else {
      console.warn(`Origin ${origin} not allowed by CORS`);
      callback(new Error("CORS policy voilation"))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions));
app.use(cookieParser());

// Health check endpoint for Socket.IO availability
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// The limiter middleware has been commented out as requested.
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     standardHeaders: true,
//     legacyHeaders: false,
//     message: 'Too many requests from this IP, please try again after 15 minutes',
// });
// app.use('/api', limiter);

app.use(express.json({ limit: "10kb" }));

app.use("/api/v1/auth", authPublicRoutes);
app.use("/auth/google", googleRoutes);
app.use("/api/v1/payment/", paymentPublicRoutes);
// app.get("/health", (req, res) => res.status(200).send("OK"));

// Apply Global Auth Middleware (for all routes below this line)
app.use(globalAuthMiddleware);

const requireInstituteAdmin = [authorizeRoles(["INSTITUTE_ADMIN"])];
const requireAdmin = [authorizeRoles(["ADMIN"])];
const requireStudent = [authorizeRoles(["STUDENT"])];

app.use("/api/v1/auth", authProtectedRoutes);
app.use("/api/v1/students", requireStudent, studentRoutes); 

app.use("/api/v1/public", requireStudent, publicRoutes);

app.use("/api/v1/payment", requireInstituteAdmin, paymentProtectedRoutes);
app.use("/api/v1/admin/coupon", requireAdmin, adminRoute);
app.use("/api/v1/coupon", requireInstituteAdmin, InstitutionAdminRoute);

app.use("/api/v1/", profileRoutes);

app.use("/api/v1/enquiries", requireInstituteAdmin, enquiriesRoutes);

app.use("/api/v1/institutions", requireInstituteAdmin, institutionRoutes);

app.use("/api/s3", s3Routes);

app.use(
  "/api/v1/institutions/:institutionId/branches",
  requireInstituteAdmin,
  branchRoutes
);
app.use(
  "/api/v1/institutions/:institutionId/courses",
  requireInstituteAdmin,
  courseRoutes
);

app.use(
  "/api/v1/student/course",
  // requireInstituteAdmin,
  requireStudent,
  courseRoutes
);

app.use(
  "/api/v1/course",
  requireInstituteAdmin,
  courseRoutes
)

app.use(
  "/api/v1/analytics",
  requireInstituteAdmin,
  analyticsRoutes
)

app.use("/api/v1/student/wishlist",
  requireStudent,
  wishlistRoutes
)

// Unified subscription scope under institution
app.use(
  "/api/v1/institutions/:institutionId/subscriptions",
  requireInstituteAdmin,
  subscriptionRoutes
);

app.use("/api/v1/notifications", notificationRoutes);



// ✅ Secure Dashboard routes
app.use("/api/v1/dashboard", dashboardRoutes);


app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(Number(statusCode)).json({
    status: "error",
    message,
  });
});

app.use((err, req, res, next) => {
  req.log.error(err, "An unhandled error occured");
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 ? "An internal server error occured." : err.message;

  res.status(statusCode).json({
    status: "error",
    message:
      err.isOperational || process.env.NODE_ENV !== "production"
        ? err.message
        : "Something went very wrong!",
  });

});

module.exports = app;