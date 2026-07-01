# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11.1.3

# Copy monorepo configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/database/package.json ./packages/database/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY packages/shared-types ./packages/shared-types

# Build the NestJS backend
RUN pnpm --filter backend build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11.1.3

# Copy monorepo configuration for production installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/database/package.json ./packages/database/

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built distribution from builder stage
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

EXPOSE 3000

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "backend", "start:prod"]
