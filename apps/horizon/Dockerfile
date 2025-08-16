# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/horizon/package.json ./apps/horizon/

# Install dependencies with increased memory
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

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

# Install production dependencies only
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built application
COPY --from=base /app/apps/horizon/dist ./apps/horizon/dist
COPY --from=base /app/apps/horizon/prisma ./apps/horizon/prisma
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/horizon

# Expose port
EXPOSE 8080

# Start the application
CMD ["pnpm", "start"]