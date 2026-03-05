# Stage 1: Build the React application
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure static files and nginx configuration are owned by root
RUN chown -R root:root /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown root:root /etc/nginx/conf.d/default.conf && \
    chmod 644 /etc/nginx/conf.d/default.conf

# Give nginx user access to necessary directories to run as non-root
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Modify nginx configuration to run on an unprivileged port and with nginx user
RUN sed -i 's/listen       80;/listen       8080;/g' /etc/nginx/conf.d/default.conf && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port (changed to 8080 because non-root can't bind to 80)
EXPOSE 8080

# Switch to the unprivileged 'nginx' user
USER nginx

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
