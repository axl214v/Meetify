# ==========================================
# Meetify Backend Dockerfile
# Node.js + Express + Socket.IO + mediasoup
# ==========================================

# Debian slim — mediasoup uses prebuilt binaries on glibc (Alpine/musl is unreliable)
FROM node:18-bookworm-slim

WORKDIR /app

# Build tools needed by mediasoup native workers
RUN apt-get update && apt-get install -y \
    python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

# Install deps first (layer caching)
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create runtime directories
RUN mkdir -p /app/logs && chmod 755 /app/logs && \
    mkdir -p uploads/avatars && chmod -R 775 uploads && \
    chown -R node:node /app

# Run as the built-in non-root node user
USER node

# HTTP port (RTC media ports 40000-40059 are published by docker-compose)
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/check-status || exit 1

CMD ["node", "index.js"]
