# ── Backend Dockerfile ──────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy all source files
COPY . .

# Expose backend port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
