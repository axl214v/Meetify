# ==========================================
# Meetify Frontend Dockerfile
# Nginx serving static files
# ==========================================

# Use official Nginx Alpine image
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy application files
COPY . /usr/share/nginx/html

# Set permissions
RUN chmod -R 755 /usr/share/nginx/html

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]