#!/bin/bash

# Debug script to check CSS file paths in Docker

echo "🔍 Checking CSS files in Docker container..."
echo ""

# Check if container is running
if ! docker ps | grep -q meetify-frontend; then
    echo "❌ Frontend container is not running"
    exit 1
fi

echo "✅ Container is running"
echo ""

# List all CSS files in container
echo "📁 CSS files in container:"
docker exec meetify-frontend find /usr/share/nginx/html -name "*.css" -type f
echo ""

# Check specific paths
echo "📝 Checking common paths:"
docker exec meetify-frontend test -f /usr/share/nginx/html/styles.css && echo "✅ /styles.css exists" || echo "❌ /styles.css NOT FOUND"
docker exec meetify-frontend test -f /usr/share/nginx/html/auth/auth_reg.css && echo "✅ /auth/auth_reg.css exists" || echo "❌ /auth/auth_reg.css NOT FOUND"
docker exec meetify-frontend test -f /usr/share/nginx/html/Conf/conf.css && echo "✅ /Conf/conf.css exists" || echo "❌ /Conf/conf.css NOT FOUND"
echo ""

# Show nginx error log
echo "📋 Recent Nginx errors:"
docker exec meetify-frontend tail -n 20 /var/log/nginx/error.log
echo ""

# Test accessing CSS file
echo "🌐 Testing CSS file access:"
curl -I http://localhost/styles.css 2>/dev/null | head -n 1
curl -I http://localhost/Conf/conf.css 2>/dev/null | head -n 1
echo ""

echo "💡 If files are missing, rebuild container:"
echo "   docker-compose build frontend --no-cache"
echo "   docker-compose up -d frontend"