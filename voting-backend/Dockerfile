# Base image strategy
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and lock file (owned by root by default in Docker COPY)
COPY package*.json ./

# Install dependencies (as root)
RUN npm install

# Copy application files (owned by root)
COPY . .

# Ensure the app files are owned by root, but readable by everyone
RUN chown -R root:root /app && \
    chmod -R 755 /app

# Expose backend port
EXPOSE 5000

# Switch to the unprivileged 'node' user that comes with the node alpine image
# This ensures the app cannot write or modify files in the container
USER node

# Start the application
CMD ["npm", "start"]
