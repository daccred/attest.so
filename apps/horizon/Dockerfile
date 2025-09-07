# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/horizon/package.json ./apps/horizon/
COPY packages/core/package.json ./packages/core/
COPY packages/stellar-sdk/package.json ./packages/stellar-sdk/
COPY contracts/stellar/package.json ./contracts/stellar/

# Install dependencies with increased memory
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build workspace dependencies first
RUN pnpm --filter "@attestprotocol/core" build
RUN pnpm --filter "@attestprotocol/stellar-contracts" build
RUN pnpm --filter "@attestprotocol/stellar-sdk" build

# Generate Prisma client and build
WORKDIR /app/apps/horizon
RUN pnpm run postinstall && pnpm build

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/horizon/package.json ./apps/horizon/
COPY packages/core/package.json ./packages/core/
COPY packages/stellar-sdk/package.json ./packages/stellar-sdk/
COPY contracts/stellar/package.json ./contracts/stellar/

# Install production dependencies only
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built application and source
COPY --from=base /app/apps/horizon/dist ./apps/horizon/dist
COPY --from=base /app/apps/horizon/prisma ./apps/horizon/prisma
# Copy built workspace dependencies
COPY --from=base /app/packages/core/dist ./packages/core/dist
COPY --from=base /app/packages/stellar-sdk/dist ./packages/stellar-sdk/dist
COPY --from=base /app/contracts/stellar/dist ./contracts/stellar/dist

WORKDIR /app/apps/horizon

# Generate Prisma client in production environment
RUN pnpm prisma generate

# Expose port
EXPOSE 8080

# Start the application
CMD ["pnpm", "start"]