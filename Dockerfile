# CI-Doctor Universal Multi-Language Autonomous Swarm Container
FROM node:20-bookworm-slim

# Install OpenJDK 17, Python 3, and Git for Zero-Trust Sandbox verification
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    python3 \
    python3-pip \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm --prefix server install
RUN npm --prefix client install

# Copy source code
COPY server ./server
COPY client ./client

# Compile production React mission control frontend
RUN npm --prefix client run build

ENV PORT=5000
EXPOSE 5000

# Start unified MERN & Socket.io server
CMD ["node", "server/src/server.js"]
