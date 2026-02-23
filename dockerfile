# ------------------------
# Stage 1: Builder
# ------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Only copy the package files first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source files AFTER installing dependencies
COPY . .

# ------------------------
# Stage 2: Runtime
# ------------------------
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy runtime files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/config ./config
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/jobs ./jobs
COPY --from=builder /app/workers ./workers
# (Add more app files here explicitly if needed)

# Create non-root user for better security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose port
EXPOSE 3001

# Run the application
CMD ["node", "server.js"]
