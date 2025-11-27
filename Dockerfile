# Use a build stage to install dependencies and prepare the app
FROM node:24-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./


# Production stage
FROM node:24-alpine AS production

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy built application and dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/src ./src/
COPY --from=builder /app/tsconfig.json ./

# Start the application using node directly (without nodemon for production)
CMD ["node", "--disable-warning=ExperimentalWarning", "--experimental-transform-types", "src/index.ts"]