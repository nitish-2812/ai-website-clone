FROM mcr.microsoft.com/playwright:v1.63.0-jammy

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies and ensure browser binaries match
RUN npm ci && npx playwright install chromium

# Copy application source
COPY . .

# Build TypeScript
RUN npm run build

# Expose Web UI port and Preview port
EXPOSE 3000 3456

ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
