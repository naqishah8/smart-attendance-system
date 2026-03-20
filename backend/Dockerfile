FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Create directories for uploads and payslips
RUN mkdir -p uploads payslips

EXPOSE 3000

CMD ["node", "src/server.js"]
