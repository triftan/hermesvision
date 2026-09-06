# syntax=docker/dockerfile:1

FROM node:22-slim AS base

# Install dependencies for native modules if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
