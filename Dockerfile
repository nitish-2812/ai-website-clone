FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build TypeScript
RUN npm run build

# Expose Web UI port and Preview port
EXPOSE 3000 3456

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
